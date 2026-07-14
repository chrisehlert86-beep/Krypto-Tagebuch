import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

import { createFlowToken } from '@/lib/auth'
import { consumeRateLimit, rateLimitResponse } from '@/lib/request-security'

type TelegramAuth = {
  id?: number | string
  auth_date?: number
  hash?: string
  username?: string
  [key: string]: unknown
}

function isValidTelegramAuth(user: TelegramAuth, botToken: string) {
  if (!user.hash || !user.id || !user.auth_date) return false

  const age = Math.floor(Date.now() / 1000) - user.auth_date
  if (age < 0 || age > 5 * 60) return false

  const checkString = Object.entries(user)
    .filter(([key, value]) => key !== 'hash' && value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n')

  const secret = createHash('sha256').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(checkString).digest()

  try {
    const received = Buffer.from(user.hash, 'hex')
    return received.length === expected.length && timingSafeEqual(received, expected)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!(await consumeRateLimit(request, 'telegram-auth', 20, 15 * 60))) {
    return rateLimitResponse()
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: 'Telegram ist nicht konfiguriert.' }, { status: 503 })
  }

  const user = await request.json() as TelegramAuth
  if (!isValidTelegramAuth(user, botToken)) {
    return NextResponse.json({ error: 'Ungültige Telegram-Anmeldung.' }, { status: 401 })
  }

  const telegramUserId = String(user.id)
  const telegramUsername = typeof user.username === 'string' ? user.username : undefined
  const response = NextResponse.json({ telegramUserId, telegramUsername })

  response.cookies.set('telegram-auth', await createFlowToken({
    kind: 'telegram',
    telegramUserId,
    telegramUsername,
  }, '15m'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60,
  })

  return response
}
