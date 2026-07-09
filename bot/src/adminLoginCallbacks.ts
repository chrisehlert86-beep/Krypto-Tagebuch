import { bot } from './telegram'
import { supabase } from './supabase'
import { log } from './logger'

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data

  if (!data) return

  /*
   * Login freigeben
   */
  if (data.startsWith('approve_login:')) {

    const id = data.replace('approve_login:', '')

    const { error } = await supabase
      .from('admin_login_requests')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      log(error.message)

      await ctx.answerCbQuery(
        'Freigabe fehlgeschlagen.'
      )

      return
    }

    await ctx.editMessageText(
      '✅ Administrator-Anmeldung wurde freigegeben.'
    )

    await ctx.answerCbQuery()

    return
  }

  /*
   * Login ablehnen
   */
  if (data.startsWith('reject_login:')) {

    const id = data.replace('reject_login:', '')

    const { error } = await supabase
      .from('admin_login_requests')
      .update({
        rejected: true,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {

      log(error.message)

      await ctx.answerCbQuery(
        'Ablehnung fehlgeschlagen.'
      )

      return
    }

    await ctx.editMessageText(
      '❌ Administrator-Anmeldung wurde abgelehnt.'
    )

    await ctx.answerCbQuery()

    return
  }

})