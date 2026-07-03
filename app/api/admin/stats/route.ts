import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const [
      pendingResult,
      approvedResult,
      memberResult,
      inviteResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('applications')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'pending'),

      supabaseAdmin
        .from('applications')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'approved'),

      supabaseAdmin
        .from('members')
        .select('*', {
          count: 'exact',
          head: true,
        }),

      supabaseAdmin
        .from('invites')
        .select('*', {
          count: 'exact',
          head: true,
        }),
    ])

    return NextResponse.json({
      pending: pendingResult.count ?? 0,
      approved: approvedResult.count ?? 0,
      members: memberResult.count ?? 0,
      invites: inviteResult.count ?? 0,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Interner Serverfehler.',
      },
      {
        status: 500,
      }
    )
  }
}