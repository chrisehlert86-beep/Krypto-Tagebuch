import { bot } from './telegram'
import { supabase } from './supabase'
import { log } from './logger'

bot.on('chat_join_request', async (ctx) => {
  try {
    const request = ctx.update.chat_join_request

    const telegramUserId = request.from.id
    const telegramUsername = request.from.username ?? null

    log(`Neue Join Request von ${telegramUserId}`)

    /*
     * Passende Bewerbung suchen
     */
    const { data: application, error } = await supabase
      .from('applications')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle()

    if (error) {
      log(`Supabase-Fehler: ${error.message}`)
      return
    }

    if (!application) {
      log(
        `Keine Bewerbung für Telegram User ${telegramUserId} gefunden.`
      )
      return
    }

    /*
     * Join Request speichern
     */
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        telegram_username: telegramUsername,
        telegram_join_requested: true,
        telegram_join_requested_at: new Date().toISOString(),
      })
      .eq('id', application.id)

    if (updateError) {
      log(
        `Join Request konnte nicht gespeichert werden: ${updateError.message}`
      )
      return
    }

    log(
      `Join Request gespeichert für ${application.first_name} ${application.last_name}`
    )

  } catch (error) {
    console.error(error)
  }
})