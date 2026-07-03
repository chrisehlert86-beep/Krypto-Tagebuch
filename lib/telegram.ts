const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const API = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function sendTelegramMessage(
  chatId: number | string,
  text: string
) {
  const response = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })

  return response.json()
}

export async function approveJoinRequest(
  chatId: string | number,
  userId: string | number
) {
  const response = await fetch(`${API}/approveChatJoinRequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
    }),
  })

  return response.json()
}

export async function declineJoinRequest(
  chatId: string | number,
  userId: string | number
) {
  const response = await fetch(`${API}/declineChatJoinRequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
    }),
  })

  return response.json()
}