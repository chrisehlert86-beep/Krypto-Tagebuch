import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export type TelegramAuth = {
  id?: number | string
  auth_date?: number
  hash?: string
  username?: string
  [key: string]: unknown
}

export function normalizeTelegramBotToken(value: string | undefined) {
  if (!value) return ''

  let normalized = value.trim()
  if (normalized.startsWith('TELEGRAM_BOT_TOKEN=')) {
    normalized = normalized.slice('TELEGRAM_BOT_TOKEN='.length).trim()
  }
  if (
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }
  return normalized
}

export function isValidTelegramAuth(user: TelegramAuth, botToken: string, now = Date.now()) {
  if (!user.hash || !user.id || !user.auth_date) return false
  if (!/^[1-9][0-9]{0,18}$/.test(String(user.id))) return false
  const age = Math.floor(now / 1000) - user.auth_date
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
