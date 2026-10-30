import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export const INITIAL_MARKET_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const

export type MarketDirection = 'long' | 'short' | 'wait'
export type MarketTimeframe = 'm30' | 'daily' | 'weekly' | 'monthly'

export type MarketCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
export type MarketWavePoint = {
  label: string
  time: number
  price: number
}

export type MarketCase = {
  direction: 'long' | 'short'
  waveLabel: string
  waveStatus: string
  interpretation: string
  trigger: number
  invalidation: number
  targetZone: [number, number]
  fibonacciLevels: Array<{ ratio: string; price: number; role: string }>
  supportZones: Array<[number, number]>
  resistanceZones: Array<[number, number]>
  wavePoints: MarketWavePoint[]
  confidence: number
}

export type MarketSignalLevel = {
  ratio: string
  price: number
  role: 'target' | 'long_entry' | 'short_entry'
  crossing: 'up' | 'down'
}

export type MarketSignalPlan = {
  timeframe: MarketTimeframe
  timeframeLabel: string
  waveLabel: string
  direction: MarketDirection
  status?: string
  asOf?: number
  expiresAt?: number
  levels: MarketSignalLevel[]
  invalidation: {
    relation: 'below' | 'above'
    price: number
    confirmation?: string
  }
  note?: string
}

export type MarketAnalysis = {
  validationVersion?: string
  symbol: string
  displaySymbol: string
  generatedAt: string
  runId: string
  analysisMode: string
  currentPrice: number
  priceTime: string | null
  direction: MarketDirection
  marketState: string
  confidence: number
  summary: string
  currentWaveSummary: string
  activeCase: MarketCase
  bullCase: MarketCase
  bearCase: MarketCase
  target: {
    kind: 'top' | 'bottom'
    zone: [number, number]
    fibRatio: string | null
    fibPrice: number | null
  }
  invalidation: {
    relation: 'below' | 'above'
    price: number
  }
  signalPlans?: MarketSignalPlan[]
  candles: Record<MarketTimeframe, MarketCandle[]>
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isMarketAnalysis(value: unknown): value is MarketAnalysis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<MarketAnalysis>
  return typeof item.symbol === 'string' &&
    typeof item.displaySymbol === 'string' &&
    typeof item.generatedAt === 'string' &&
    isNumber(item.currentPrice) &&
    ['long', 'short', 'wait'].includes(item.direction ?? '') &&
    Boolean(item.candles && Array.isArray(item.candles.daily)) &&
    Boolean(item.activeCase && isNumber(item.activeCase.invalidation))
}

export async function getCurrentMarketAnalyses(): Promise<MarketAnalysis[]> {
  const fixturePath = process.env.MARKET_ANALYSIS_FIXTURE_PATH
  if (fixturePath && process.env.NODE_ENV !== 'production') {
    const { readFile } = await import('node:fs/promises')
    const fixture: unknown = JSON.parse(await readFile(fixturePath, 'utf8'))
    if (!Array.isArray(fixture)) throw new Error('Ungültige Marktanalyse-Vorschaudaten.')
    return fixture.filter(isMarketAnalysis)
  }

  const { data, error } = await supabaseAdmin
    .from('market_analysis_current')
    .select('symbol,payload,generated_at')
    .in('symbol', [...INITIAL_MARKET_SYMBOLS])
    .order('symbol')

  if (error) throw error

  const analyses = (data ?? [])
    .map((row) => row.payload as unknown)
    .filter(isMarketAnalysis)

  return INITIAL_MARKET_SYMBOLS
    .map((symbol) => analyses.find((analysis) => analysis.symbol === symbol))
    .filter((analysis): analysis is MarketAnalysis => Boolean(analysis))
}
