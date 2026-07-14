import { randomInt } from 'node:crypto'

const CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomPart(length: number) {
  let result = ''

  for (let i = 0; i < length; i++) {
    result += CHARACTERS.charAt(
      randomInt(CHARACTERS.length)
    )
  }

  return result
}

export function generateInviteCode() {
  return `${randomPart(4)}-${randomPart(4)}`
}
