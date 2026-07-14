import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/require-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const allowedCommands = new Set(['restart', 'test_message'])

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  try {
    const { command } = await request.json()

    if (typeof command !== 'string' || !allowedCommands.has(command)) {
      return NextResponse.json({ error: 'Unbekannter Bot-Befehl.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('bot_commands')
      .insert({ command, status: 'pending' })
      .select('id')
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Bot-Befehl konnte nicht gespeichert werden.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, commandId: data.id })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 })
  }
}
