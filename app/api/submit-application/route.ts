import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const {
      inviteCode,
      firstName,
      lastName,
      telegramUserId,
      telegramUsername,
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

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Telegram wurde noch nicht verbunden.' },
        { status: 400 }
      )
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

        telegram_user_id: Number(telegramUserId),
        telegram_username: telegramUsername || null,
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
          reserved: false,
          reserved_until: null,
          reserved_at: null,
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

    /*
     * Invite final als genutzt markieren
     */
    await supabaseAdmin
      .from('invites')
      .update({
        used: true,
        used_at: new Date().toISOString(),

        reserved: false,
        reserved_until: null,
        reserved_at: null,
      })
      .eq('invite_code', inviteCode)

    return NextResponse.json({
      success: true,
    })
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