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
        {
          error: 'Kein Einladungscode übergeben.',
        },
        {
          status: 400,
        }
      )
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        {
          error: 'Vorname und Nachname sind erforderlich.',
        },
        {
          status: 400,
        }
      )
    }

    if (!telegramUserId) {
      return NextResponse.json(
        {
          error: 'Telegram wurde noch nicht verbunden.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Einladungscode atomar verbrauchen
     */
    const {
      data: consumed,
      error: consumeError,
    } = await supabaseAdmin.rpc('consume_invite', {
      p_code: inviteCode,
    })

    if (consumeError) {
      console.error(consumeError)

      return NextResponse.json(
        {
          error: 'Einladungscode konnte nicht geprüft werden.',
        },
        {
          status: 500,
        }
      )
    }

    if (!consumed) {
      return NextResponse.json(
        {
          error:
            'Der Einladungscode wurde bereits verwendet oder ist ungültig.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Bewerbung speichern
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
       * Einladungscode wieder freigeben
       */
      await supabaseAdmin
        .from('invites')
        .update({
          used: false,
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