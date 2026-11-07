import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PRICE_SYMBOLS, type LiveQuote } from '@/lib/price-alert-validation'

export async function getLivePrices(): Promise<LiveQuote[]> {
  const { data, error } = await supabaseAdmin.from('market_live_prices')
    .select('symbol,price,traded_at,received_at').in('symbol', [...PRICE_SYMBOLS])
  if (error) throw error
  return (data ?? []).map((row) => ({ symbol: row.symbol, price: Number(row.price), tradedAt: row.traded_at, receivedAt: row.received_at }))
}
