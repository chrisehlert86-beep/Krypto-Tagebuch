import { supabase } from './supabase'
import { log } from './logger'

export async function createMember(app: any): Promise<boolean> {
  try {
    /*
     * Existiert das Mitglied bereits?
     */
    const { data: existing, error: selectError } = await supabase
      .from('members')
      .select('id')
      .eq('application_id', app.id)
      .maybeSingle()

    if (selectError) {
      log(`Mitglied konnte nicht geprüft werden: ${selectError.message}`)
      return false
    }

    if (existing) {
      log(
        `Mitglied ${app.first_name} ${app.last_name} existiert bereits.`
      )
      return true
    }

    /*
     * Mitglied anlegen
     */
    const { error: insertError } = await supabase
      .from('members')
      .insert({
        application_id: app.id,
        invite_code: app.invite_code,

        first_name: app.first_name,
        last_name: app.last_name,

        telegram_user_id: app.telegram_user_id,
        telegram_username: app.telegram_username,

        joined_at: new Date().toISOString(),
        status: 'active',
      })

    if (insertError) {
      log(`Mitglied konnte nicht angelegt werden: ${insertError.message}`)
      return false
    }

    log(
      `Mitglied angelegt: ${app.first_name} ${app.last_name}`
    )

    return true

  } catch (error) {

    console.error(error)

    return false

  }
}