import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function writeAdminAudit(
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    metadata,
  })

  if (error) {
    console.error('Admin-Audit-Log konnte nicht geschrieben werden.', error)
  }
}
