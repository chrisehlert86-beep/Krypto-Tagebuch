import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { createSession, verifyFlowToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { writeAdminAudit } from '@/lib/admin-audit'
import { consumeRateLimit, rateLimitResponse } from '@/lib/request-security'

export async function POST(request: Request) {
  try {

    const { loginRequestId } = await request.json()

    if (!(await consumeRateLimit(request, 'admin-session', 10, 15 * 60))) {
      return rateLimitResponse()
    }

    const cookieStore = await cookies()
    const flowToken = cookieStore.get('admin-login-flow')?.value
    const flow = flowToken ? await verifyFlowToken(flowToken, 'adminLogin') : null

    if (
      typeof loginRequestId !== 'string' ||
      typeof flow?.loginRequestId !== 'string' ||
      flow.loginRequestId !== loginRequestId
    ) {
      return NextResponse.json(
        {
          error: 'Login-ID fehlt.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Login-Anfrage laden
     */
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('admin_login_requests')
      .delete()
      .eq('id', loginRequestId)
      .eq('approved', true)
      .eq('rejected', false)
      .not('approved_at', 'is', null)
      .gt('expires_at', now)
      .select('id')
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        {
          error: 'Login-Anfrage ist ungültig, nicht bestätigt oder abgelaufen.',
        },
        {
        status: 401,
        }
      )
    }

    /*
     * Session erzeugen
     */
    const { token, sessionId } = await createSession()

    /*
     * Cookie setzen
     */
    cookieStore.set({
      name: 'admin-session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 12,
    })
    cookieStore.delete('admin-login-flow')

    await writeAdminAudit('admin.login', 'admin_session', sessionId)

    return NextResponse.json({
      success: true,
    })

  } catch (err) {

    console.error(err)

    return NextResponse.json(
      {
        error: 'Interner Serverfehler.',
      },
      {
        status: 500,
      }
    )
  }
}
