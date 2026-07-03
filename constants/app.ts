/**
 * Zentrale Konfiguration der Anwendung.
 */

export const APP_NAME = 'Krypto-Tagebuch'

export const DISCLAIMER_VERSION = 'v1'

export const APPLICATION_STATUS = 'pending'

export const TELEGRAM_GROUP_URL = 'https://t.me/DEINE_GRUPPE'

export const APP_VERSION = '0.1.0'

export const TELEGRAM_BOT =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ??
  'krypto_tagebuch_bot'