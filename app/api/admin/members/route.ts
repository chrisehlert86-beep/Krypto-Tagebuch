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
    /*
     * Mitglieder laden
     */
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('id,first_name,last_name,invite_code,status,created_at,telegram_sync_status,telegram_sync_error,telegram_synced_at')
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error(error)

      return NextResponse.json(
        {
          error: 'Mitglieder konnten nicht geladen werden.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json(data)

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
