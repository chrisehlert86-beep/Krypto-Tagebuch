import { performance } from 'node:perf_hooks'

import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/require-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BOT_OFFLINE_AFTER_MS = 90_000

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  const startedAt = performance.now()
  const { data, error } = await supabaseAdmin
    .from('bot_runtime')
    .select('last_heartbeat,started_at,version')
    .eq('id', 'telegram-bot')
    .maybeSingle()
  const responseTimeMs = Math.round(performance.now() - startedAt)

  if (error) {
    console.error(error)
    return NextResponse.json({
      websiteOnline: true,
      supabaseReachable: false,
      supabaseResponseTimeMs: responseTimeMs,
      botOnline: false,
      lastHeartbeat: null,
      error: 'Supabase-Status konnte nicht abgerufen werden.',
    })
  }

  const lastHeartbeat = data?.last_heartbeat ?? null
  const heartbeatAge = lastHeartbeat
    ? Date.now() - new Date(lastHeartbeat).getTime()
    : Number.POSITIVE_INFINITY

  return NextResponse.json({
    websiteOnline: true,
    supabaseReachable: true,
    supabaseResponseTimeMs: responseTimeMs,
    botOnline: heartbeatAge <= BOT_OFFLINE_AFTER_MS,
    lastHeartbeat,
    botStartedAt: data?.started_at ?? null,
    botVersion: data?.version ?? null,
  })
}
