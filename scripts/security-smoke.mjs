import assert from 'node:assert/strict'

const appUrl = process.env.NEXT_PUBLIC_APP_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
assert(appUrl && supabaseUrl && anonKey, 'Security smoke test environment is incomplete')

const results = []
async function check(name, operation) {
  const started = performance.now()
  await operation()
  results.push({ name, ms: Math.round(performance.now() - started) })
}

const api = (path, init) => fetch(new URL(path, appUrl), { redirect: 'manual', ...init })

await check('admin page rejects anonymous access', async () => {
  const response = await api('/admin')
  assert([302, 307, 308].includes(response.status), `unexpected status ${response.status}`)
})

await check('tampered admin cookie is rejected', async () => {
  const response = await api('/api/admin/members', {
    headers: { cookie: 'admin-session=eyJhbGciOiJub25lIn0.eyJhZG1pbiI6dHJ1ZX0.' },
  })
  assert.equal(response.status, 401)
})

await check('cross-site mutation is rejected', async () => {
  const response = await api('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' },
    body: JSON.stringify({ username: 'x', password: 'x' }),
  })
  assert.equal(response.status, 403)
})

await check('malformed JSON is rejected', async () => {
  const response = await api('/api/invites/reserve', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  })
  assert.equal(response.status, 400)
})

await check('wrong content type is rejected', async () => {
  const response = await api('/api/invites/reserve', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}',
  })
  assert.equal(response.status, 415)
})

await check('oversized request is rejected', async () => {
  const response = await api('/api/invites/reserve', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inviteCode: 'A'.repeat(40_000) }),
  })
  assert.equal(response.status, 413)
})

await check('injection payload is rejected', async () => {
  const response = await api('/api/invites/reserve', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inviteCode: "' OR true --" }),
  })
  assert.equal(response.status, 400)
})

await check('anonymous Supabase table access is denied', async () => {
  const tables = ['applications', 'members', 'invites', 'admin_login_requests', 'admin_sessions', 'admin_audit_log', 'bot_commands', 'bot_runtime', 'api_rate_limits']
  const responses = await Promise.all(tables.map((table) => fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
  })))
  assert(responses.every((response) => response.status === 401 || response.status === 403), responses.map((r) => r.status).join(','))
})

await check('anonymous Supabase RPC access is denied', async () => {
  const calls = [
    ['reserve_invite', { p_code: 'AAAA-AAAA' }],
    ['submit_application', { p_invite_code: 'AAAA-AAAA', p_first_name: 'x', p_last_name: 'x', p_telegram_user_id: '1', p_telegram_username: '', p_disclaimer_version: 'x' }],
    ['consume_admin_login', { p_login_request_id: crypto.randomUUID(), p_session_id: crypto.randomUUID(), p_session_expires_at: new Date().toISOString() }],
    ['queue_member_status_change', { p_member_id: crypto.randomUUID() }],
  ]
  const responses = await Promise.all(calls.map(([name, body]) => fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  })))
  assert(responses.every((response) => response.status === 401 || response.status === 403), responses.map((r) => r.status).join(','))
})

await check('parallel unauthorized requests stay denied', async () => {
  const responses = await Promise.all(Array.from({ length: 500 }, () => api('/api/admin/stats')))
  assert(responses.every((response) => response.status === 401))
})

console.table(results)
console.log(`Security smoke tests passed: ${results.length}`)
