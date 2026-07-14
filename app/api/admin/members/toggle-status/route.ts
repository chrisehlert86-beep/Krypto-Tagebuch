import { NextResponse } from 'next/server'

import { writeAdminAudit } from '@/lib/admin-audit'
import { requireAdmin } from '@/lib/require-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  try {
    const { id } = await request.json()
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Mitglied wurde nicht gefunden.' }, { status: 400 })
    }

    const { data: member, error: loadError } = await supabaseAdmin
      .from('members')
      .select('id,status,telegram_user_id,first_name')
      .eq('id', id)
      .maybeSingle()

    if (loadError || !member) {
      return NextResponse.json({ error: 'Mitglied wurde nicht gefunden.' }, { status: 404 })
    }

    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    const command = newStatus === 'inactive' ? 'member_suspend' : 'member_restore'

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('members')
      .update({
        status: newStatus,
        telegram_sync_status: 'pending',
        telegram_sync_error: null,
      })
      .eq('id', id)
      .eq('status', member.status)
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updated) {
      return NextResponse.json(
        { error: 'Mitglied wurde zwischenzeitlich geändert.' },
        { status: 409 },
      )
    }

    const { error: commandError } = await supabaseAdmin.from('bot_commands').insert({
      command,
      status: 'pending',
      payload: {
        memberId: member.id,
        telegramUserId: member.telegram_user_id,
        firstName: member.first_name,
      },
    })

    if (commandError) {
      await supabaseAdmin
        .from('members')
        .update({ status: member.status, telegram_sync_status: 'failed', telegram_sync_error: 'Bot-Auftrag konnte nicht erstellt werden.' })
        .eq('id', id)
      throw commandError
    }

    await writeAdminAudit('member.status_update', 'member', id, { status: newStatus, command })
    return NextResponse.json({ success: true, status: newStatus, telegramSyncStatus: 'pending' })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Mitgliedsstatus konnte nicht mit Telegram synchronisiert werden.' },
      { status: 500 },
    )
  }
}
