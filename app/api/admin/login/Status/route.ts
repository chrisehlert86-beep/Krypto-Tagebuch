import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { loginRequestId } = await request.json()

    if (!loginRequestId) {
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
      .select('*')
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