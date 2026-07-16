import 'server-only'

import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
}

function getRateLimitSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error('ADMIN_SESSION_SECRET fehlt.')
  return secret
}

export async function consumeRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
  discriminator = '',
) {
  const keyHash = createHmac('sha256', getRateLimitSecret())
    .update(`${bucket}:${getClientIp(request)}:${discriminator}`)
    .digest('hex')

  const { data, error } = await supabaseAdmin.rpc('consume_api_rate_limit', {
    p_bucket: bucket,
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  })

  if (error) throw error
  return data === true
}

export async function consumeRateLimitValue(
  bucket: string,
  value: string,
  limit: number,
  windowSeconds: number,
) {
  const keyHash = createHmac('sha256', getRateLimitSecret())
    .update(`${bucket}:${value}`)
    .digest('hex')

  const { data, error } = await supabaseAdmin.rpc('consume_api_rate_limit', {
    p_bucket: bucket,
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  })

  if (error) throw error
  return data === true
}

export function rateLimitResponse() {
  return NextResponse.json(
    { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
    { status: 429, headers: { 'Retry-After': '900' } },
  )
}
