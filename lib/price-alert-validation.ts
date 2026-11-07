export const PRICE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const
export type LiveQuote = { symbol: string; price: number; tradedAt: string; receivedAt: string }
export type PriceAlert = {
  id: string; symbol: string; crossing: 'above' | 'below'; price: number
  status: 'active' | 'triggered' | 'cancelled'; created_at: string
  triggered_at: string | null; triggered_price: number | null; notified_at: string | null
}

export function parseAlarmPrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 && value < 1e12 ? value : null
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\s/g, '')
  // Decimal comma or decimal point, no ambiguous thousands separators.
  if (!/^\d+(?:[.,]\d{1,8})?$/.test(text)) return null
  const price = Number(text.replace(',', '.'))
  return Number.isFinite(price) && price > 0 && price < 1e12 ? price : null
}

export function validAlarmInput(value: unknown): value is { symbol: string; crossing: 'above' | 'below'; price: number | string; pushToken?: string } {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  return PRICE_SYMBOLS.includes(input.symbol as typeof PRICE_SYMBOLS[number]) &&
    (input.crossing === 'above' || input.crossing === 'below') && parseAlarmPrice(input.price) !== null &&
    (input.pushToken === undefined || (typeof input.pushToken === 'string' && input.pushToken.length >= 20 && input.pushToken.length <= 4096))
}

export function validInstallationSecret(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

export function installationAuthorization(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const value = header.slice(7)
  return validInstallationSecret(value) ? value : null
}

export function quoteIsFresh(quote: LiveQuote | undefined, now = Date.now()): boolean {
  if (!quote) return false
  const time = Date.parse(quote.tradedAt)
  return Number.isFinite(time) && now - time >= -2000 && now - time <= 15000
}
