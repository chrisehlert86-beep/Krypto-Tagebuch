import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseEnv(path) {
  const values = new Map()
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    values.set(key, value)
  }
  return values
}

function required(source, key) {
  const value = source.get(key)?.trim()
  if (!value) throw new Error(`Erforderlicher Wert fehlt: ${key}`)
  if (/\r|\n/.test(value)) throw new Error(`Mehrzeiliger Wert ist nicht erlaubt: ${key}`)
  return value
}

const webPath = resolve(process.argv[2] ?? '.env.local')
const botPath = resolve(process.argv[3] ?? '../tagebuch-bot.env')
const outputPath = resolve(process.argv[4] ?? '../vercel-import.env')
const web = parseEnv(webPath)
const bot = parseEnv(botPath)

const botToken = required(bot, 'TELEGRAM_BOT_TOKEN')
const webToken = web.get('TELEGRAM_BOT_TOKEN')?.trim()
if (webToken && webToken !== botToken) {
  throw new Error('Web- und Bot-Datei enthalten unterschiedliche Telegram-Tokens.')
}

let sessionSecret = web.get('ADMIN_SESSION_SECRET')?.trim() ?? ''
const generatedSessionSecret = !/^[A-Za-z0-9_-]{32,}$/.test(sessionSecret)
if (generatedSessionSecret) sessionSecret = randomBytes(32).toString('hex')

const output = new Map([
  ['NEXT_PUBLIC_SUPABASE_URL', required(web, 'NEXT_PUBLIC_SUPABASE_URL')],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', required(web, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')],
  ['SUPABASE_SERVICE_ROLE_KEY', required(web, 'SUPABASE_SERVICE_ROLE_KEY')],
  ['NEXT_PUBLIC_TELEGRAM_BOT_USERNAME', required(web, 'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME').replace(/^@/, '')],
  ['TELEGRAM_BOT_TOKEN', botToken],
  ['NEXT_PUBLIC_APP_URL', required(web, 'NEXT_PUBLIC_APP_URL').replace(/\/$/, '')],
  ['ADMIN_USERNAME', required(web, 'ADMIN_USERNAME')],
  ['ADMIN_PASSWORD_HASH', required(web, 'ADMIN_PASSWORD_HASH')],
  ['ADMIN_SESSION_SECRET', sessionSecret],
])

const file = [...output].map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
writeFileSync(outputPath, file, { encoding: 'utf8', mode: 0o600 })

console.log(JSON.stringify({
  output: outputPath,
  variables: [...output.keys()],
  telegramTokenFingerprint: createHash('sha256').update(botToken).digest('hex').slice(0, 12),
  generatedSessionSecret,
}, null, 2))
