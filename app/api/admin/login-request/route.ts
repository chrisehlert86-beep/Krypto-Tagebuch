import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for')

    const ip =
      forwarded?.split(',')[0].trim() ??
      'unknown'

    const userAgent =
      request.headers.get('user-agent') ??
      'unknown'

    const { data, error } = await supabaseAdmin
      .from('admin_login_requests')
      .insert({
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (error) {
      console.error(error)

      return NextResponse.json(
        {
          error: 'Login-Anfrage konnte nicht erstellt werden.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
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