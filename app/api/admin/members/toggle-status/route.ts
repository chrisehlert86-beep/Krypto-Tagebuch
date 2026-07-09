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

export async function POST(request: Request) {
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

    const { data: member, error: loadError } = await supabaseAdmin
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

    const newStatus =
      member.status === 'active'
        ? 'inactive'
        : 'active'

    const { error } = await supabaseAdmin
      .from('members')
      .update({
        status: newStatus,
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