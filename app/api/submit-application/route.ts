import { NextRequest, NextResponse } from 'next/server'

import { DISCLAIMER_VERSION } from '@/constants/app'
import { createFlowToken, verifyFlowToken } from '@/lib/auth'
import { consumeRateLimit, rateLimitResponse } from '@/lib/request-security'
import { acceptedAllDisclaimers, isValidInviteCode, isValidName } from '@/lib/onboarding-validation'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const {
      inviteCode,
      firstName,
      lastName,
      disclaimerRead,
      risksUnderstood,
      noAdviceAcknowledged,
    } = await request.json()

    if (!(await consumeRateLimit(request, 'application-submit', 10, 15 * 60))) {
      return rateLimitResponse()
    }

    if (!isValidInviteCode(inviteCode)) {
      return NextResponse.json({ error: 'Kein Einladungscode übergeben.' }, { status: 400 })
    }
    if (
      !isValidName(firstName) || !isValidName(lastName)
    ) {
      return NextResponse.json({ error: 'Ungültige persönliche Angaben.' }, { status: 400 })
    }
    if (!acceptedAllDisclaimers([disclaimerRead, risksUnderstood, noAdviceAcknowledged])) {
      return NextResponse.json({ error: 'Alle Hinweise müssen bestätigt werden.' }, { status: 400 })
    }

    const inviteToken = request.cookies.get('invite-reservation')?.value
    const telegramToken = request.cookies.get('telegram-auth')?.value
    const invite = inviteToken ? await verifyFlowToken(inviteToken, 'invite') : null
    const telegram = telegramToken ? await verifyFlowToken(telegramToken, 'telegram') : null

    if (invite?.inviteCode !== inviteCode || typeof telegram?.telegramUserId !== 'string') {
      return NextResponse.json({ error: 'Die Anmeldung ist abgelaufen oder ungültig.' }, { status: 401 })
    }

    const { data: applicationId, error } = await supabaseAdmin.rpc('submit_application', {
      p_invite_code: inviteCode,
      p_first_name: firstName,
      p_last_name: lastName,
      p_telegram_user_id: telegram.telegramUserId,
      p_telegram_username: typeof telegram.telegramUsername === 'string'
        ? telegram.telegramUsername
        : '',
      p_disclaimer_version: DISCLAIMER_VERSION,
    })

    if (error || typeof applicationId !== 'string') {
      console.error(error)
      const unavailable = error?.message.includes('invite_unavailable') ?? false
      return NextResponse.json(
        { error: unavailable ? 'Die Einladung ist nicht mehr verfügbar.' : 'Die Bewerbung konnte nicht gespeichert werden.' },
        { status: unavailable ? 409 : 500 },
      )
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete('invite-reservation')
    response.cookies.delete('telegram-auth')
    response.cookies.set('application-status', await createFlowToken({
      kind: 'application',
      applicationId,
    }, '30d'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 })
  }
}
