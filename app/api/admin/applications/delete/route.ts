import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/require-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { writeAdminAudit } from '@/lib/admin-audit'

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  try {
    const { id } = await request.json()

    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ error: 'Keine Bewerbungs-ID übergeben.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('applications')
      .delete()
      .eq('id', id)
      .in('status', ['pending', 'rejected'])
      .select('id')
      .maybeSingle()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Bewerbung konnte nicht gelöscht werden.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Freigegebene oder aktive Bewerbungen können hier nicht gelöscht werden.' },
        { status: 409 },
      )
    }

    await writeAdminAudit('application.delete', 'application', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Interner Serverfehler.' }, { status: 500 })
  }
}
