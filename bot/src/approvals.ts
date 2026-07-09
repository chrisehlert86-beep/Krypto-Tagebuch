import { supabase } from './supabase'
import { bot } from './telegram'
import { log } from './logger'
import { createMember } from './members'

async function checkApprovals() {
  try {

    const { data: applications, error } = await supabase
      .from('applications')
      .select('*')
      .eq('status', 'approved')
      .eq('telegram_join_requested', true)
      .eq('telegram_approved', false)

    if (error) {
      log(error.message)
      return
    }

    if (!applications || applications.length === 0) {
      return
    }

    for (const app of applications) {

      try {

        log(
          `Freigabe für ${app.first_name} ${app.last_name}`
        )

        /*
         * Join Request bei Telegram genehmigen
         */
        await bot.telegram.approveChatJoinRequest(
          process.env.TELEGRAM_GROUP_ID!,
          app.telegram_user_id
        )

        /*
         * Mitglied anlegen
         */
        const memberCreated = await createMember(app)

        if (!memberCreated) {
          log(
            `Mitglied konnte nicht angelegt werden: ${app.first_name} ${app.last_name}`
          )
          continue
        }

        /*
         * Bewerbung auf aktiv setzen
         */
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            telegram_approved: true,
            telegram_approved_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', app.id)

        if (updateError) {
          log(updateError.message)
          continue
        }

        log(
          `${app.first_name} ${app.last_name} erfolgreich freigeschaltet`
        )

      } catch (error) {

        console.error(error)

      }

    }

  } catch (error) {

    console.error(error)

  }
}

/*
 * Alle 5 Sekunden nach neuen Freigaben suchen
 */
setInterval(checkApprovals, 5000)