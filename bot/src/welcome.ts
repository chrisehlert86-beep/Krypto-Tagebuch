import { bot } from './telegram'
import { log } from './logger'

bot.on('chat_member', async (ctx) => {
  try {

    const member = ctx.update.chat_member

    if (!member) {
      return
    }

    /*
     * Nur reagieren, wenn jemand Mitglied geworden ist
     */
    if (member.new_chat_member.status !== 'member') {
      return
    }

    const user = member.new_chat_member.user

    log(
      `Willkommensnachricht an ${user.first_name} (${user.id})`
    )

    await bot.telegram.sendMessage(
      user.id,
`🎉 Willkommen im Krypto-Tagebuch!

Deine Bewerbung wurde erfolgreich freigegeben und du bist jetzt offizielles Mitglied unserer Community.

Bitte lies dir zunächst die angehefteten Nachrichten in der Gruppe durch.

Viel Erfolg und herzlich willkommen! 🚀`
    )

  } catch (error) {

    console.error(error)

  }
})