'use client'
import { useEffect, useState } from 'react'
import { LIVE_TRADE_STREAM, PRICE_SYMBOLS, evaluateLocalAlarms, parseLocalAlarms, parseAlarmPrice, quoteIsFresh, type LiveQuote, type PriceAlert } from '@/lib/price-alert-validation'

const STORE = 'local-price-alarms-v1'
const CHANGED = 'local-price-alarms-changed'
let audio: AudioContext | undefined
const read = () => parseLocalAlarms(localStorage.getItem(STORE))
function save(alerts: PriceAlert[]) { localStorage.setItem(STORE, JSON.stringify(alerts)); window.dispatchEvent(new Event(CHANGED)) }
async function locked<T>(operation: () => T): Promise<T> {
  return navigator.locks ? navigator.locks.request(STORE, operation) : operation()
}
function announce(alarm: PriceAlert) {
  const title = `${alarm.symbol.replace('USDT', '')} · PREISALARM`
  const body = `${alarm.price} USDT ${alarm.crossing === 'above' ? 'erreicht oder überschritten' : 'erreicht oder unterschritten'}. Live-Kurs: ${alarm.triggeredPrice} USDT.`
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag: alarm.id })
  if (audio?.state === 'running') {
    const tone = audio.createOscillator(), gain = audio.createGain()
    tone.frequency.value = 880; gain.gain.value = .08; tone.connect(gain); gain.connect(audio.destination)
    tone.start(); tone.stop(audio.currentTime + .5)
  }
}
export function useLiveQuotes() {
  const [quotes, setQuotes] = useState<LiveQuote[]>([])
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let socket: WebSocket | undefined, retry: ReturnType<typeof setTimeout>, stopped = false, delay = 1000
    const sequences = new Map<string, number>()
    let lastReceived = Date.now()
    const connect = () => {
      if (stopped) return
      const active = new WebSocket(LIVE_TRADE_STREAM)
      socket = active; lastReceived = Date.now()
      active.onmessage = (message) => {
        if (stopped || socket !== active) return
        try {
          const wrapper = JSON.parse(message.data), tick = wrapper.data ?? wrapper
          if (tick.e === 'serverShutdown') { active.close(); return }
          if (tick.e !== 'aggTrade' || !PRICE_SYMBOLS.includes(tick.s)) return
          const quote: LiveQuote = { symbol: tick.s, price: Number(tick.p), tradedAt: new Date(tick.T).toISOString(), receivedAt: new Date().toISOString() }
          if (!quoteIsFresh(quote) || !Number.isSafeInteger(tick.a) || tick.a <= (sequences.get(tick.s) ?? -1)) return
          sequences.set(tick.s, tick.a); lastReceived = Date.now(); delay = 1000; setAvailable(true)
          setQuotes((old) => [...old.filter((value) => value.symbol !== quote.symbol), quote])
          void locked(() => {
            const result = evaluateLocalAlarms(read(), quote)
            if (result.triggered.length) {
              save(result.alerts)
              result.triggered.forEach((alarm) => { try { announce(alarm) } catch { /* The saved alarm remains visible. */ } })
            }
          }).catch(() => window.dispatchEvent(new CustomEvent('local-price-alarm-error', { detail: 'Der Alarm konnte nicht lokal gespeichert werden.' })))
        } catch { /* Ignore non-trade packets; don't compare a malformed quote. */ }
      }
      active.onerror = () => active.close()
      active.onclose = () => { if (stopped || socket !== active) return; setAvailable(false); retry = setTimeout(connect, delay); delay = Math.min(30000, delay * 2) }
    }
    connect()
    const freshness = setInterval(() => {
      setQuotes((old) => [...old])
      if (socket?.readyState === WebSocket.OPEN && Date.now() - lastReceived > 30000) socket.close()
    }, 1000)
    return () => { stopped = true; clearTimeout(retry); clearInterval(freshness); socket?.close() }
  }, [])
  return { quotes, available }
}
export function QuoteLabel({ quote, fallback, available }: { quote?: LiveQuote; fallback: number; available: boolean }) {
  const fresh = available && quoteIsFresh(quote)
  return <>
    {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quote?.price ?? fallback)} <span className="text-sm text-slate-400">USDT</span>
    <span className={`mt-1 block text-xs font-normal ${fresh ? 'text-emerald-300' : 'text-amber-300'}`}>
      {fresh ? 'Live' : quote ? 'Letzter Kurs' : 'Analyse-Kurs'}{quote && ` · ${new Date(quote.tradedAt).toLocaleTimeString('de-DE')}`}{!available && ' · Nicht verbunden'}
    </span>
  </>
}
export default function LivePriceAlarms({ symbol, quote }: { symbol: string; quote?: LiveQuote }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]), [amount, setAmount] = useState('')
  const [crossing, setCrossing] = useState<'above' | 'below'>('above'), [error, setError] = useState('')
  useEffect(() => {
    const load = () => { try { setAlerts(read()) } catch { setError('Lokale Alarmdaten konnten nicht gelesen werden.') } }
    const failed = () => setError('Der Alarm konnte nicht lokal gespeichert werden.')
    load(); window.addEventListener(CHANGED, load); window.addEventListener('storage', load); window.addEventListener('local-price-alarm-error', failed)
    return () => { window.removeEventListener(CHANGED, load); window.removeEventListener('storage', load); window.removeEventListener('local-price-alarm-error', failed) }
  }, [])
  async function add() {
    const price = parseAlarmPrice(amount)
    if (price === null) { setError('Positiven Kurs ohne Tausendertrennzeichen eingeben.'); return }
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    try { if ('AudioContext' in window) { if (!audio) audio = new AudioContext(); void audio.resume().catch(() => {}) } } catch { /* Visual alarms still work. */ }
    try {
      await locked(() => {
        const old = read()
        if (old.filter((value) => value.status === 'active').length >= 20) throw new Error('Maximal 20 aktive Alarme auf diesem Gerät.')
        save([{ id: crypto.randomUUID(), symbol, crossing, price: price!, status: 'active', createdAt: Date.now() },
          ...old.filter((value) => value.status === 'active'), ...old.filter((value) => value.status !== 'active').slice(0, 100)])
      })
      setAmount(''); setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.') }
  }
  const alreadyReached = quoteIsFresh(quote) && parseAlarmPrice(amount) !== null && (crossing === 'above' ? quote!.price >= parseAlarmPrice(amount)! : quote!.price <= parseAlarmPrice(amount)!)
  return <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
    <h3 className="text-lg font-bold text-white">Lokaler Preisalarm · {symbol.replace('USDT', '')}</h3>
    <p className="mt-1 text-sm text-slate-400">Die Marke bleibt auf diesem Gerät. Diese Seite vergleicht sie mit den Live-Kursen.</p>
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void add() }}>
      <label className="text-sm text-slate-300">Auslösen bei<select aria-label="Alarmrichtung" value={crossing} onChange={(e) => setCrossing(e.target.value as 'above' | 'below')} className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"><option value="above">Kurs erreicht oder übersteigt</option><option value="below">Kurs erreicht oder unterschreitet</option></select></label>
      <label className="text-sm text-slate-300">Kurs in USDT<input aria-label="Alarmkurs in USDT" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="z. B. 80000,00" required className="mt-1 block w-44 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" /></label>
      <button className="rounded-lg bg-sky-400 px-4 py-2 font-bold text-slate-950">Lokal speichern</button>
    </form>
    {alreadyReached && <p className="mt-2 text-sm text-amber-300">Die Bedingung ist bereits erfüllt. Der nächste Live-Kurs kann sofort auslösen.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    <p className="mt-3 text-xs text-slate-500">Im Browser ist die Überwachung aktiv, solange diese Seite geöffnet bleibt. Android überwacht über den lokalen Hintergrunddienst.</p>
    <ul className="mt-4 space-y-2">{alerts.filter((item) => item.symbol === symbol && item.status !== 'cancelled').map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 p-3 text-sm"><span>{item.crossing === 'above' ? 'Ab' : 'Bis'} {new Intl.NumberFormat('de-DE', { maximumFractionDigits: 8 }).format(item.price)} USDT · {item.status === 'triggered' ? 'ALARM · Ausgelöst' : 'Aktiv'}</span>{item.status === 'active' && <button className="text-rose-300" onClick={() => { void locked(() => save(read().map((value) => value.id === item.id ? { ...value, status: 'cancelled' } : value))).catch(() => setError('Deaktivieren fehlgeschlagen.')) }}>Deaktivieren</button>}</li>)}</ul>
  </section>
}
