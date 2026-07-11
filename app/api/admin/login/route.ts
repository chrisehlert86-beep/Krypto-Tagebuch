import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'


export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    /*
     * Eingaben prüfen
     */
    if (!username || !password) {
      return NextResponse.json(
        {
          error: 'Benutzername und Passwort sind erforderlich.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Benutzername prüfen
     */
    if (username !== process.env.ADMIN_USERNAME) {
      return NextResponse.json(
        {
          error: 'Ungültige Anmeldedaten.',
        },
        {
          status: 401,
        }
      )
    }

    /*
     * Passwort prüfen
     */
    const valid = await verifyPassword(password)

    if (!valid) {
      return NextResponse.json(
        {
          error: 'Ungültige Anmeldedaten.',
        },
        {
          status: 401,
        }
      )
    }

    /*
     * Clientinformationen ermitteln
     */
    const forwarded = request.headers.get('x-forwarded-for')

    const ip =
      forwarded?.split(',')[0].trim() ??
      'unknown'

    const userAgent =
      request.headers.get('user-agent') ??
      'unknown'

    /*
     * Login-Anfrage erzeugen
     */
    const createdAt = new Date()

    const expiresAt = new Date(
      createdAt.getTime() + 5 * 60 * 1000
    )

    const { data, error } = await supabaseAdmin
      .from('admin_login_requests')
      .insert({
        approved: false,
        rejected: false,
        ip_address: ip,
        user_agent: userAgent,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
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

    /*
     * Login-ID an Frontend zurückgeben
     */
    return NextResponse.json({
      success: true,
      loginRequestId: data.id,
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