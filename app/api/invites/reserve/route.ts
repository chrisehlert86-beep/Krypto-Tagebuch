import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createFlowToken } from '@/lib/auth'
import { consumeRateLimit, rateLimitResponse } from '@/lib/request-security'
import { isValidInviteCode } from '@/lib/onboarding-validation'

export async function POST(request: Request) {
  try {
    const { inviteCode } = await request.json()

    if (!(await consumeRateLimit(request, 'invite-reserve', 10, 15 * 60))) {
      return rateLimitResponse()
    }

    if (!isValidInviteCode(inviteCode)) {
      return NextResponse.json(
        {
          error: 'Kein Einladungscode angegeben.',
        },
        {
          status: 400,
        }
      )
    }

    const { data, error } =
      await supabaseAdmin.rpc('reserve_invite', {
        p_code: inviteCode,
      })

    if (error) {
      console.error(error)

      return NextResponse.json(
        {
          error: 'Serverfehler.',
        },
        {
          status: 500,
        }
      )
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            'Der Einladungscode ist ungültig oder bereits verwendet.',
        },
        {
          status: 400,
        }
      )
    }

    const response = NextResponse.json({
      success: true,
    })

    response.cookies.set('invite-reservation', await createFlowToken({
      kind: 'invite',
      inviteCode,
    }, '15m'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60,
    })

    return response

  } catch (error) {

    console.error(error)

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
