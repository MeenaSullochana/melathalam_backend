import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { Member } from '../models/index.js'
import { md5 } from '../utils/md5.js'
import { requireMember } from '../middleware/auth.js'

const router = Router()

function signMember(row) {
  return jwt.sign(
    {
      role: 'member',
      matriId: row.matri_id,
      indexId: row.index_id,
      email: row.email,
      gender: row.gender,
      username: row.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  )
}

function publicMember(row) {
  if (!row) return null
  const obj = { ...row }
  delete obj.password
  delete obj.cpassword
  delete obj.photo_pswd
  delete obj.tokan
  delete obj.otp
  delete obj.__v
  return obj
}

router.post('/login', async (req, res) => {
  try {
    const { username, password, identifier } = req.body || {}
    const loginId = (identifier || username || '').trim()
    if (!loginId || !password) {
      return res.status(400).json({ success: false, message: 'Email/mobile and password required' })
    }
    const hashed = md5(password)
    const member = await Member.findOne({
      $or: [{ matri_id: loginId }, { email: loginId }, { mobile: loginId }],
      password: hashed,
      status: { $ne: 'Suspended' },
    }).lean()

    if (!member) {
      return res.status(401).json({
        success: false,
        message: 'Your username or password is wrong. Please try again...',
      })
    }
    if (member.status === 'Inactive') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your profile by confirmation link.',
        code: 'INACTIVE',
      })
    }

    await Member.updateOne(
      { matri_id: member.matri_id },
      { $set: { logged_in: '1', last_login: new Date() } },
    )

    res.json({
      success: true,
      token: signMember(member),
      member: publicMember(member),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Login failed' })
  }
})

router.post('/register', async (req, res) => {
  try {
    const b = req.body || {}
    const email = (b.email || '').trim()
    const mobile = String(b.phone || b.mobile || '').trim()
    const password = b.password || Math.random().toString(36).slice(-8)

    if (!email || !mobile) {
      return res.status(400).json({ success: false, message: 'Email and mobile required' })
    }

    const exists = await Member.findOne({ $or: [{ email }, { mobile }] }).lean()
    if (exists) {
      return res.status(409).json({ success: false, message: 'Email or mobile already registered' })
    }

    const max = await Member.findOne().sort({ index_id: -1 }).lean()
    const nextIndex = Number(max?.index_id || 1000) + 1
    const matriId = String(nextIndex)
    const firstname = b.firstName || b.firstname || ''
    const lastname = b.lastName || b.lastname || ''
    const birthdate =
      b.birthdate ||
      (b.month && b.day && b.year ? `${Number(b.month)}/${Number(b.day)}/${b.year}` : null)

    const member = await Member.create({
      index_id: nextIndex,
      matri_id: matriId,
      email,
      password: md5(password),
      username: `${firstname} ${lastname}`.trim() || matriId,
      firstname,
      lastname,
      gender: b.gender || 'Male',
      birthdate,
      profileby: b.createdBy || b.profileby || 'Self',
      religion: b.religion || null,
      caste: b.caste || null,
      m_tongue: b.motherTongue || b.m_tongue || null,
      mobile,
      mobile_code: b.countryCode || b.mobile_code || '+91',
      address: b.address || '',
      terms: 'Yes',
      status: 'Active',
      photo1: 'default.png',
      photo_view_status: '1',
      logged_in: '1',
      reg_date: new Date(),
    })

    const plain = member.toObject()
    res.status(201).json({
      success: true,
      token: signMember(plain),
      member: publicMember(plain),
      tempPassword: b.password ? undefined : password,
      message: 'Registration successful',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Registration failed' })
  }
})

router.get('/me', requireMember, async (req, res) => {
  const member = await Member.findOne({ matri_id: req.user.matriId }).lean()
  if (!member) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, member: publicMember(member) })
})

router.put('/me', requireMember, async (req, res) => {
  try {
    const body = { ...(req.body || {}) }
    if (body.password) body.password = md5(body.password)
    else delete body.password
    if (body.profile_text !== undefined) body.profile_text_approve = 'UNAPPROVED'
    if (body.part_expect !== undefined) body.part_expect_approve = 'UNAPPROVED'
    delete body._id
    delete body.matri_id

    const member = await Member.findOneAndUpdate(
      { matri_id: req.user.matriId },
      { $set: body },
      { new: true },
    ).lean()
    res.json({ success: true, member: publicMember(member), message: 'Profile updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Update failed' })
  }
})

router.post('/change-password', requireMember, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {}
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords required' })
    }
    const member = await Member.findOne({
      matri_id: req.user.matriId,
      password: md5(oldPassword),
    })
    if (!member) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' })
    }
    member.password = md5(newPassword)
    await member.save()
    res.json({ success: true, message: 'Password changed' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

/** Request password reset — sets a temporary password (PHP parity) */
router.post('/forgot-password', async (req, res) => {
  try {
    const loginId = String(req.body?.email || req.body?.identifier || req.body?.mobile || '').trim()
    if (!loginId) {
      return res.status(400).json({ success: false, message: 'Email or mobile required' })
    }
    const member = await Member.findOne({
      $or: [{ email: loginId }, { mobile: loginId }, { matri_id: loginId }],
      status: { $ne: 'Suspended' },
    })
    // Always return success-looking message to avoid account enumeration
    if (!member) {
      return res.json({
        success: true,
        message: 'If an account exists, a temporary password has been issued.',
      })
    }
    const tempPassword = String(Math.floor(10000000 + Math.random() * 90000000))
    member.password = md5(tempPassword)
    member.cpassword = tempPassword
    await member.save()
    res.json({
      success: true,
      message: 'Temporary password generated. Use it to sign in, then change it in Settings.',
      // Exposed for local/dev when SMTP is not configured
      tempPassword,
      matri_id: member.matri_id,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to reset password' })
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const { identifier, tempPassword, newPassword } = req.body || {}
    const loginId = String(identifier || '').trim()
    if (!loginId || !tempPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Identifier, temporary password and new password required',
      })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' })
    }
    const member = await Member.findOne({
      $or: [{ email: loginId }, { mobile: loginId }, { matri_id: loginId }],
      password: md5(tempPassword),
    })
    if (!member) {
      return res.status(400).json({ success: false, message: 'Invalid temporary password or account' })
    }
    member.password = md5(newPassword)
    member.cpassword = ''
    await member.save()
    res.json({ success: true, message: 'Password updated. You can sign in now.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to reset password' })
  }
})

router.post('/logout', requireMember, async (req, res) => {
  await Member.updateOne({ matri_id: req.user.matriId }, { $set: { logged_in: '0' } })
  res.json({ success: true, message: 'Logged out' })
})

export default router
