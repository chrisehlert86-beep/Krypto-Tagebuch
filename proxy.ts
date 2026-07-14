import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { verifySession } from '@/lib/auth'

function createCsp(nonce: string) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''} https://telegram.org`,
    `style-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src https://oauth.telegram.org https://telegram.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function validateMutationRequest(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return null
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return null

  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site' || (origin && origin !== request.nextUrl.origin)) {
    return apiError('Herkunft der Anfrage wurde abgelehnt.', 403)
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > 32_768) {
    return apiError('Anfrage ist zu groß.', 413)
  }

  const body = await request.clone().text()
  if (!body) return null
  if (new TextEncoder().encode(body).byteLength > 32_768) {
    return apiError('Anfrage ist zu groß.', 413)
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return apiError('Nur JSON-Anfragen werden akzeptiert.', 415)
  }
  try {
    const value: unknown = JSON.parse(body)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
  } catch {
    return apiError('Ungültige JSON-Anfrage.', 400)
  }
  return null
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = createCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  let response: NextResponse
  const invalidMutation = await validateMutationRequest(request)
  if (invalidMutation) {
    invalidMutation.headers.set('Content-Security-Policy', csp)
    return invalidMutation
  }
  const isProtectedAdminPage = request.nextUrl.pathname.startsWith('/admin') &&
    request.nextUrl.pathname !== '/admin/login'

  if (isProtectedAdminPage) {
    const token = request.cookies.get('admin-session')?.value
    if (!token || !(await verifySession(token))) {
      response = NextResponse.redirect(new URL('/admin/login', request.url))
      if (token) response.cookies.delete('admin-session')
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } })
    }
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }

  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
