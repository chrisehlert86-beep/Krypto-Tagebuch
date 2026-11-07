export const PRICE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const
export const LIVE_TRADE_STREAM = 'wss://data-stream.binance.vision/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade'
export type LiveQuote = { symbol: string; price: number; tradedAt: string; receivedAt: string }
export type PriceAlert = {
  id: string; symbol: string; crossing: 'above' | 'below'; price: number
  status: 'active' | 'triggered' | 'cancelled'; createdAt: number
  triggeredAt?: number; triggeredPrice?: number
}
export function parseAlarmPrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 && value < 1e12 ? value : null
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\s/g, '')
  if (!/^\d+(?:[.,]\d{1,8})?$/.test(text)) return null
  const price = Number(text.replace(',', '.'))
  return Number.isFinite(price) && price > 0 && price < 1e12 ? price : null
}
export function quoteIsFresh(quote: LiveQuote | undefined, now = Date.now()): boolean {
  if (!quote || !PRICE_SYMBOLS.includes(quote.symbol as typeof PRICE_SYMBOLS[number]) || parseAlarmPrice(quote.price) === null) return false
  const time = Date.parse(quote.tradedAt)
  return Number.isFinite(time) && now - time >= -2000 && now - time <= 15000
}
export function parseLocalAlarms(raw: string | null): PriceAlert[] {
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.some((item) => !item || typeof item.id !== 'string' ||
    !PRICE_SYMBOLS.includes(item.symbol) || !['above', 'below'].includes(item.crossing) ||
    parseAlarmPrice(item.price) === null || !['active', 'triggered', 'cancelled'].includes(item.status) ||
    typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt))) throw new Error('Lokale Alarmdaten sind ungültig.')
  return value as PriceAlert[]
}
export function evaluateLocalAlarms(alarms: PriceAlert[], quote: LiveQuote, now = Date.now()) {
  const triggered: PriceAlert[] = []
  const alerts = alarms.map((alarm) => {
    if (alarm.status !== 'active' || alarm.symbol !== quote.symbol || !quoteIsFresh(quote, now) || Date.parse(quote.tradedAt) <= alarm.createdAt) return alarm
    if (!(alarm.crossing === 'above' ? quote.price >= alarm.price : quote.price <= alarm.price)) return alarm
    const next: PriceAlert = { ...alarm, status: 'triggered', triggeredAt: Date.parse(quote.tradedAt), triggeredPrice: quote.price }
    triggered.push(next)
    return next
  })
  return { alerts, triggered }
}
