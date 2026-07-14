import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { verifySession } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin/login') return NextResponse.next()

  const token = request.cookies.get('admin-session')?.value
  if (token && await verifySession(token)) return NextResponse.next()

  const response = NextResponse.redirect(new URL('/admin/login', request.url))
  if (token) response.cookies.delete('admin-session')
  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
