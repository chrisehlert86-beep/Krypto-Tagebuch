import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { createSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {

    const { loginRequestId } = await request.json()

    if (!loginRequestId) {
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
    const { data, error } = await supabaseAdmin
      .from('admin_login_requests')
      .select(
        'approved,rejected,approved_at,expires_at'
      )
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
     * Abgelehnt?
     */
    if (data.rejected) {
      return NextResponse.json(
        {
          error: 'Login wurde abgelehnt.',
        },
        {
          status: 401,
        }
      )
    }

    /*
     * Noch nicht bestätigt?
     */
    if (!data.approved || !data.approved_at) {
      return NextResponse.json(
        {
          error: 'Login wurde noch nicht bestätigt.',
        },
        {
          status: 401,
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
      return NextResponse.json(
        {
          error: 'Login ist abgelaufen.',
        },
        {
          status: 401,
        }
      )
    }

    /*
     * Session erzeugen
     */
    const token = await createSession()

    /*
     * Cookie setzen
     */
    const cookieStore = await cookies()

    cookieStore.set({
      name: 'admin-session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 12,
    })

    /*
     * Login-Anfrage entfernen
     */
    await supabaseAdmin
      .from('admin_login_requests')
      .delete()
      .eq('id', loginRequestId)

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