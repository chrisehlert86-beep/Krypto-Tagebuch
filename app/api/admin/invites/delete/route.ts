import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { writeAdminAudit } from '@/lib/admin-audit'

export async function DELETE(request: NextRequest) {
  /*
   * Admin prüfen
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
          error: 'Keine Invite-ID übergeben.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Einladung laden
     */
    const { data: invite, error: loadError } =
      await supabaseAdmin
        .from('invites')
        .select('id, used')
        .eq('id', id)
        .single()

    if (loadError || !invite) {
      return NextResponse.json(
        {
          error: 'Einladung nicht gefunden.',
        },
        {
          status: 404,
        }
      )
    }

    /*
     * Bereits verwendete Codes dürfen
     * niemals gelöscht werden.
     */
    if (invite.used) {
      return NextResponse.json(
        {
          error: 'Verwendete Einladung kann nicht gelöscht werden.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Einladung löschen
     */
    const { data: deleted, error: deleteError } =
      await supabaseAdmin
        .from('invites')
        .delete()
        .eq('id', invite.id)
        .eq('used', false)
        .select('id')
        .maybeSingle()

    if (deleteError) {
      return NextResponse.json(
        {
          error: 'Einladung konnte nicht gelöscht werden.',
        },
        {
          status: 500,
        }
      )
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Einladung wurde zwischenzeitlich geändert.' }, { status: 409 })
    }

    await writeAdminAudit('invite.delete', 'invite', invite.id)

    return NextResponse.json({
      success: true,
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
