import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { writeAdminAudit } from '@/lib/admin-audit'

export async function POST(request: NextRequest) {
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
        .select('id,used,active')
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
     * niemals geändert werden.
     */
    if (invite.used) {
      return NextResponse.json(
        {
          error: 'Verwendete Einladung kann nicht geändert werden.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Status umschalten
     */
    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from('invites')
        .update({
          active: !invite.active,
        })
        .eq('id', invite.id)
        .eq('active', invite.active)
        .eq('used', false)
        .select('id')
        .maybeSingle()

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        }
      )
    }

    if (!updated) {
      return NextResponse.json({ error: 'Einladung wurde zwischenzeitlich geändert.' }, { status: 409 })
    }

    await writeAdminAudit('invite.toggle', 'invite', invite.id, { active: !invite.active })

    return NextResponse.json({
      success: true,
      active: !invite.active,
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
