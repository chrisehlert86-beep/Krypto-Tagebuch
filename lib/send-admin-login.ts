const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID!

type LoginRequest = {
  id: string
  ip_address: string
  user_agent: string
}

export async function sendAdminLogin(
  login: LoginRequest
) {
  const text = `
🔐 Neue Admin-Anmeldung

🌍 IP:
${login.ip_address}

💻 Browser:
${login.user_agent}

Bitte bestätigen oder ablehnen.
`

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Genehmigen',
                callback_data: `approve_login_${login.id}`,
              },
            ],
            [
              {
                text: '❌ Ablehnen',
                callback_data: `deny_login_${login.id}`,
              },
            ],
          ],
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(
      'Telegram-Nachricht konnte nicht gesendet werden.'
    )
  }

  const result = await response.json()

  return result.result.message_id as number
}