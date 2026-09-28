import crypto from 'crypto'

/** Match legacy PHP md5() password hashing */
export function md5(value) {
  return crypto.createHash('md5').update(String(value ?? ''), 'utf8').digest('hex')
}
