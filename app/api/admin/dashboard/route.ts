import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const [
      pendingApplications,
      approvedApplications,
      availableInvites,
    ] = await Promise.all([
      supabaseAdmin
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),

      supabaseAdmin
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),

      supabaseAdmin
        .from('invites')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .eq('used', false),
    ])

    return NextResponse.json({
      pending: pendingApplications.count ?? 0,
      approved: approvedApplications.count ?? 0,
      invites: availableInvites.count ?? 0,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Dashboard konnte nicht geladen werden.' },
      { status: 500 }
    )
  }
}