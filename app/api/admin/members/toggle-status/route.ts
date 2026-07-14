import { NextResponse } from 'next/server'

import { writeAdminAudit } from '@/lib/admin-audit'
import { requireAdmin } from '@/lib/require-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/lib/onboarding-validation'

type StatusChange = { status: string; command: string }

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  try {
    const { id } = await request.json()
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Mitglied wurde nicht gefunden.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('queue_member_status_change', {
      p_member_id: id,
    })
    if (error) throw error

    const change = (Array.isArray(data) ? data[0] : null) as StatusChange | null
    if (!change) {
      return NextResponse.json({ error: 'Mitglied wurde nicht gefunden.' }, { status: 404 })
    }

    await writeAdminAudit('member.status_update', 'member', id, change)
    return NextResponse.json({
      success: true,
      status: change.status,
      telegramSyncStatus: 'pending',
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Mitgliedsstatus konnte nicht mit Telegram synchronisiert werden.' },
      { status: 500 },
    )
  }
}
