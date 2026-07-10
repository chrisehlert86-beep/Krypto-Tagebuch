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
    const { id, role } = await request.json()

    if (!id || !role) {
      return NextResponse.json(
        {
          error: 'Ungültige Anfrage.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Zulässige Rollen prüfen
     */
    if (!['member', 'admin'].includes(role)) {
      return NextResponse.json(
        {
          error: 'Ungültige Rolle.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Rolle aktualisieren
     */
    const { error } = await supabaseAdmin
      .from('members')
      .update({
        role,
      })
      .eq('id', id)

    if (error) {
      console.error(error)

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
      role,
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