import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.ADMIN_SESSION_SECRET!
)

export async function verifyPassword(password: string) {
  return bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH!
  )
}

export async function createSession() {
  return await new SignJWT({
    admin: true,
  })
    .setProtectedHeader({
      alg: 'HS256',
    })
    .setExpirationTime('12h')
    .sign(secret)
}

export async function verifySession(token: string) {
  try {
    const { payload } =
      await jwtVerify(token, secret)

    return payload.admin === true

  } catch {

    return false

  }
}