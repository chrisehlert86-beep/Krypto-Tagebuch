import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { revokeSession } from '@/lib/auth'
import { writeAdminAudit } from '@/lib/admin-audit'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin-session')?.value
  if (token) {
    await revokeSession(token)
    await writeAdminAudit('admin.logout', 'admin_session')
  }

  const response = NextResponse.json({
    success: true,
  })

  /*
   * Admin-Session löschen
   */
  response.cookies.set({
    name: 'admin-session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })

  return response
}
