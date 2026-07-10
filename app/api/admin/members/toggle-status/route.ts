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
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        {
          error: 'Mitglied nicht gefunden.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Aktuellen Status laden
     */
    const { data: member, error: loadError } =
      await supabaseAdmin
        .from('members')
        .select('status')
        .eq('id', id)
        .single()

    if (loadError || !member) {
      return NextResponse.json(
        {
          error: 'Mitglied nicht gefunden.',
        },
        {
          status: 404,
        }
      )
    }

    /*
     * Status umschalten
     */
    const newStatus =
      member.status === 'active'
        ? 'inactive'
        : 'active'

    const { error: updateError } =
      await supabaseAdmin
        .from('members')
        .update({
          status: newStatus,
        })
        .eq('id', id)

    if (updateError) {
      console.error(updateError)

      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
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