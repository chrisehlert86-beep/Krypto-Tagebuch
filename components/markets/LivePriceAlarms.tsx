'use client'

import { useEffect, useState } from 'react'
import { parseAlarmPrice, quoteIsFresh, type LiveQuote, type PriceAlert } from '@/lib/price-alert-validation'

export function useLiveQuotes() {
  const [quotes, setQuotes] = useState<LiveQuote[]>([])
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const response = await fetch('/api/mobile/live-prices', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('unavailable')
        const result = await response.json()
        setQuotes(Array.isArray(result.quotes) ? result.quotes : [])
        setAvailable(true)
      } catch { if (!controller.signal.aborted) setAvailable(false) }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 2000)
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [])
  return { quotes, available }
}

export function QuoteLabel({ quote, fallback, available }: { quote?: LiveQuote; fallback: number; available: boolean }) {
  const fresh = available && quoteIsFresh(quote)
  const value = quote?.price ?? fallback
  return <>
    {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} <span className="text-sm text-slate-400">USDT</span>
    <span className={`mt-1 block text-xs font-normal ${fresh ? 'text-emerald-300' : 'text-amber-300'}`}>
      {fresh ? 'Live' : quote ? 'Letzter Kurs' : 'Analyse-Kurs'}
      {quote && ` · ${new Date(quote.tradedAt).toLocaleTimeString('de-DE')}`}
      {!available && ' · Verbindung unterbrochen'}
    </span>
  </>
}

function installationSecret() {
  const name = 'price-alarm-installation'
  let value = localStorage.getItem(name)
  if (!value || !/^[a-f0-9]{64}$/.test(value)) {
    value = [...crypto.getRandomValues(new Uint8Array(32))].map((n) => n.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(name, value)
  }
  return value
}

export default function LivePriceAlarms({ symbol, quote }: { symbol: string; quote?: LiveQuote }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [amount, setAmount] = useState('')
  const [crossing, setCrossing] = useState<'above' | 'below'>('above')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const response = await fetch('/api/mobile/price-alerts', { headers: { Authorization: `Bearer ${installationSecret()}` }, cache: 'no-store', signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error)
        setAlerts(result.alerts ?? [])
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Alarme momentan nicht verfügbar.')
      }
      if (!controller.signal.aborted) timer = setTimeout(load, 5000)
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [])
  async function mutate(method: 'POST' | 'DELETE', data: object) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/mobile/price-alerts', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${installationSecret()}` }, body: JSON.stringify(data) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      if (method === 'POST') { setAlerts((old) => [result.alert, ...old]); setAmount('') }
      else setAlerts((old) => old.map((item) => item.id === (data as { id: string }).id ? { ...item, status: 'cancelled' } : item))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.') }
    finally { setBusy(false) }
  }
  const alreadyReached = quoteIsFresh(quote) && parseAlarmPrice(amount) !== null &&
    (crossing === 'above' ? quote!.price >= parseAlarmPrice(amount)! : quote!.price <= parseAlarmPrice(amount)!)
  return <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
    <h3 className="text-lg font-bold text-white">Preisalarm · {symbol.replace('USDT', '')}</h3>
    <p className="mt-1 text-sm text-slate-400">Einmalig beim Erreichen des Live-Kurses. Unabhängig von der KI-Analyse.</p>
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
      event.preventDefault()
      const value = parseAlarmPrice(amount)
      if (value === null) { setError('Bitte einen positiven Kurs ohne Tausendertrennzeichen eingeben.'); return }
      void mutate('POST', { symbol, crossing, price: value })
    }}>
      <label className="text-sm text-slate-300">Auslösen bei
        <select aria-label="Alarmrichtung" value={crossing} onChange={(e) => setCrossing(e.target.value as 'above' | 'below')} className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white">
          <option value="above">Kurs erreicht oder übersteigt</option><option value="below">Kurs erreicht oder unterschreitet</option>
        </select>
      </label>
      <label className="text-sm text-slate-300">Kurs in USDT
        <input aria-label="Alarmkurs in USDT" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="z. B. 80000,00" required className="mt-1 block w-44 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
      </label>
      <button disabled={busy} className="rounded-lg bg-sky-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-50">{busy ? 'Speichert…' : 'Alarm speichern'}</button>
    </form>
    {alreadyReached && <p className="mt-2 text-sm text-amber-300">Die Bedingung ist bereits erfüllt. Der nächste Live-Kurs kann den Alarm sofort auslösen.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    <p className="mt-3 text-xs text-slate-500">Browser-Alarme erscheinen hier. Für Push-Alarme bei geschlossener App den Alarm in der Android-App speichern.</p>
    <ul className="mt-4 space-y-2">
      {alerts.filter((item) => item.symbol === symbol && item.status !== 'cancelled').map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 p-3 text-sm">
        <span>{item.crossing === 'above' ? 'Ab' : 'Bis'} {new Intl.NumberFormat('de-DE', { maximumFractionDigits: 8 }).format(item.price)} USDT · {item.status === 'triggered' ? 'Ausgelöst' : 'Aktiv'}</span>
        {item.status === 'active' && <button disabled={busy} onClick={() => void mutate('DELETE', { id: item.id })} className="text-rose-300">Deaktivieren</button>}
      </li>)}
    </ul>
  </section>
}
