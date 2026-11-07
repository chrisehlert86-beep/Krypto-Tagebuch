import { NextResponse } from 'next/server'
import { getLivePrices } from '@/lib/live-prices'

export async function GET() {
  try {
    return NextResponse.json({ quotes: await getLivePrices(), serverTime: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Live-Kurse momentan nicht verfügbar.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
