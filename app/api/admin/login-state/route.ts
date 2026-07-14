import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyFlowToken } from '@/lib/auth'
import { consumeRateLimit, rateLimitResponse } from '@/lib/request-security'
import { isUuid } from '@/lib/onboarding-validation'

export async function POST(request: NextRequest) {
  try {
    const { loginRequestId } = await request.json()

    if (!(await consumeRateLimit(request, 'admin-login-state', 60, 5 * 60))) {
      return rateLimitResponse()
    }

    const flowToken = request.cookies.get('admin-login-flow')?.value
    const flow = flowToken ? await verifyFlowToken(flowToken, 'adminLogin') : null

    if (
      !isUuid(loginRequestId) ||
      typeof flow?.loginRequestId !== 'string' ||
      flow.loginRequestId !== loginRequestId
    ) {
      return NextResponse.json(
        {
          error: 'Login-Request-ID fehlt.',
        },
        {
          status: 400,
        }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('admin_login_requests')
      .select('approved,rejected,expires_at')
      .eq('id', loginRequestId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        {
          error: 'Login-Anfrage nicht gefunden.',
        },
        {
          status: 404,
        }
      )
    }

    /*
     * Abgelaufen?
     */
    if (
      data.expires_at &&
      new Date(data.expires_at) < new Date()
    ) {
      return NextResponse.json({
        expired: true,
        approved: false,
        rejected: false,
      })
    }

    /*
     * Abgelehnt?
     */
    if (data.rejected) {
      return NextResponse.json({
        expired: false,
        approved: false,
        rejected: true,
      })
    }

    /*
     * Genehmigt?
     */
    if (data.approved) {
      return NextResponse.json({
        expired: false,
        approved: true,
        rejected: false,
      })
    }

    /*
     * Wartet noch
     */
    return NextResponse.json({
      expired: false,
      approved: false,
      rejected: false,
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
