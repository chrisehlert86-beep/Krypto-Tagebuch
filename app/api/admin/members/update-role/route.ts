import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
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