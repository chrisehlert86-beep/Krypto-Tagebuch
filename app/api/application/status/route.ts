import { NextRequest, NextResponse } from 'next/server'

import { verifyFlowToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('application-status')?.value
  const application = token
    ? await verifyFlowToken(token, 'application')
    : null

  if (typeof application?.applicationId !== 'string') {
    return NextResponse.json(
      { error: 'Deine Bewerbungssitzung ist abgelaufen.' },
      { status: 401 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('status,telegram_invite_link,telegram_invite_link_expires_at,created_at')
    .eq('id', application.applicationId)
    .maybeSingle()

  if (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Der Bewerbungsstatus konnte nicht geladen werden.' },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Die Bewerbung wurde nicht gefunden.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    status: data.status,
    telegramInviteLink: data.telegram_invite_link,
    telegramInviteLinkExpiresAt: data.telegram_invite_link_expires_at,
    telegramInviteExpired: Boolean(
      data.telegram_invite_link_expires_at &&
      new Date(data.telegram_invite_link_expires_at).getTime() <= Date.now()
    ),
    createdAt: data.created_at,
  })
}
