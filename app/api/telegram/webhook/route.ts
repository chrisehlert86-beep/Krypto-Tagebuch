import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const update = await request.json()

    const joinRequest = update.chat_join_request

    if (!joinRequest) {
      return NextResponse.json({
        ok: true,
      })
    }

    const telegramUserId = joinRequest.from.id
    const username = joinRequest.from.username ?? null

    const { error } = await supabaseAdmin
      .from('applications')
      .update({
        telegram_join_requested: true,
        telegram_join_date: new Date().toISOString(),
      })
      .eq('telegram_user_id', telegramUserId)

    if (error) {
      console.error(error)
    }

    console.log(
      'Join Request:',
      telegramUserId,
      username
    )

    return NextResponse.json({
      ok: true,
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        error: 'Serverfehler',
      },
      {
        status: 500,
      }
    )
  }
}