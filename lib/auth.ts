import 'server-only'

import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

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

export async function createSession() {
  return await new SignJWT({
    admin: true,
  })
    .setProtectedHeader({
      alg: 'HS256',
    })
    .setExpirationTime('12h')
    .sign(getSecret())
}

export async function verifySession(token: string) {
  try {
    const { payload } =
      await jwtVerify(token, getSecret())

    return payload.admin === true

  } catch {

    return false

  }
}

type FlowToken = {
  kind: 'invite'
  inviteCode: string
} | {
  kind: 'telegram'
  telegramUserId: string
  telegramUsername?: string
}

export async function createFlowToken(payload: FlowToken, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyFlowToken(token: string, kind: FlowToken['kind']) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.kind === kind ? payload : null
  } catch {
    return null
  }
}
