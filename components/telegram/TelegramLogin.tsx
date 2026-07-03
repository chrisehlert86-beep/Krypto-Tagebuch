'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    onTelegramAuth(user: any): void
  }
}

type Props = {
  onSuccess: () => void
}

export default function TelegramLogin({ onSuccess }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      const response = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error)
        return
      }

      sessionStorage.setItem(
        'telegram_user_id',
        result.telegramUserId
      )

      sessionStorage.setItem(
        'telegram_username',
        result.telegramUsername ?? ''
      )

      onSuccess()
    }

    if (!ref.current) return

    ref.current.innerHTML = ''

    const script = document.createElement('script')

    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true

    script.setAttribute(
      'data-telegram-login',
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME!
    )

    script.setAttribute('data-size', 'large')

    script.setAttribute(
      'data-userpic',
      'true'
    )

    script.setAttribute(
      'data-request-access',
      'write'
    )

    script.setAttribute(
      'data-onauth',
      'onTelegramAuth(user)'
    )

    ref.current.appendChild(script)

  }, [onSuccess])

  return <div ref={ref} />
}