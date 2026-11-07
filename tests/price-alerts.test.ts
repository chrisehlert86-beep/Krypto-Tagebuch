import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAlarmPrice, parseLocalAlarms, evaluateLocalAlarms, quoteIsFresh, type PriceAlert } from '../lib/price-alert-validation.ts'

const now = 1700000000000
const alarm = (crossing: 'above' | 'below' = 'above'): PriceAlert => ({ id: 'local-test', symbol: 'BTCUSDT', price: 100, crossing, status: 'active', createdAt: now - 1000 })
const quote = (price: number, time = now) => ({ symbol: 'BTCUSDT', price, tradedAt: new Date(time).toISOString(), receivedAt: new Date(now).toISOString() })

test('Dezimalkomma und Punkt, keine mehrdeutigen Tausendertrennzeichen', () => {
  assert.equal(parseAlarmPrice('80000,25'), 80000.25)
  assert.equal(parseAlarmPrice('90.25'), 90.25)
  for (const value of ['', '80.000,25', '80,000.25', '-2', 'NaN', 'Infinity', '0', '1e5', true, 1e12]) assert.equal(parseAlarmPrice(value), null)
})
test('Lokale Marken lösen bei Gleichheit sowie über/unter aus', () => {
  assert.equal(evaluateLocalAlarms([alarm()], quote(100), now).triggered.length, 1)
  assert.equal(evaluateLocalAlarms([alarm()], quote(101), now).triggered.length, 1)
  assert.equal(evaluateLocalAlarms([alarm('below')], quote(99), now).triggered.length, 1)
  assert.equal(evaluateLocalAlarms([alarm()], quote(99), now).triggered.length, 0)
  assert.equal(evaluateLocalAlarms([alarm('below')], quote(101), now).triggered.length, 0)
})
test('Ein kurzer Kontakt bleibt nach lokalem Speichern und Neustart ausgelöst', () => {
  const hit = evaluateLocalAlarms([alarm()], quote(101), now)
  const restored = parseLocalAlarms(JSON.stringify(hit.alerts))
  assert.equal(restored[0].status, 'triggered')
  assert.equal(evaluateLocalAlarms(restored, quote(99), now).triggered.length, 0)
  assert.equal(evaluateLocalAlarms(restored, quote(101), now).triggered.length, 0)
})
test('Deaktivierte Alarme und andere Coins lösen nicht aus', () => {
  assert.equal(evaluateLocalAlarms([{ ...alarm(), status: 'cancelled' }], quote(101), now).triggered.length, 0)
  assert.equal(evaluateLocalAlarms([alarm()], { ...quote(101), symbol: 'SOLUSDT' }, now).triggered.length, 0)
})
test('Keine Alarme aus alten Kursen, Zukunftskursen oder Trades vor der Speicherung', () => {
  for (const time of [now - 16000, now + 10000, now - 2000, now - 1000]) assert.equal(evaluateLocalAlarms([alarm()], quote(101, time), now).triggered.length, 0)
  assert.equal(quoteIsFresh(undefined, now), false)
  assert.equal(quoteIsFresh(quote(Number.NaN), now), false)
})
test('Ungültiger lokaler Speicher wird abgelehnt statt überschrieben', () => {
  assert.deepEqual(parseLocalAlarms(null), [])
  assert.throws(() => parseLocalAlarms('{'))
  assert.throws(() => parseLocalAlarms(JSON.stringify([{ ...alarm(), symbol: 'FAKE' }])))
  assert.throws(() => parseLocalAlarms(JSON.stringify([{ ...alarm(), price: 0 }])))
})
