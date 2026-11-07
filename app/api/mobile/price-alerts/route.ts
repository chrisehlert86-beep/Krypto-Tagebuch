import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseAlarmPrice, validAlarmInput, installationAuthorization } from '@/lib/price-alert-validation'
import { isUuid } from '@/lib/onboarding-validation'
import { consumeRateLimit, rateLimitResponse } from '@/lib/request-security'

const FIELDS = 'id,symbol,crossing,price,status,created_at,triggered_at,triggered_price,notified_at'
const HEADERS = { 'Cache-Control': 'private, no-store' }

function owner(request: Request) {
  const value = installationAuthorization(request.headers.get('authorization'))
  return value ? createHash('sha256').update(value).digest('hex') : null
}
function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: HEADERS })
}
async function body(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 8192) throw new Error('body too large')
  const raw = await request.text()
  if (raw.length > 8192) throw new Error('body too large')
  return JSON.parse(raw)
}

export async function GET(request: Request) {
  const hash = owner(request)
  if (!hash) return failure('Nicht autorisiert.', 401)
  try {
    const { data, error } = await supabaseAdmin.from('market_price_alerts').select(FIELDS)
      .eq('owner_hash', hash).in('status', ['active', 'triggered'])
      .order('status').order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    return NextResponse.json({ alerts: data ?? [] }, { headers: HEADERS })
  } catch { return failure('Preisalarme konnten nicht geladen werden.', 503) }
}

export async function POST(request: Request) {
  const hash = owner(request)
  if (!hash) return failure('Nicht autorisiert.', 401)
  try {
    if (!(await consumeRateLimit(request, 'price-alert-create', 30, 3600))) return rateLimitResponse()
    const input: unknown = await body(request)
    if (!validAlarmInput(input)) return failure('Bitte Coin, über/unter und einen gültigen USDT-Kurs eingeben.', 400)
    const { count, error: countError } = await supabaseAdmin.from('market_price_alerts')
      .select('id', { count: 'exact', head: true }).eq('owner_hash', hash).eq('status', 'active')
    if (countError) throw countError
    if ((count ?? 0) >= 20) return failure('Maximal 20 aktive Preisalarme pro Gerät.', 409)
    const { data, error } = await supabaseAdmin.from('market_price_alerts').insert({
      id: randomUUID(), owner_hash: hash, symbol: input.symbol, crossing: input.crossing,
      price: parseAlarmPrice(input.price), push_token: input.pushToken ?? null,
    }).select(FIELDS).single()
    if (error) throw error
    return NextResponse.json({ alert: data }, { status: 201, headers: HEADERS })
  } catch (error) {
    return failure(error instanceof SyntaxError || (error instanceof Error && error.message === 'body too large')
      ? 'Ungültige Eingabe.' : 'Preisalarm konnte nicht gespeichert werden.',
    error instanceof SyntaxError || (error instanceof Error && error.message === 'body too large') ? 400 : 503)
  }
}

export async function DELETE(request: Request) {
  const hash = owner(request)
  if (!hash) return failure('Nicht autorisiert.', 401)
  try {
    if (!(await consumeRateLimit(request, 'price-alert-cancel', 60, 3600))) return rateLimitResponse()
    const input = await body(request)
    if (!isUuid(input?.id)) return failure('Ungültiger Alarm.', 400)
    const { data, error } = await supabaseAdmin.from('market_price_alerts').update({ status: 'cancelled' })
      .eq('id', input.id).eq('owner_hash', hash).eq('status', 'active').select('id')
    if (error) throw error
    return data?.length ? NextResponse.json({ cancelled: true }, { headers: HEADERS }) : failure('Kein aktiver Alarm gefunden.', 404)
  } catch { return failure('Preisalarm konnte nicht deaktiviert werden.', 503) }
}

export async function PATCH(request: Request) {
  const hash = owner(request)
  if (!hash) return failure('Nicht autorisiert.', 401)
  try {
    if (!(await consumeRateLimit(request, 'price-alert-device', 30, 3600))) return rateLimitResponse()
    const input = await body(request)
    if (typeof input?.pushToken !== 'string' || input.pushToken.length < 20 || input.pushToken.length > 4096) return failure('Ungültiges Benachrichtigungsziel.', 400)
    const { error } = await supabaseAdmin.from('market_price_alerts').update({ push_token: input.pushToken })
      .eq('owner_hash', hash).is('notified_at', null).neq('status', 'cancelled')
    if (error) throw error
    return NextResponse.json({ updated: true }, { headers: HEADERS })
  } catch { return failure('Benachrichtigungen konnten nicht aktualisiert werden.', 503) }
}
