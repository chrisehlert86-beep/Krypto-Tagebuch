export const INVITE_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

export function isValidInviteCode(value: unknown): value is string {
  return typeof value === 'string' && INVITE_CODE_PATTERN.test(value)
}

export function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100
}

export function acceptedAllDisclaimers(values: readonly unknown[]) {
  return values.length === 3 && values.every((value) => value === true)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
