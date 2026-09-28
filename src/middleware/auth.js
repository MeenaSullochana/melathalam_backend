import jwt from 'jsonwebtoken'

function getToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7)
  return req.headers['x-access-token'] || null
}

export function requireMember(req, res, next) {
  try {
    const token = getToken(req)
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.role !== 'member') {
      return res.status(403).json({ success: false, message: 'Member access required' })
    }
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export function requireAdmin(req, res, next) {
  try {
    const token = getToken(req)
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' })
    }
    req.admin = payload
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

export function optionalMember(req, _res, next) {
  try {
    const token = getToken(req)
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      if (payload.role === 'member') req.user = payload
    }
  } catch {
    /* ignore */
  }
  next()
}
