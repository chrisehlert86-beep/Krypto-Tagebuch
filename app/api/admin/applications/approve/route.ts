import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        {
          error: 'Keine Bewerbungs-ID übergeben.',
        },
        {
          status: 400,
        }
      )
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        'approve_application',
        {
          p_application_id: id,
        }
      )

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

    if (!data) {
      return NextResponse.json(
        {
          error: 'Bewerbung konnte nicht freigegeben werden.',
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