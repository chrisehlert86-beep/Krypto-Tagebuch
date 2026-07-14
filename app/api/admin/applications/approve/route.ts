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
    const { id } = await request.json()

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error: 'Keine Bewerbungs-ID übergeben.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * Bewerbung laden
     */
    const { data: application, error: loadError } =
      await supabaseAdmin
        .from('applications')
        .select('id,status')
        .eq('id', id)
        .single()

    if (loadError || !application) {
      return NextResponse.json(
        {
          error: 'Bewerbung wurde nicht gefunden.',
        },
        {
          status: 404,
        }
      )
    }

    /*
     * Bereits freigegeben?
     */
    if (
      application.status === 'approved' ||
      application.status === 'active'
    ) {
      return NextResponse.json({
        success: true,
      })
    }

    /*
     * Bewerbung freigeben.
     * Den Rest übernimmt der Telegram-Bot.
     */
    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from('applications')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          rejected_at: null,
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

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

    if (!updated) {
      return NextResponse.json(
        { error: 'Die Bewerbung wurde zwischenzeitlich geändert.' },
        { status: 409 },
      )
    }

    await writeAdminAudit('application.approve', 'application', id)

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
