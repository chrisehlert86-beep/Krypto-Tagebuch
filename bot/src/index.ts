import { bot } from './telegram'

import './joinRequests'
import './approvals'
import './members'
import './welcome'
import './adminLogin'
import './adminLoginCallbacks'
import './admin-login'

bot.launch()

console.log('Bot läuft...')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))