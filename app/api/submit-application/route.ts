import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyFlowToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const {
      inviteCode,
      firstName,
      lastName,
      disclaimerVersion,
    } = await request.json()

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Kein Einladungscode übergeben.' },
        { status: 400 }
      )
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Vorname und Nachname sind erforderlich.' },
        { status: 400 }
      )
    }

    if (typeof firstName !== 'string' || typeof lastName !== 'string' ||
        firstName.trim().length > 100 || lastName.trim().length > 100) {
      return NextResponse.json(
        { error: 'Ungültige persönliche Angaben.' },
        { status: 400 }
      )
    }

    const inviteToken = request.cookies.get('invite-reservation')?.value
    const telegramToken = request.cookies.get('telegram-auth')?.value
    const invite = inviteToken ? await verifyFlowToken(inviteToken, 'invite') : null
    const telegram = telegramToken ? await verifyFlowToken(telegramToken, 'telegram') : null

    if (invite?.inviteCode !== inviteCode || typeof telegram?.telegramUserId !== 'string') {
      return NextResponse.json({ error: 'Die Anmeldung ist abgelaufen oder ungültig.' }, { status: 401 })
    }

    const now = new Date().toISOString()
    const { data: claimedInvite, error: claimError } = await supabaseAdmin
      .from('invites')
      .update({ used: true, used_at: now, reserved: false, reserved_until: null, reserved_at: null })
      .eq('invite_code', inviteCode)
      .eq('active', true)
      .eq('used', false)
      .eq('reserved', true)
      .gt('reserved_until', now)
      .select('id')
      .maybeSingle()

    if (claimError || !claimedInvite) {
      return NextResponse.json({ error: 'Die Einladung ist nicht mehr verfügbar.' }, { status: 409 })
    }

    /*
     * Bewerbung speichern
     * (Invite ist bereits reserviert → KEIN consume_invite mehr)
     */
    const { error: applicationError } = await supabaseAdmin
      .from('applications')
      .insert({
        invite_code: inviteCode,
        first_name: firstName.trim(),
        last_name: lastName.trim(),

        telegram_user_id: telegram.telegramUserId,
        telegram_username: typeof telegram.telegramUsername === 'string' ? telegram.telegramUsername : null,
        telegram_verified: true,

        disclaimer_accepted: true,
        disclaimer_version: disclaimerVersion || 'v1',

        status: 'pending',
      })

    if (applicationError) {
      console.error(applicationError)

      /*
       * Reservierung wieder freigeben (Rollback)
       */
      await supabaseAdmin
        .from('invites')
        .update({
          used: false,
          used_at: null,
        })
        .eq('invite_code', inviteCode)

      return NextResponse.json(
        {
          error: applicationError.message,
        },
        {
          status: 500,
        }
      )
    }

    const response = NextResponse.json({
      success: true,
    })
    response.cookies.delete('invite-reservation')
    response.cookies.delete('telegram-auth')
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
