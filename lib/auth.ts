import 'server-only'

import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

import { supabaseAdmin } from '@/lib/supabase-admin'

const TOKEN_ISSUER = 'tagebuch-web'

function getSecret() {
  const value = process.env.ADMIN_SESSION_SECRET

  if (!value || value.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET muss mindestens 32 Zeichen lang sein.')
  }

  return new TextEncoder().encode(value)
}

export async function verifyPassword(password: string) {
  const result = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH ?? ''
  )

  return result
}

export async function createSessionToken(sessionId: string) {
  const token = await new SignJWT({
    admin: true,
    sid: sessionId,
  })
    .setProtectedHeader({
      alg: 'HS256',
    })
    .setIssuer(TOKEN_ISSUER)
    .setAudience('admin-session')
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret())

  return token
}

export function createSessionIdentity() {
  return {
    sessionId: randomUUID(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
  }
}

export async function verifySession(token: string) {
  try {
    const { payload } =
      await jwtVerify(token, getSecret(), {
        algorithms: ['HS256'], issuer: TOKEN_ISSUER, audience: 'admin-session',
      })

    if (payload.admin !== true || typeof payload.sid !== 'string') return false

    const { data, error } = await supabaseAdmin
      .from('admin_sessions')
      .select('id')
      .eq('id', payload.sid)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    return !error && Boolean(data)

  } catch {

    return false

  }
}

export async function revokeSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'], issuer: TOKEN_ISSUER, audience: 'admin-session',
    })
    if (typeof payload.sid !== 'string') return

    await supabaseAdmin
      .from('admin_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', payload.sid)
  } catch {
    // Ein ungültiges Cookie wird unabhängig davon im Browser gelöscht.
  }
}

type FlowToken = {
  kind: 'invite'
  inviteCode: string
} | {
  kind: 'telegram'
  telegramUserId: string
  telegramUsername?: string
} | {
  kind: 'application'
  applicationId: string
} | {
  kind: 'adminLogin'
  loginRequestId: string
}

export async function createFlowToken(payload: FlowToken, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(`flow:${payload.kind}`)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyFlowToken(token: string, kind: FlowToken['kind']) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'], issuer: TOKEN_ISSUER, audience: `flow:${kind}`,
    })
    if (payload.kind !== kind) return null
    if (kind === 'invite') return typeof payload.inviteCode === 'string' ? payload : null
    if (kind === 'telegram') return typeof payload.telegramUserId === 'string' ? payload : null
    if (kind === 'application') return typeof payload.applicationId === 'string' ? payload : null
    return typeof payload.loginRequestId === 'string' ? payload : null
  } catch {
    return null
  }
}
