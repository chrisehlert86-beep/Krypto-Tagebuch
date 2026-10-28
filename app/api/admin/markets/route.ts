import { NextResponse } from 'next/server'

import { getCurrentMarketAnalyses } from '@/lib/market-analysis'
import { requireAdmin } from '@/lib/require-admin'

export async function GET() {
  const localPreview = process.env.NODE_ENV === 'development' &&
    Boolean(process.env.MARKET_ANALYSIS_FIXTURE_PATH)

  if (!localPreview && !(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  try {
    const markets = await getCurrentMarketAnalyses()
    return NextResponse.json(
      { markets },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Marktanalysen konnten nicht geladen werden.' },
      { status: 500 },
    )
  }
}
