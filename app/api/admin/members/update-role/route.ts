import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { writeAdminAudit } from '@/lib/admin-audit'
import { isUuid } from '@/lib/onboarding-validation'

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

    if (!isUuid(id) || !role) {
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
    const { data: updated, error } = await supabaseAdmin
      .from('members')
      .update({
        role,
      })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error(error)

      return NextResponse.json(
        {
          error: 'Rolle konnte nicht geändert werden.',
        },
        {
          status: 500,
        }
      )
    }

    if (!updated) {
      return NextResponse.json({ error: 'Mitglied wurde nicht gefunden.' }, { status: 404 })
    }

    await writeAdminAudit('member.role_update', 'member', id, { role })

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
