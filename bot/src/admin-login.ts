import { bot } from './telegram'
import { supabase } from './supabase'
import { log } from './logger'

bot.action(/^approve_login_(.+)/, async (ctx) => {
  try {

    const id = ctx.match[1]

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
      '✅ Anmeldung wurde genehmigt.'
    )

    log(`Login ${id} genehmigt`)

  } catch (err) {

    console.error(err)

  }
})

bot.action(/^deny_login_(.+)/, async (ctx) => {
  try {

    const id = ctx.match[1]

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
      '❌ Anmeldung wurde abgelehnt.'
    )

    log(`Login ${id} abgelehnt`)

  } catch (err) {

    console.error(err)

  }
})