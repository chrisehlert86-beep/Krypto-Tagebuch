'use client'

import { useEffect, useMemo, useState } from 'react'

import type { MarketAnalysis, MarketSignalPlan, MarketTimeframe } from '@/lib/market-analysis'
import MarketChart from '@/components/markets/MarketChart'

const TIMEFRAMES: Array<{ value: MarketTimeframe; label: string }> = [
  { value: 'm30', label: '30M' },
  { value: 'daily', label: '1D' },
  { value: 'weekly', label: '1W' },
  { value: 'monthly', label: '1M' },
]

function price(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value)
}
function directionLabel(direction: MarketAnalysis['direction']) {
  if (direction === 'long') return 'LONG'
  if (direction === 'short') return 'SHORT'
  return 'WARTEN'
}

function directionClass(direction: MarketAnalysis['direction']) {
  if (direction === 'long') return 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30'
  if (direction === 'short') return 'bg-rose-400/15 text-rose-300 ring-rose-400/30'
  return 'bg-amber-400/15 text-amber-200 ring-amber-400/30'
}

function planFor(market: MarketAnalysis, timeframe: MarketTimeframe): MarketSignalPlan | null {
  return market.signalPlans?.find((plan) => plan.timeframe === timeframe) ?? null
}

function levelRoleLabel(role: MarketSignalPlan['levels'][number]['role']) {
  if (role === 'long_entry') return 'Long-Einstieg'
  if (role === 'short_entry') return 'Short-Einstieg'
  return 'Ziel'
}

export default function MarketsDashboard({ mobile = false }: { mobile?: boolean }) {
  const [markets, setMarkets] = useState<MarketAnalysis[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('daily')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/admin/markets', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Marktdaten konnten nicht geladen werden.')
        const next = Array.isArray(result.markets) ? result.markets : []
        setMarkets(next)
        setSelectedSymbol((current) => current ?? next[0]?.symbol ?? null)
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const selected = useMemo(
    () => markets.find((market) => market.symbol === selectedSymbol) ?? null,
    [markets, selectedSymbol],
  )
  const selectedPlan = selected ? planFor(selected, timeframe) : null
  const shownDirection = selectedPlan?.direction ?? selected?.direction ?? 'wait'

  if (loading) {
    return <div className="rounded-2xl bg-slate-900 p-8 text-slate-200">Marktanalysen werden geladen…</div>
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-400/30 bg-rose-950/50 p-6 text-rose-100">{error}</div>
  }

  if (!selected) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-slate-900 p-8 text-slate-200">
        <h2 className="text-xl font-bold text-white">Noch keine Analyse veröffentlicht</h2>
        <p className="mt-2 text-slate-400">Nach der ersten Synchronisierung erscheinen BTC, ETH und SOL automatisch hier.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-slate-100">
      <div className={mobile ? 'flex snap-x gap-3 overflow-x-auto pb-2' : 'grid gap-3 md:grid-cols-3'}>
        {markets.map((market) => {
          const active = market.symbol === selected.symbol
          return (
            <button
              key={market.symbol}
              type="button"
              onClick={() => setSelectedSymbol(market.symbol)}
              className={`${mobile ? 'min-w-[78%] snap-start' : ''} rounded-2xl border p-4 text-left transition ${active ? 'border-sky-400 bg-slate-800 shadow-lg shadow-sky-950/40' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{market.displaySymbol}</p>
                  <p className="mt-2 text-2xl font-black text-white">{price(market.currentPrice)} <span className="text-sm text-slate-400">USDT</span></p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${directionClass(market.direction)}`}>
                  {directionLabel(market.direction)}
                </span>
              </div>
              <p className="mt-4 truncate text-sm font-semibold text-slate-300">{market.activeCase.waveLabel}</p>
            </button>
          )
        })}
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className={mobile ? 'border-b border-slate-700 p-4' : 'border-b border-slate-700 p-5 sm:p-7'}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className={`${mobile ? 'text-2xl' : 'text-3xl'} font-black text-white`}>{selected.displaySymbol}</h2>
                <span className={`rounded-full px-3 py-1 text-sm font-black ring-1 ${directionClass(shownDirection)}`}>
                  {directionLabel(shownDirection)}
                </span>
              </div>
              {!mobile && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{selected.summary}</p>}
            </div>
            <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1">
              {TIMEFRAMES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTimeframe(item.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${timeframe === item.value ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`mt-6 grid gap-3 ${mobile ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
            <Metric label="Laufende Welle" value={selectedPlan?.waveLabel ?? selected.activeCase.waveLabel} accent="text-fuchsia-300" />
            {selectedPlan ? (
              <Metric
                label={selectedPlan.levels.some((level) => level.role.includes('entry')) ? 'Fibonacci-Einstiegslevel' : 'Fibonacci-Ziele'}
                value={selectedPlan.levels.map((level) => `Fib ${level.ratio}: ${price(level.price)}`).join(' · ')}
                detail={[...new Set(selectedPlan.levels.map((level) => levelRoleLabel(level.role)))].join(' / ')}
                accent="text-amber-300"
              />
            ) : (
              <Metric
                label={selected.target.kind === 'top' ? 'Nächstes Top' : 'Nächster Boden'}
                value={`${price(selected.target.zone[0])}–${price(selected.target.zone[1])}`}
                detail={selected.target.fibRatio ? `Fib ${selected.target.fibRatio} · ${price(selected.target.fibPrice)} USDT` : undefined}
                accent="text-amber-300"
              />
            )}
            <Metric
              label="Invalidierung"
              value={`${(selectedPlan?.invalidation.relation ?? selected.invalidation.relation) === 'below' ? 'Unter' : 'Über'} ${price(selectedPlan?.invalidation.price ?? selected.invalidation.price)}`}
              detail={selectedPlan?.invalidation.confirmation}
              accent="text-rose-300"
            />
            <Metric
              label="Konfidenz"
              value={`${Math.round(selected.confidence * 100)} %`}
              detail={`Stand ${new Date(selected.generatedAt).toLocaleString('de-DE')}`}
              accent="text-sky-300"
            />
          </div>
        </div>

        <div className={mobile ? 'p-2' : 'p-3 sm:p-6'}>
          <MarketChart analysis={selected} timeframe={timeframe} />
        </div>

        {!mobile && <div className="grid gap-4 border-t border-slate-700 p-5 sm:p-7 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
            <h3 className="font-black text-white">Aktuelles Szenario</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{selected.activeCase.interpretation}</p>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
            <h3 className="font-black text-white">Wellen-Synthese</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{selected.currentWaveSummary}</p>
          </article>
        </div>}
      </section>

      <p className="text-center text-xs text-slate-500">Nur Information, keine Anlageberatung.</p>
    </div>
  )
}

function Metric({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-black ${accent}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}
    </div>
  )
}
