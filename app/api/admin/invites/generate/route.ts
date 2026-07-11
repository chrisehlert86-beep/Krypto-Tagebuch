import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'


export async function POST(request: Request) {
  /*
   * Admin-Berechtigung prüfen
   */
  const authorized = await requireAdmin()

  if (!authorized) {
    return NextResponse.json(
      {
        error: 'Nicht autorisiert.',
      },
      {
        status: 401,
      }
    )
  }

  try {
    const { amount } = await request.json()

    const count = Number(amount)

    if (![1, 5, 10, 50].includes(count)) {
      return NextResponse.json(
        {
          error: 'Ungültige Anzahl.',
        },
        {
          status: 400,
        }
      )
    }

    const invites = []

    while (invites.length < count) {
      const code = InviteCode()

      /*
       * Existiert der Code bereits?
       */
      const { data } = await supabaseAdmin
        .from('invites')
        .select('id')
        .eq('invite_code', code)
        .maybeSingle()

      if (data) {
        continue
      }

      invites.push({
        invite_code: code,
        active: true,
        used: false,
      })
    }

    /*
     * Codes speichern
     */
    const { error } = await supabaseAdmin
      .from('invites')
      .insert(invites)

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      success: true,
      created: invites.length,
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