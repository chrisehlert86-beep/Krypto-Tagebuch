import { cookies } from 'next/headers'
import { verifySession } from './auth'

export async function requireAdmin() {
  const cookieStore = await cookies()

  const token =
    cookieStore.get('admin-session')?.value

  if (!token) {
    return false
  }

  return await verifySession(token)
}