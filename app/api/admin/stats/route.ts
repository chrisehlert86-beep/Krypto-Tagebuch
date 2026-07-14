import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'

export async function GET() {
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

    const [
      members,
      pendingApplications,
      totalInvites,
      availableInvites,
    ] = await Promise.all([

      /*
       * Mitglieder
       */
      supabaseAdmin
        .from('members')
        .select('*', {
          count: 'exact',
          head: true,
        }),

      /*
       * Offene Bewerbungen
       */
      supabaseAdmin
        .from('applications')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'pending'),

      /*
       * Alle Einladungscodes
       */
      supabaseAdmin
        .from('invites')
        .select('*', {
          count: 'exact',
          head: true,
        }),

      /*
       * Verfügbare Einladungscodes
       */
      supabaseAdmin
        .from('invites')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('active', true)
        .eq('used', false),

    ])

    const queryError = [members, pendingApplications, totalInvites, availableInvites]
      .find((result) => result.error)?.error

    if (queryError) {
      console.error(queryError)
      return NextResponse.json(
        { error: 'Statistiken konnten nicht geladen werden.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      pending: pendingApplications.count ?? 0,

      members: members.count ?? 0,

      invites: {
        total: totalInvites.count ?? 0,
        available: availableInvites.count ?? 0,
      },
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        error: 'Statistiken konnten nicht geladen werden.',
      },
      {
        status: 500,
      }
    )
  }
}
