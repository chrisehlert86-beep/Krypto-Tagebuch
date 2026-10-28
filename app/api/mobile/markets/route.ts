import { NextResponse } from 'next/server'

import { getCurrentMarketAnalyses } from '@/lib/market-analysis'

const CANDLE_LIMITS = { m30: 240, daily: 180, weekly: 120, monthly: 72 } as const

export async function GET() {
  try {
    const markets = await getCurrentMarketAnalyses()
    const compactMarkets = markets.map((market) => ({
      ...market,
      candles: {
        m30: (market.candles.m30 ?? []).slice(-CANDLE_LIMITS.m30),
        daily: market.candles.daily.slice(-CANDLE_LIMITS.daily),
        weekly: market.candles.weekly.slice(-CANDLE_LIMITS.weekly),
        monthly: market.candles.monthly.slice(-CANDLE_LIMITS.monthly),
      },
    }))
    return NextResponse.json(
      { markets: compactMarkets },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } },
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Marktdaten konnten nicht geladen werden.' }, { status: 500 })
  }
}
