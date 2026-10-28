'use client'

import type {
  MarketAnalysis,
  MarketCandle,
  MarketTimeframe,
} from '@/lib/market-analysis'

type Props = {
  analysis: MarketAnalysis
  timeframe: MarketTimeframe
}
const WIDTH = 1000
const HEIGHT = 440
const PAD = { top: 28, right: 92, bottom: 38, left: 16 }

function formatPrice(value: number) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value)
}

function visibleCandles(candles: MarketCandle[], timeframe: MarketTimeframe) {
  const limit = timeframe === 'm30' ? 160 : timeframe === 'daily' ? 120 : timeframe === 'weekly' ? 104 : 72
  return candles.slice(-limit)
}

export default function MarketChart({ analysis, timeframe }: Props) {
  const candles = visibleCandles(analysis.candles[timeframe] ?? [], timeframe)
  if (candles.length < 2) {
    return <div className="grid h-80 place-items-center text-slate-400">Keine Chartdaten verfügbar.</div>
  }

  const signalPlan = analysis.signalPlans?.find((plan) => plan.timeframe === timeframe)
  const fibLevels = signalPlan?.levels ?? analysis.activeCase.fibonacciLevels
  const invalidation = signalPlan?.invalidation.price ?? analysis.activeCase.invalidation
  const targetZone: [number, number] = signalPlan && signalPlan.levels.length
    ? [Math.min(...signalPlan.levels.map((level) => level.price)), Math.max(...signalPlan.levels.map((level) => level.price))]
    : analysis.activeCase.targetZone
  const overlays = [
    ...analysis.activeCase.supportZones.flat(),
    ...analysis.activeCase.resistanceZones.flat(),
    ...targetZone,
    invalidation,
    ...fibLevels.map((level) => level.price),
  ].filter(Number.isFinite)
  const rawMin = Math.min(...candles.map((item) => item.low), ...overlays)
  const rawMax = Math.max(...candles.map((item) => item.high), ...overlays)
  const margin = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.01)
  const min = rawMin - margin
  const max = rawMax + margin
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const step = plotWidth / candles.length
  const candleWidth = Math.max(2, Math.min(8, step * 0.62))
  const x = (index: number) => PAD.left + step * index + step / 2
  const y = (price: number) => PAD.top + ((max - price) / (max - min)) * plotHeight

  const firstTime = candles[0].time
  const lastTime = candles.at(-1)?.time ?? firstTime
  const wavePoints = analysis.activeCase.wavePoints.filter(
    (point) => point.time >= firstTime && point.time <= lastTime,
  )
  const wavePath = wavePoints
    .map((point, index) => {
      const candleIndex = candles.findIndex((candle) => candle.time >= point.time)
      const px = x(Math.max(0, candleIndex))
      return `${index === 0 ? 'M' : 'L'} ${px} ${y(point.price)}`
    })
    .join(' ')

  const targetTop = y(targetZone[1])
  const targetBottom = y(targetZone[0])
  const gridPrices = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4)

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950 p-2 sm:p-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="min-h-[330px] min-w-[720px] w-full"
        role="img"
        aria-label={`${analysis.displaySymbol} ${timeframe} Candlestick-Chart mit Wellen und Fibonacci-Zonen`}
      >
        <defs>
          <linearGradient id="target-zone" x1="0" x2="1">
            <stop offset="0" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0.24" />
          </linearGradient>
        </defs>

        {gridPrices.map((price) => (
          <g key={price}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(price)} y2={y(price)} stroke="#1e293b" />
            <text x={WIDTH - PAD.right + 10} y={y(price) + 4} fill="#94a3b8" fontSize="13">
              {formatPrice(price)}
            </text>
          </g>
        ))}

        <rect
          x={PAD.left}
          y={Math.min(targetTop, targetBottom)}
          width={plotWidth}
          height={Math.max(2, Math.abs(targetBottom - targetTop))}
          fill="url(#target-zone)"
        />
        <text x={PAD.left + 8} y={Math.min(targetTop, targetBottom) + 18} fill="#fbbf24" fontSize="13" fontWeight="700">
          {signalPlan?.levels.some((level) => level.role.includes('entry')) ? 'EINSTIEGSBEREICH' : 'ZIELZONE'}
        </text>

        {fibLevels.map((level) => (
          <g key={`${level.ratio}-${level.price}`}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(level.price)}
              y2={y(level.price)}
              stroke="#38bdf8"
              strokeDasharray="7 7"
              strokeOpacity="0.55"
            />
            <text x={WIDTH - PAD.right - 76} y={y(level.price) - 5} fill="#7dd3fc" fontSize="12">
              Fib {level.ratio}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(invalidation)}
          y2={y(invalidation)}
          stroke="#fb7185"
          strokeWidth="2"
          strokeDasharray="4 5"
        />
        <text x={PAD.left + 8} y={y(invalidation) - 7} fill="#fda4af" fontSize="12" fontWeight="700">
          INVALIDIERUNG
        </text>

        {candles.map((candle, index) => {
          const rising = candle.close >= candle.open
          const color = rising ? '#34d399' : '#fb7185'
          const bodyTop = y(Math.max(candle.open, candle.close))
          const bodyBottom = y(Math.min(candle.open, candle.close))
          return (
            <g key={candle.time}>
              <line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1" />
              <rect
                x={x(index) - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={Math.max(1.5, bodyBottom - bodyTop)}
                fill={color}
                rx="1"
              />
            </g>
          )
        })}

        {wavePath && <path d={wavePath} fill="none" stroke="#e879f9" strokeWidth="2.5" />}
        {wavePoints.map((point) => {
          const candleIndex = candles.findIndex((candle) => candle.time >= point.time)
          const px = x(Math.max(0, candleIndex))
          const py = y(point.price)
          return (
            <g key={`${point.time}-${point.label}`}>
              <circle cx={px} cy={py} r="4" fill="#e879f9" />
              <text x={px + 7} y={py - 7} fill="#f0abfc" fontSize="12" fontWeight="700">
                {point.label.replace(/^Ende /, '')}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
