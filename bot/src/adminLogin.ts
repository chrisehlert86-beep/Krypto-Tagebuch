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

    if (!requests?.length) {
      return
    }

    for (const request of requests) {
      const message = await bot.telegram.sendMessage(
        Number(process.env.ADMIN_TELEGRAM_USER_ID),
        `🔐 Neue Administrator-Anmeldung

🌐 IP:
${request.ip_address}

💻 Browser:
${request.user_agent}

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

      await supabase
        .from('admin_login_requests')
        .update({
          telegram_message_id: message.message_id,
        })
        .eq('id', request.id)
    }

  } catch (err) {
    console.error(err)
  }
}

setInterval(checkAdminLogins, 2000)