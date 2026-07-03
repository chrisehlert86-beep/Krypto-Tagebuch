import crypto from 'crypto'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const hash = body.hash

    delete body.hash

    const dataCheckString = Object.keys(body)
      .sort()
      .map((key) => `${key}=${body[key]}`)
      .join('\n')

    const secret = crypto
      .createHash('sha256')
      .update(process.env.TELEGRAM_BOT_TOKEN!)
      .digest()

    const calculatedHash = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex')

    if (calculatedHash !== hash) {
      return NextResponse.json(
        {
          error: 'Telegram Auth ungültig.',
        },
        {
          status: 401,
        }
      )
    }

    return NextResponse.json({
      success: true,
      telegramUserId: body.id,
      telegramUsername: body.username ?? null,
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        error: 'Serverfehler.',
      },
      {
        status: 500,
      }
    )
  }
}