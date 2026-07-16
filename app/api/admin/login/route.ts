import { NextRequest, NextResponse } from 'next/server'
import { createFlowToken, verifyPassword } from '@/lib/auth'
import {
  consumeRateLimit,
  consumeRateLimitValue,
  getClientIp,
  rateLimitResponse,
} from '@/lib/request-security'
import { supabaseAdmin } from '@/lib/supabase-admin'
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    /*
     * Eingaben prüfen
     */
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      password.length < 1 ||
      username.length > 100 ||
      password.length > 200
    ) {
      return NextResponse.json(
        {
          error: 'Benutzername und Passwort sind erforderlich.',
        },
        {
          status: 400,
        }
      )
    }

    const normalizedUsername = username.trim()
    const ipAllowed = await consumeRateLimit(request, 'admin-login-ip', 20, 15 * 60)
    const accountAllowed = await consumeRateLimitValue(
      'admin-login-account', normalizedUsername.toLowerCase(), 5, 15 * 60,
    )
    if (!ipAllowed || !accountAllowed) return rateLimitResponse()

    /*
     * Benutzername prüfen
     */
    const validPassword = await verifyPassword(password)
    const validUsername = normalizedUsername === process.env.ADMIN_USERNAME

    if (!validUsername || !validPassword) {
      return NextResponse.json(
        { error: 'Ungültige Anmeldedaten.' },
        { status: 401 }
      )
    }

    /*
     * Clientinformationen ermitteln
     */
    const ip = getClientIp(request)

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
    const response = NextResponse.json({
      success: true,
      loginRequestId: data.id,
    })
    response.cookies.set('admin-login-flow', await createFlowToken({
      kind: 'adminLogin',
      loginRequestId: data.id,
    }, '5m'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 5 * 60,
    })
    return response

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
