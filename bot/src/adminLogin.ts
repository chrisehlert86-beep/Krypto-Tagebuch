import { bot } from './telegram'
import { supabase } from './supabase'
import { log } from './logger'

async function checkAdminLogins() {
  try {
    const { data: requests, error } = await supabase
      .from('admin_login_requests')
      .select('*')
      .eq('approved', false)
      .eq('rejected', false)
      .is('telegram_message_id', null)

    if (error) {
      log(error.message)
      return
    }

    if (!requests || requests.length === 0) {
      return
    }

    const adminId = Number(process.env.ADMIN_TELEGRAM_USER_ID)

    if (!adminId) {
      log('ADMIN_TELEGRAM_USER_ID fehlt.')
      return
    }

    for (const request of requests) {
      try {
        const message = await bot.telegram.sendMessage(
          adminId,
          `🔐 Neue Administrator-Anmeldung

🌐 IP:
${request.ip_address ?? 'Unbekannt'}

💻 Browser:
${request.user_agent ?? 'Unbekannt'}

Zeit:
${new Date(request.created_at).toLocaleString('de-DE')}

Bestätigung erforderlich.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '✅ Zulassen',
                    callback_data: `approve_login:${request.id}`,
                  },
                  {
                    text: '❌ Ablehnen',
                    callback_data: `reject_login:${request.id}`,
                  },
                ],
              ],
            },
          }
        )

        const { error: updateError } = await supabase
          .from('admin_login_requests')
          .update({
            telegram_message_id: message.message_id,
          })
          .eq('id', request.id)

        if (updateError) {
          log(updateError.message)
        }

      } catch (err) {

        console.error(err)

      }
    }

  } catch (err) {

    console.error(err)

  }
}

/*
 * Alle 2 Sekunden nach neuen Login-Anfragen suchen
 */
setInterval(checkAdminLogins, 2000)