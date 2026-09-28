import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { AdminUser, lean } from '../models/index.js'
import { md5 } from '../utils/md5.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

function signAdmin(admin) {
  return jwt.sign(
    {
      role: 'admin',
      id: admin.id || admin._id,
      uname: admin.uname,
      email: admin.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  )
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' })
    }
    const hashed = md5(password)
    const admin = await AdminUser.findOne({
      uname: username,
      pswd: hashed,
      role_id: 1,
    }).lean()
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Username or Password Wrong.' })
    }
    const token = signAdmin(admin)
    res.json({
      success: true,
      token,
      admin: { id: admin.id || admin._id, uname: admin.uname, email: admin.email },
    })
  } catch (err) {
    console.error('admin login', err)
    res.status(500).json({ success: false, message: 'Login failed' })
  }
})

router.get('/me', requireAdmin, async (req, res) => {
  const admin = await AdminUser.findOne({
    $or: [{ id: req.admin.id }, { uname: req.admin.uname }],
  }).lean()
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' })
  res.json({
    success: true,
    admin: { id: admin.id || admin._id, uname: admin.uname, email: admin.email, role_id: admin.role_id, status: admin.status },
  })
})

router.post('/change-password', requireAdmin, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {}
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords required' })
    }
    const admin = await AdminUser.findOne({
      $or: [{ id: req.admin.id }, { uname: req.admin.uname }],
      pswd: md5(oldPassword),
    })
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' })
    }
    admin.pswd = md5(newPassword)
    await admin.save()
    res.json({ success: true, message: 'Password updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update password' })
  }
})

/** Forgot password — generates a temporary password (PHP admin parity) */
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || req.body?.forgotlogid || '').trim()
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' })
    }
    const admin = await AdminUser.findOne({
      email,
      $or: [{ status: '1' }, { status: 1 }, { status: 'ACTIVE' }, { status: { $exists: false } }],
    })
    if (!admin) {
      return res.json({
        success: true,
        message: 'If that email is registered, a temporary password has been issued.',
      })
    }
    const tempPassword = String(Math.floor(1000000000 + Math.random() * 9000000000))
    admin.pswd = md5(tempPassword)
    await admin.save()
    res.json({
      success: true,
      message: 'Temporary password generated. Sign in, then change it under Site Settings → Change Password.',
      tempPassword,
      username: admin.uname,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to reset password' })
  }
})

export default router
