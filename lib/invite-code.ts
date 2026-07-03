const CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomPart(length: number) {
  let result = ''

  for (let i = 0; i < length; i++) {
    result += CHARACTERS.charAt(
      Math.floor(Math.random() * CHARACTERS.length)
    )
  }

  return result
}

export function generateInviteCode() {
  return `${randomPart(4)}-${randomPart(4)}`
}