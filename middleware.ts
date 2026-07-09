import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  /*
   * Login darf immer erreichbar sein
   */
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  /*
   * Nur Admin-Bereich schützen
   */
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const token =
    request.cookies.get('admin-session')?.value

  if (!token) {
    return NextResponse.redirect(
      new URL('/admin/login', request.url)
    )
  }

  const valid = await verifySession(token)

  if (!valid) {
    const response = NextResponse.redirect(
      new URL('/admin/login', request.url)
    )

    response.cookies.delete('admin-session')

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}