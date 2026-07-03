import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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