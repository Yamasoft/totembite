export function normalizePhoneNational(value) {
  let digits = String(value ?? '').replace(/\D/g, '')

  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2)
  }

  return digits.slice(0, 11)
}

export function formatPhoneNational(value) {
  const digits = normalizePhoneNational(value)

  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
