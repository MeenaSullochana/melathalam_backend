import { Router } from 'express'
import { Member, SuccessStory } from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAdmin)

router.get('/photos', async (req, res) => {
  try {
    const slot = Math.min(6, Math.max(1, Number(req.query.slot) || 1))
    const photo = `photo${slot}`
    const approve = `photo${slot}_approve`
    const items = await Member.find({
      [photo]: { $exists: true, $nin: [null, '', 'default.png'] },
      $or: [{ [approve]: 'UNAPPROVED' }, { [approve]: null }, { [approve]: '' }, { [approve]: { $exists: false } }],
    })
      .sort({ index_id: -1 })
      .limit(100)
      .select(`index_id matri_id username firstname lastname gender ${photo} ${approve}`)
      .lean()

    res.json({
      success: true,
      slot,
      items: items.map((m) => ({
        ...m,
        photo: m[photo],
        approve_status: m[approve],
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load photo approvals' })
  }
})

router.post('/photos/:matriId/:slot', async (req, res) => {
  try {
    const slot = Math.min(6, Math.max(1, Number(req.params.slot) || 1))
    const action = (req.body?.action || 'approve').toLowerCase()
    const approveCol = `photo${slot}_approve`
    const photoCol = `photo${slot}`
    if (action === 'delete') {
      await Member.updateOne(
        { matri_id: req.params.matriId },
        { $set: { [photoCol]: null, [approveCol]: null } },
      )
    } else {
      await Member.updateOne(
        { matri_id: req.params.matriId },
        { $set: { [approveCol]: action === 'reject' ? 'UNAPPROVED' : 'APPROVED' } },
      )
    }
    res.json({ success: true, message: 'Photo updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Photo action failed' })
  }
})

router.get('/about-me', async (_req, res) => {
  const items = await Member.find({
    profile_text: { $exists: true, $nin: [null, ''] },
    profile_text_approve: { $nin: ['Approve', 'APPROVED'] },
  })
    .sort({ index_id: -1 })
    .limit(100)
    .select('index_id matri_id username firstname lastname profile_text profile_text_approve profile_text_date')
    .lean()
  res.json({ success: true, items })
})

router.post('/about-me/:matriId', async (req, res) => {
  const action = (req.body?.action || 'approve').toLowerCase()
  await Member.updateOne(
    { matri_id: req.params.matriId },
    { $set: { profile_text_approve: action === 'reject' ? 'UNAPPROVED' : 'Approve' } },
  )
  res.json({ success: true, message: 'About me updated' })
})

router.get('/partner-expect', async (_req, res) => {
  const items = await Member.find({
    part_expect: { $exists: true, $nin: [null, ''] },
    part_expect_approve: { $nin: ['APPROVED'] },
  })
    .sort({ index_id: -1 })
    .limit(100)
    .select('index_id matri_id username firstname lastname part_expect part_expect_approve part_expect_date')
    .lean()
  res.json({ success: true, items })
})

router.post('/partner-expect/:matriId', async (req, res) => {
  const action = (req.body?.action || 'approve').toLowerCase()
  await Member.updateOne(
    { matri_id: req.params.matriId },
    { $set: { part_expect_approve: action === 'reject' ? 'UNAPPROVED' : 'APPROVED' } },
  )
  res.json({ success: true, message: 'Updated' })
})

router.get('/horoscope', async (_req, res) => {
  const items = await Member.find({
    hor_photo: { $exists: true, $nin: [null, ''] },
    hor_check: { $in: ['UNAPPROVED', null] },
  })
    .sort({ index_id: -1 })
    .limit(100)
    .select('index_id matri_id username firstname lastname hor_photo hor_check star moonsign manglik')
    .lean()
  res.json({ success: true, items })
})

router.post('/horoscope/:matriId', async (req, res) => {
  const action = (req.body?.action || 'approve').toLowerCase()
  if (action === 'delete') {
    await Member.updateOne({ matri_id: req.params.matriId }, { $set: { hor_photo: null, hor_check: null } })
  } else {
    await Member.updateOne(
      { matri_id: req.params.matriId },
      { $set: { hor_check: action === 'reject' ? 'UNAPPROVED' : 'APPROVED' } },
    )
  }
  res.json({ success: true, message: 'Horoscope updated' })
})

router.get('/aadhaar', async (_req, res) => {
  const items = await Member.find({
    aadhaar_card: { $exists: true, $nin: [null, ''] },
    aadhaar_card_status: { $in: ['UNAPPROVED', 'PENDING', null] },
  })
    .sort({ index_id: -1 })
    .limit(100)
    .select('index_id matri_id username firstname lastname aadhaar_card aadhaar_card_status')
    .lean()
  res.json({ success: true, items })
})

router.post('/aadhaar/:matriId', async (req, res) => {
  const action = (req.body?.action || 'approve').toLowerCase()
  await Member.updateOne(
    { matri_id: req.params.matriId },
    { $set: { aadhaar_card_status: action === 'reject' ? 'UNAPPROVED' : 'APPROVED' } },
  )
  res.json({ success: true, message: 'Aadhaar updated' })
})

function isApproved(val) {
  const s = String(val || '').trim().toUpperCase()
  return s === 'APPROVED' || s === 'APPROVE' || s === 'YES'
}

function isPending(val) {
  const s = String(val || '').trim().toUpperCase()
  return !s || s === 'UNAPPROVED' || s === 'PENDING' || s === 'REJECT' || s === 'REJECTED'
}

/** Unified inbox: members with any pending approval item */
router.get('/pending-members', async (_req, res) => {
  try {
    const or = [
      {
        profile_text: { $exists: true, $nin: [null, ''] },
        profile_text_approve: { $nin: ['Approve', 'APPROVED', 'approve', 'Approved'] },
      },
      {
        part_expect: { $exists: true, $nin: [null, ''] },
        part_expect_approve: { $nin: ['APPROVED', 'Approved', 'Approve'] },
      },
      {
        hor_photo: { $exists: true, $nin: [null, ''] },
        hor_check: { $in: ['UNAPPROVED', 'PENDING', null, ''] },
      },
      {
        aadhaar_card: { $exists: true, $nin: [null, ''] },
        aadhaar_card_status: { $in: ['UNAPPROVED', 'PENDING', null, ''] },
      },
    ]
    for (let i = 1; i <= 6; i++) {
      or.push({
        [`photo${i}`]: { $exists: true, $nin: [null, '', 'default.png'] },
        $or: [
          { [`photo${i}_approve`]: 'UNAPPROVED' },
          { [`photo${i}_approve`]: null },
          { [`photo${i}_approve`]: '' },
          { [`photo${i}_approve`]: { $exists: false } },
          { [`photo${i}_approve`]: 'PENDING' },
        ],
      })
    }

    const members = await Member.find({ $or: or })
      .sort({ index_id: -1 })
      .limit(200)
      .select(
        'index_id matri_id username firstname lastname email gender status photo1 profile_text profile_text_approve part_expect part_expect_approve hor_photo hor_check aadhaar_card aadhaar_card_status photo1_approve photo2 photo2_approve photo3 photo3_approve photo4 photo4_approve photo5 photo5_approve photo6 photo6_approve',
      )
      .lean()

    const items = members.map((m) => {
      const pending = []
      if (m.profile_text && !isApproved(m.profile_text_approve)) pending.push('About me')
      if (m.part_expect && !isApproved(m.part_expect_approve)) pending.push('Partner expectation')
      if (m.hor_photo && isPending(m.hor_check)) pending.push('Horoscope')
      if (m.aadhaar_card && isPending(m.aadhaar_card_status)) pending.push('Aadhaar')
      for (let i = 1; i <= 6; i++) {
        const ph = m[`photo${i}`]
        if (ph && ph !== 'default.png' && isPending(m[`photo${i}_approve`])) pending.push(`Photo ${i}`)
      }
      return {
        matri_id: m.matri_id,
        name: [m.firstname, m.lastname].filter(Boolean).join(' ') || m.username,
        email: m.email,
        gender: m.gender,
        status: m.status,
        photo1: m.photo1,
        pending,
        pendingCount: pending.length,
      }
    }).filter((x) => x.pendingCount > 0)

    res.json({ success: true, items, total: items.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load pending approvals' })
  }
})

/** All approval flags for one member (admin member check screen) */
router.get('/member/:matriId', async (req, res) => {
  try {
    const mid = decodeURIComponent(String(req.params.matriId || '')).trim()
    const m = await Member.findOne({
      $or: [{ matri_id: mid }, { matri_id: new RegExp(`^\\s*${mid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }],
    }).lean()
    if (!m) return res.status(404).json({ success: false, message: 'Member not found' })

    const items = []
    if (m.profile_text) {
      items.push({
        key: 'about-me',
        label: 'About me',
        value: m.profile_text,
        status: isApproved(m.profile_text_approve) ? 'APPROVED' : 'PENDING',
        raw: m.profile_text_approve,
      })
    }
    if (m.part_expect) {
      items.push({
        key: 'partner-expect',
        label: 'Partner expectation',
        value: m.part_expect,
        status: isApproved(m.part_expect_approve) ? 'APPROVED' : 'PENDING',
        raw: m.part_expect_approve,
      })
    }
    if (m.hor_photo) {
      items.push({
        key: 'horoscope',
        label: 'Horoscope',
        value: m.hor_photo,
        type: 'image',
        imageKind: 'horo',
        status: isApproved(m.hor_check) ? 'APPROVED' : 'PENDING',
        raw: m.hor_check,
      })
    }
    if (m.aadhaar_card) {
      const isImg = /\.(jpe?g|png|webp)$/i.test(String(m.aadhaar_card))
      items.push({
        key: 'aadhaar',
        label: 'Aadhaar / ID',
        value: m.aadhaar_card,
        type: isImg ? 'image' : 'text',
        imageKind: isImg ? 'doc' : undefined,
        status: isApproved(m.aadhaar_card_status) ? 'APPROVED' : 'PENDING',
        raw: m.aadhaar_card_status,
      })
    }
    for (let i = 1; i <= 6; i++) {
      const ph = m[`photo${i}`]
      if (ph && ph !== 'default.png') {
        items.push({
          key: `photo${i}`,
          label: `Photo ${i}`,
          value: ph,
          type: 'image',
          imageKind: 'photo',
          slot: i,
          status: isApproved(m[`photo${i}_approve`]) ? 'APPROVED' : 'PENDING',
          raw: m[`photo${i}_approve`],
        })
      }
    }

    res.json({
      success: true,
      matri_id: m.matri_id,
      items,
      pendingCount: items.filter((i) => i.status === 'PENDING').length,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

/** Approve / reject one or many items for a member. body: { action, keys?: string[] } or { action: 'approve-all' } */
router.post('/member/:matriId', async (req, res) => {
  try {
    const mid = decodeURIComponent(String(req.params.matriId || '')).trim()
    const m = await Member.findOne({
      $or: [{ matri_id: mid }, { matri_id: new RegExp(`^\\s*${mid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }],
    }).lean()
    if (!m) return res.status(404).json({ success: false, message: 'Member not found' })

    const action = String(req.body?.action || 'approve').toLowerCase()
    const approveAll = action === 'approve-all' || action === 'approveall'
    const rejectAll = action === 'reject-all' || action === 'rejectall'
    let keys = Array.isArray(req.body?.keys) ? req.body.keys : req.body?.key ? [req.body.key] : []

    if (approveAll || rejectAll) {
      keys = []
      if (m.profile_text) keys.push('about-me')
      if (m.part_expect) keys.push('partner-expect')
      if (m.hor_photo) keys.push('horoscope')
      if (m.aadhaar_card) keys.push('aadhaar')
      for (let i = 1; i <= 6; i++) {
        if (m[`photo${i}`] && m[`photo${i}`] !== 'default.png') keys.push(`photo${i}`)
      }
    }

    if (!keys.length) {
      return res.status(400).json({ success: false, message: 'No approval keys provided' })
    }

    const doApprove = approveAll || action === 'approve'
    const $set = {}
    for (const key of keys) {
      if (key === 'about-me') $set.profile_text_approve = doApprove ? 'Approve' : 'UNAPPROVED'
      else if (key === 'partner-expect') $set.part_expect_approve = doApprove ? 'APPROVED' : 'UNAPPROVED'
      else if (key === 'horoscope') $set.hor_check = doApprove ? 'APPROVED' : 'UNAPPROVED'
      else if (key === 'aadhaar') $set.aadhaar_card_status = doApprove ? 'APPROVED' : 'UNAPPROVED'
      else if (/^photo[1-6]$/.test(key)) $set[`${key}_approve`] = doApprove ? 'APPROVED' : 'UNAPPROVED'
    }

    await Member.updateOne({ _id: m._id }, { $set })
    res.json({
      success: true,
      message: doApprove ? `Approved ${keys.length} item(s)` : `Rejected ${keys.length} item(s)`,
      keys,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Approval update failed' })
  }
})

router.get('/success-stories', async (_req, res) => {
  const items = await SuccessStory.find({ status: 'UNAPPROVED' }).sort({ story_id: -1 }).limit(100).lean()
  res.json({ success: true, items })
})

router.post('/success-stories/:id', async (req, res) => {
  const action = (req.body?.action || 'approve').toLowerCase()
  if (action === 'delete') {
    await SuccessStory.deleteOne({ story_id: Number(req.params.id) })
  } else {
    await SuccessStory.updateOne(
      { story_id: Number(req.params.id) },
      { $set: { status: action === 'reject' ? 'UNAPPROVED' : 'APPROVED' } },
    )
  }
  res.json({ success: true, message: 'Story updated' })
})

export default router
