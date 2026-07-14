import { NextResponse } from 'next/server'

import { createFlowToken } from '@/lib/auth'
import { consumeRateLimit, rateLimitResponse } from '@/lib/request-security'
import { isValidTelegramAuth, type TelegramAuth } from '@/lib/telegram-auth-validation'

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
