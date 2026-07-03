import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { inviteCode } = await request.json()

    if (!inviteCode) {
      return NextResponse.json(
        {
          error: 'Kein Einladungscode angegeben.',
        },
        {
          status: 400,
        }
      )
    }

    const { data, error } =
      await supabaseAdmin.rpc('reserve_invite', {
        p_code: inviteCode,
      })

    if (error) {
      console.error(error)

      return NextResponse.json(
        {
          error: 'Serverfehler.',
        },
        {
          status: 500,
        }
      )
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            'Der Einladungscode ist ungültig oder bereits verwendet.',
        },
        {
          status: 400,
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