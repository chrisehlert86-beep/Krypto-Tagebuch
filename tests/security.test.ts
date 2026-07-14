import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'

import { acceptedAllDisclaimers, isValidInviteCode, isValidName } from '../lib/onboarding-validation.ts'
import { isValidTelegramAuth, type TelegramAuth } from '../lib/telegram-auth-validation.ts'

function signTelegram(user: TelegramAuth, token: string) {
  const checkString = Object.entries(user)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n')
  const secret = createHash('sha256').update(token).digest()
  return createHmac('sha256', secret).update(checkString).digest('hex')
}

test('Einladungscodes verwenden das sichere Format', () => {
  assert.equal(isValidInviteCode('ABCD-2345'), true)
  assert.equal(isValidInviteCode('ABCI-2345'), false)
  assert.equal(isValidInviteCode('abcd-2345'), false)
})

test('Namen werden begrenzt und dürfen nicht leer sein', () => {
  assert.equal(isValidName(' Chris '), true)
  assert.equal(isValidName('   '), false)
  assert.equal(isValidName('x'.repeat(101)), false)
})

test('alle drei Disclaimer müssen ausdrücklich bestätigt sein', () => {
  assert.equal(acceptedAllDisclaimers([true, true, true]), true)
  assert.equal(acceptedAllDisclaimers([true, true, false]), false)
  assert.equal(acceptedAllDisclaimers([1, true, true]), false)
})

test('gültige Telegram-Signaturen werden akzeptiert', () => {
  const now = Date.now()
  const token = '123:secret'
  const unsigned = { id: 123, auth_date: Math.floor(now / 1000), username: 'chris' }
  assert.equal(isValidTelegramAuth({ ...unsigned, hash: signTelegram(unsigned, token) }, token, now), true)
})

test('manipulierte und abgelaufene Telegram-Daten werden abgelehnt', () => {
  const now = Date.now()
  const token = '123:secret'
  const unsigned = { id: 123, auth_date: Math.floor(now / 1000) - 301 }
  assert.equal(isValidTelegramAuth({ ...unsigned, hash: signTelegram(unsigned, token) }, token, now), false)
  assert.equal(isValidTelegramAuth({ id: 123, auth_date: Math.floor(now / 1000), hash: '00' }, token, now), false)
})
