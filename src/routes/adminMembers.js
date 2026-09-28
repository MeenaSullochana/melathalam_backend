import { Router } from 'express'
import {
  Member,
  Payment,
  Interest,
  WhoViewed,
  ContactView,
  RenewalRequest,
} from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'
import { md5 } from '../utils/md5.js'
import { cleanMember, createUploader, findMemberByMatriId } from '../utils/helpers.js'
import { activateMembership } from '../services/membership.js'

const router = Router()
router.use(requireAdmin)

const photoUpload = createUploader('my_photos')
const horoUpload = createUploader('horoscope-list')

function trimId(id) {
  return decodeURIComponent(String(id || '')).trim()
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const { status, fstatus, gender, q, renew, matri_id, email } = req.query
    const filter = {}

    if (status) filter.status = status
    if (fstatus) filter.fstatus = fstatus
    if (gender) filter.gender = gender
    if (matri_id) {
      filter.matri_id = new RegExp(`^\\s*${String(matri_id).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
    }
    if (email) {
      filter.email = new RegExp(String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }
    if (q) {
      const term = String(q).trim()
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { matri_id: new RegExp(`^\\s*${esc}\\s*$`, 'i') },
        { matri_id: new RegExp(esc, 'i') },
        { email: new RegExp(esc, 'i') },
        { mobile: new RegExp(esc, 'i') },
        { firstname: new RegExp(esc, 'i') },
        { lastname: new RegExp(esc, 'i') },
        { username: new RegExp(esc, 'i') },
      ]
    }
    // Renew list: Paid but expired (or Renew status)
    if (renew === '1' || renew === 'true') {
      const today = new Date().toISOString().slice(0, 10)
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { status: 'Renew' },
            { status: 'Paid', plan_expired_on: { $lt: today } },
            { status: 'Paid', plan_expired_on: { $exists: false } },
          ],
        },
      ]
      delete filter.status
    }

    const [total, members] = await Promise.all([
      Member.countDocuments(filter),
      Member.find(filter)
        .sort({ index_id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password -cpassword')
        .lean(),
    ])

    res.json({
      success: true,
      total,
      page,
      limit,
      members: members.map((m) => cleanMember(m)),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to list members' })
  }
})

router.get('/renewals', async (_req, res) => {
  try {
    const items = await RenewalRequest.find().sort({ rr_id: -1 }).limit(200).lean()
    const ids = items.map((i) => i.matri_id)
    const people = await Member.find({ matri_id: { $in: ids } })
      .select('matri_id firstname lastname email mobile status plan_name plan_expired_on')
      .lean()
    const map = Object.fromEntries(people.map((p) => [p.matri_id, p]))
    res.json({
      success: true,
      items: items.map((r) => ({ ...r, member: map[r.matri_id] || null })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load renewals' })
  }
})

router.post('/renewals/:rrId/decide', async (req, res) => {
  try {
    const action = String(req.body?.action || '').toLowerCase()
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approve or reject' })
    }
    const rr = await RenewalRequest.findOne({ rr_id: Number(req.params.rrId) })
    if (!rr) return res.status(404).json({ success: false, message: 'Request not found' })
    if (rr.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Already decided' })
    }
    rr.status = action === 'approve' ? 'Approved' : 'Rejected'
    rr.decided_at = new Date()
    await rr.save()
    if (action === 'approve') {
      await activateMembership(rr.matri_id, rr.plan_id, rr.plan_name)
    }
    res.json({ success: true, message: `Renewal ${rr.status.toLowerCase()}`, request: rr })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

router.get('/:matriId/history', async (req, res) => {
  try {
    const mid = trimId(req.params.matriId)
    const member = await findMemberByMatriId(Member, mid)
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' })

    const [payments, interestsSent, interestsReceived, profileViews, visitors, contacts, renewals] =
      await Promise.all([
        Payment.find({ matri_id: mid }).sort({ payid: -1 }).limit(100).lean(),
        Interest.find({ ei_sender: mid }).sort({ ei_id: -1 }).limit(100).lean(),
        Interest.find({ ei_receiver: mid }).sort({ ei_id: -1 }).limit(100).lean(),
        WhoViewed.find({ my_id: mid }).sort({ who_id: -1 }).limit(100).lean(),
        WhoViewed.find({ viewed_member_id: mid }).sort({ who_id: -1 }).limit(100).lean(),
        ContactView.find({
          $or: [{ viewer_id: mid }, { viewed_id: mid }],
        })
          .sort({ cv_id: -1 })
          .limit(100)
          .lean(),
        RenewalRequest.find({ matri_id: mid }).sort({ rr_id: -1 }).limit(50).lean(),
      ])

    res.json({
      success: true,
      member: cleanMember(member),
      history: {
        payments,
        interestsSent,
        interestsReceived,
        profilesViewed: profileViews,
        visitors,
        contacts,
        renewals,
        package: {
          plan_id: member.plan_id,
          plan_name: member.plan_name,
          plan_expired_on: member.plan_expired_on,
          status: member.status,
          p_profile: member.p_profile ?? member.profile,
          r_profile: member.r_profile,
          p_no_contacts: member.p_no_contacts,
          r_cnt: member.r_cnt,
        },
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load history' })
  }
})

router.post('/', async (req, res) => {
  try {
    const b = req.body || {}
    const max = await Member.findOne().sort({ index_id: -1 }).lean()
    const nextIndex = Number(max?.index_id || 0) + 1
    let matriId = trimId(b.matri_id)
    if (!matriId) {
      const prefix = String(b.matri_prefix || 'GT')
      matriId = `${prefix}${nextIndex}`
    }
    const exists = await findMemberByMatriId(Member, matriId)
    if (exists) {
      return res.status(400).json({ success: false, message: 'Matri ID already exists' })
    }
    const password = b.password || b.my_pass || '12345678'
    const doc = {
      ...b,
      index_id: nextIndex,
      matri_id: matriId,
      username: b.username || `${b.firstname || ''} ${b.lastname || ''}`.trim() || matriId,
      password: md5(password),
      status: b.status || 'Active',
      reg_date: new Date(),
    }
    delete doc._id
    delete doc.my_pass
    await Member.create(doc)
    const member = await findMemberByMatriId(Member, matriId)
    res.json({ success: true, member: cleanMember(member), message: 'Member created' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message || 'Failed to create member' })
  }
})

router.get('/:matriId', async (req, res) => {
  try {
    const member = await findMemberByMatriId(Member, req.params.matriId)
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' })
    res.json({ success: true, member: cleanMember(member) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load member' })
  }
})

router.put('/:matriId', async (req, res) => {
  try {
    const existing = await findMemberByMatriId(Member, req.params.matriId)
    if (!existing) return res.status(404).json({ success: false, message: 'Member not found' })
    const body = { ...(req.body || {}) }
    if (body.password || body.my_pass) body.password = md5(body.password || body.my_pass)
    else {
      delete body.password
      delete body.my_pass
    }
    delete body._id
    delete body.__v
    if (body.matri_id) body.matri_id = trimId(body.matri_id)
    await Member.updateOne({ _id: existing._id }, { $set: body })
    const member = await Member.findById(existing._id).lean()
    res.json({ success: true, member: cleanMember(member), message: 'Member updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update member' })
  }
})

router.patch('/:matriId/status', async (req, res) => {
  try {
    const existing = await findMemberByMatriId(Member, req.params.matriId)
    if (!existing) return res.status(404).json({ success: false, message: 'Member not found' })
    const { status, fstatus } = req.body || {}
    const $set = {}
    if (status) $set.status = status
    if (fstatus !== undefined) $set.fstatus = fstatus
    if (!Object.keys($set).length) {
      return res.status(400).json({ success: false, message: 'status or fstatus required' })
    }
    await Member.updateOne({ _id: existing._id }, { $set })
    res.json({ success: true, message: 'Status updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update status' })
  }
})

router.patch('/:matriId/plan', async (req, res) => {
  try {
    const existing = await findMemberByMatriId(Member, req.params.matriId)
    if (!existing) return res.status(404).json({ success: false, message: 'Member not found' })
    const { plan_id, plan_name, plan_status, plan_expired_on } = req.body || {}
    if (!plan_id && !plan_name) {
      return res.status(400).json({ success: false, message: 'plan_id or plan_name required' })
    }
    const $set = { status: 'Paid' }
    if (plan_id !== undefined) $set.plan_id = plan_id
    if (plan_name !== undefined) $set.plan_name = plan_name
    if (plan_status !== undefined) $set.plan_status = plan_status
    if (plan_expired_on !== undefined) $set.plan_expired_on = plan_expired_on
    await Member.updateOne({ _id: existing._id }, { $set })
    res.json({ success: true, message: 'Membership plan updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to update plan' })
  }
})

router.post(
  '/:matriId/photos',
  photoUpload.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 },
    { name: 'photo3', maxCount: 1 },
    { name: 'photo4', maxCount: 1 },
    { name: 'photo5', maxCount: 1 },
    { name: 'photo6', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const existing = await findMemberByMatriId(Member, req.params.matriId)
      if (!existing) return res.status(404).json({ success: false, message: 'Member not found' })
      const $set = {}
      for (let i = 1; i <= 6; i++) {
        const key = `photo${i}`
        const file = req.files?.[key]?.[0]
        if (file) {
          $set[key] = file.filename
          $set[`${key}_approve`] = 'APPROVED'
        }
      }
      if (!Object.keys($set).length) {
        return res.status(400).json({ success: false, message: 'No photos uploaded' })
      }
      await Member.updateOne({ _id: existing._id }, { $set })
      const member = await Member.findById(existing._id).lean()
      res.json({ success: true, member: cleanMember(member), message: 'Photos updated' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ success: false, message: 'Photo upload failed' })
    }
  },
)

router.post('/:matriId/horoscope-photo', horoUpload.single('hor_photo'), async (req, res) => {
  try {
    const existing = await findMemberByMatriId(Member, req.params.matriId)
    if (!existing) return res.status(404).json({ success: false, message: 'Member not found' })
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' })
    await Member.updateOne(
      { _id: existing._id },
      { $set: { hor_photo: req.file.filename, hor_check: 'APPROVED' } },
    )
    const member = await Member.findById(existing._id).lean()
    res.json({ success: true, member: cleanMember(member), message: 'Horoscope photo updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Horoscope upload failed' })
  }
})

router.delete('/:matriId', async (req, res) => {
  try {
    const existing = await findMemberByMatriId(Member, req.params.matriId)
    if (!existing) return res.status(404).json({ success: false, message: 'Member not found' })
    await Member.deleteOne({ _id: existing._id })
    res.json({ success: true, message: 'Member deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to delete member' })
  }
})

router.post('/bulk-status', async (req, res) => {
  try {
    const { matriIds = [], status } = req.body || {}
    if (!Array.isArray(matriIds) || !matriIds.length || !status) {
      return res.status(400).json({ success: false, message: 'matriIds and status required' })
    }
    const ids = matriIds.map(trimId)
    await Member.updateMany({ matri_id: { $in: ids } }, { $set: { status } })
    res.json({ success: true, message: `Updated ${ids.length} members` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Bulk update failed' })
  }
})

export default router
