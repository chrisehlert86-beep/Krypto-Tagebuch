import MarketsDashboard from '@/components/markets/MarketsDashboard'

export default function MobileMarketsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-slate-100">
      <header className="mb-4 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">Krypto-Tagebuch</p>
          <h1 className="mt-1 text-2xl font-black text-white">Märkte</h1>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
          LIVE
        </span>
      </header>
      <MarketsDashboard mobile />
    </main>
  )
}
