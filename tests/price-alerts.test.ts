import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAlarmPrice, validAlarmInput, installationAuthorization, quoteIsFresh } from '../lib/price-alert-validation.ts'

test('Kurswerte akzeptieren Dezimalkomma und Punkt ohne Tausendermehrdeutigkeit', () => {
  assert.equal(parseAlarmPrice(' 80000,25 '), 80000.25)
  assert.equal(parseAlarmPrice('90.25'), 90.25)
  for (const value of ['', '80.000,25', '80,000.25', '-2', 'NaN', 'Infinity', '0', '1e5', true, 1e12]) assert.equal(parseAlarmPrice(value), null)
})
test('Nur bekannte Coins, gültige Richtungen und begrenzte Push-Ziele', () => {
  assert.equal(validAlarmInput({ symbol: 'BTCUSDT', crossing: 'above', price: 80000 }), true)
  assert.equal(validAlarmInput({ symbol: 'SOLUSDT', crossing: 'below', price: '90,25', pushToken: 'x'.repeat(100) }), true)
  assert.equal(validAlarmInput({ symbol: 'FAKE', crossing: 'above', price: 1 }), false)
  assert.equal(validAlarmInput({ symbol: 'BTCUSDT', crossing: 'wrong', price: 1 }), false)
  assert.equal(validAlarmInput({ symbol: 'BTCUSDT', crossing: 'above', price: 1, pushToken: 'x'.repeat(5000) }), false)
})
test('Installationsidentität erfordert ein vollständiges Bearer-Geheimnis', () => {
  const secret = 'a'.repeat(64)
  assert.equal(installationAuthorization(`Bearer ${secret}`), secret)
  for (const value of [null, secret, 'Bearer admin', `Basic ${secret}`, `Bearer ${secret}\n`]) assert.equal(installationAuthorization(value), null)
})
test('Kursstand darf bei unterbrochenem oder veraltetem Feed nicht als live erscheinen', () => {
  const now = 1700000000000
  const quote = { symbol: 'BTCUSDT', price: 80000, tradedAt: new Date(now - 1000).toISOString(), receivedAt: new Date(now).toISOString() }
  assert.equal(quoteIsFresh(quote, now), true)
  assert.equal(quoteIsFresh({ ...quote, tradedAt: new Date(now - 16000).toISOString() }, now), false)
  assert.equal(quoteIsFresh({ ...quote, tradedAt: new Date(now + 10000).toISOString() }, now), false)
  assert.equal(quoteIsFresh(undefined, now), false)
})
