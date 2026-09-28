import { Router } from 'express'
import {
  Member,
  Interest,
  Shortlist,
  WhoViewed,
  Plan,
  RenewalRequest,
  ContactView,
} from '../models/index.js'
import { requireMember, optionalMember } from '../middleware/auth.js'
import { findMemberByMatriId, cleanMember } from '../utils/helpers.js'
import {
  applyAdvancedFilters,
  oppositeGender,
  preferenceFilter,
  MATCH_SELECT,
} from '../services/matchQuery.js'
import {
  consumeProfileView,
  unlockContact,
  canSendInterest,
  planRemaining,
  getSiteGates,
} from '../services/membership.js'

const router = Router()

function stripSensitive(row) {
  return cleanMember(row)
}

router.get('/dashboard', requireMember, async (req, res) => {
  try {
    const mid = req.user.matriId
    const me = await Member.findOne({ matri_id: mid }).lean()
    const opp = oppositeGender(me?.gender)
    const pref = preferenceFilter(me || {})
    const prefFilter = {
      status: { $nin: ['Inactive', 'Suspended'] },
      gender: opp,
      matri_id: { $ne: mid },
      ...(pref.$and ? { $and: pref.$and } : {}),
    }
    const [matches, preferred, received, sent, shortlisted, visitors, activity] = await Promise.all([
      Member.countDocuments({
        status: { $nin: ['Inactive', 'Suspended'] },
        gender: opp,
        matri_id: { $ne: mid },
      }),
      Member.countDocuments(prefFilter),
      Interest.countDocuments({
        ei_receiver: mid,
        trash_receiver: 'No',
        receiver_response: 'Pending',
      }),
      Interest.countDocuments({ ei_sender: mid, trash_sender: 'No' }),
      Shortlist.countDocuments({ from_id: mid }),
      WhoViewed.countDocuments({ viewed_member_id: mid }),
      Interest.find({
        $or: [{ ei_sender: mid }, { ei_receiver: mid }],
        trash_sender: 'No',
        trash_receiver: 'No',
      })
        .sort({ ei_id: -1 })
        .limit(10)
        .lean(),
    ])

    res.json({
      success: true,
      stats: {
        matches,
        preferred,
        interestsReceived: received,
        interestsSent: sent,
        shortlisted,
        visitors,
        status: me?.status,
        featured: me?.fstatus,
      },
      activity,
      me: stripSensitive(me),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load dashboard' })
  }
})

async function listMatches(req, res, { preferredOnly = false } = {}) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Number(req.query.limit) || 12)
  const me = await Member.findOne({ matri_id: req.user.matriId }).lean()
  const filter = {
    status: { $nin: ['Inactive', 'Suspended'] },
    matri_id: { $ne: req.user.matriId },
    gender: oppositeGender(me?.gender),
  }
  applyAdvancedFilters(filter, req.query)
  if (preferredOnly || req.query.mode === 'preferred') {
    const pref = preferenceFilter(me || {})
    if (pref.$and?.length) {
      filter.$and = [...(filter.$and || []), ...pref.$and]
    }
  }

  const [total, rows] = await Promise.all([
    Member.countDocuments(filter),
    Member.find(filter)
      .sort({ fstatus: -1, last_login: -1, index_id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(MATCH_SELECT)
      .lean(),
  ])

  res.json({
    success: true,
    total,
    page,
    limit,
    mode: preferredOnly || req.query.mode === 'preferred' ? 'preferred' : 'all',
    matches: rows.map(stripSensitive),
  })
}

router.get('/matches', requireMember, async (req, res) => {
  try {
    await listMatches(req, res)
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load matches' })
  }
})

router.get('/preferred-matches', requireMember, async (req, res) => {
  try {
    await listMatches(req, res, { preferredOnly: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load preferred matches' })
  }
})

router.get('/profile/:matriId', optionalMember, async (req, res) => {
  try {
    const member = await findMemberByMatriId(Member, req.params.matriId)
    if (!member || member.status === 'Suspended' || member.status === 'Inactive') {
      return res.status(404).json({ success: false, message: 'Profile not found' })
    }

    let viewMeta = { ok: true }
    if (req.user?.matriId && req.user.matriId !== String(member.matri_id).trim()) {
      viewMeta = await consumeProfileView(req.user.matriId, String(member.matri_id).trim())
      if (!viewMeta.ok) {
        return res.status(403).json({
          success: false,
          code: viewMeta.code,
          message: viewMeta.message,
        })
      }
      const max = await WhoViewed.findOne().sort({ who_id: -1 }).lean()
      await WhoViewed.create({
        who_id: Number(max?.who_id || 0) + 1,
        my_id: req.user.matriId,
        viewed_member_id: String(member.matri_id).trim(),
        viewed_date: new Date(),
      }).catch(() => {})
    }

    const full = req.query.full === '1' || req.query.full === 'true'
    const out = stripSensitive(member)
    const isSelf = req.user?.matriId === String(member.matri_id).trim()
    let contactUnlocked = isSelf
    if (!isSelf && req.user?.matriId) {
      const cv = await ContactView.findOne({
        viewer_id: req.user.matriId,
        viewed_id: String(member.matri_id).trim(),
      }).lean()
      contactUnlocked = !!cv
    }

    if (!full && !isSelf && !contactUnlocked) {
      delete out.mobile
      delete out.email
      delete out.address
      delete out.mobile_code
    }

    const viewer = req.user?.matriId
      ? await Member.findOne({ matri_id: req.user.matriId }).lean()
      : null

    res.json({
      success: true,
      member: out,
      contactUnlocked,
      plan: viewer ? planRemaining(viewer) : null,
      view: viewMeta,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

router.get('/plan', requireMember, async (req, res) => {
  try {
    const me = await Member.findOne({ matri_id: req.user.matriId }).lean()
    const rem = planRemaining(me || {})
    const plan = me?.plan_id ? await Plan.findOne({ plan_id: Number(me.plan_id) }).lean() : null
    const gates = await getSiteGates()
    res.json({ success: true, plan: rem, planDetails: plan, gates, me: stripSensitive(me) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load plan' })
  }
})

router.post('/contacts/unlock', requireMember, async (req, res) => {
  try {
    const toId = String(req.body?.matriId || req.body?.toMatriId || '').trim()
    const result = await unlockContact(req.user.matriId, toId)
    if (!result.ok) {
      return res.status(403).json({ success: false, code: result.code, message: result.message })
    }
    res.json({
      success: true,
      contact: stripSensitive(result.contact),
      already: result.already,
      remaining: result.remaining,
      message: result.already ? 'Contact already unlocked' : 'Contact unlocked',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to unlock contact' })
  }
})

router.post('/renewal-request', requireMember, async (req, res) => {
  try {
    const { plan_id, note } = req.body || {}
    const me = await Member.findOne({ matri_id: req.user.matriId }).lean()
    const plan = plan_id
      ? await Plan.findOne({ plan_id: Number(plan_id) }).lean()
      : me?.plan_id
        ? await Plan.findOne({ plan_id: Number(me.plan_id) }).lean()
        : null
    const pending = await RenewalRequest.findOne({
      matri_id: req.user.matriId,
      status: 'Pending',
    }).lean()
    if (pending) {
      return res.status(409).json({ success: false, message: 'Renewal request already pending admin approval' })
    }
    const max = await RenewalRequest.findOne().sort({ rr_id: -1 }).lean()
    const doc = {
      rr_id: Number(max?.rr_id || 0) + 1,
      matri_id: req.user.matriId,
      plan_id: plan?.plan_id || me?.plan_id,
      plan_name: plan?.plan_name || me?.plan_name,
      note: note || 'Membership renewal requested',
      status: 'Pending',
      created_at: new Date(),
    }
    await RenewalRequest.create(doc)
    res.json({ success: true, message: 'Renewal request submitted for admin approval', request: doc })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to submit renewal' })
  }
})

router.get('/renewal-request', requireMember, async (req, res) => {
  const items = await RenewalRequest.find({ matri_id: req.user.matriId }).sort({ rr_id: -1 }).limit(20).lean()
  res.json({ success: true, items })
})

router.get('/interests', requireMember, async (req, res) => {
  try {
    const mid = req.user.matriId
    const [receivedRaw, sentRaw] = await Promise.all([
      Interest.find({ ei_receiver: mid, trash_receiver: 'No' }).sort({ ei_id: -1 }).limit(100).lean(),
      Interest.find({ ei_sender: mid, trash_sender: 'No' }).sort({ ei_id: -1 }).limit(100).lean(),
    ])

    const senderIds = receivedRaw.map((r) => r.ei_sender)
    const receiverIds = sentRaw.map((r) => r.ei_receiver)
    const people = await Member.find({
      matri_id: { $in: [...new Set([...senderIds, ...receiverIds])] },
    })
      .select('matri_id username firstname lastname photo1 gender')
      .lean()
    const map = Object.fromEntries(people.map((p) => [p.matri_id, p]))

    const received = receivedRaw.map((e) => ({
      ...e,
      ...(map[e.ei_sender] || {}),
      profile_id: e.ei_sender,
      mutual: e.receiver_response === 'Accept',
    }))
    const sent = sentRaw.map((e) => ({
      ...e,
      ...(map[e.ei_receiver] || {}),
      profile_id: e.ei_receiver,
      mutual: e.receiver_response === 'Accept',
    }))
    const matched = [
      ...received.filter((e) => e.receiver_response === 'Accept'),
      ...sent.filter((e) => e.receiver_response === 'Accept'),
    ]

    res.json({ success: true, received, sent, matched })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

router.post('/interests', requireMember, async (req, res) => {
  try {
    const gate = await canSendInterest(req.user.matriId)
    if (!gate.ok) return res.status(403).json({ success: false, message: gate.message })

    const { toMatriId, message } = req.body || {}
    if (!toMatriId) return res.status(400).json({ success: false, message: 'toMatriId required' })
    const toId = String(toMatriId).trim()
    if (toId === req.user.matriId) {
      return res.status(400).json({ success: false, message: 'Cannot send interest to yourself' })
    }
    const existing = await Interest.findOne({
      ei_sender: req.user.matriId,
      ei_receiver: toId,
      trash_sender: 'No',
    }).lean()
    if (existing) {
      return res.status(409).json({ success: false, message: 'Interest already sent' })
    }
    const max = await Interest.findOne().sort({ ei_id: -1 }).lean()
    await Interest.create({
      ei_id: Number(max?.ei_id || 0) + 1,
      ei_sender: req.user.matriId,
      ei_receiver: toId,
      receiver_response: 'Pending',
      ei_message: message || 'I am interested in your profile.',
      ei_sent_date: new Date(),
      status: 'APPROVED',
      trash_receiver: 'No',
      trash_sender: 'No',
    })
    res.json({ success: true, message: 'Interest sent' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to send interest' })
  }
})

router.post('/interests/:id/respond', requireMember, async (req, res) => {
  try {
    const action = (req.body?.action || '').toLowerCase()
    if (!['accept', 'reject', 'pending'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be accept, reject, or pending' })
    }
    const response =
      action === 'accept' ? 'Accept' : action === 'reject' ? 'Reject' : 'Pending'
    const updated = await Interest.findOneAndUpdate(
      { ei_id: Number(req.params.id), ei_receiver: req.user.matriId },
      { $set: { receiver_response: response } },
      { new: true },
    ).lean()
    if (!updated) return res.status(404).json({ success: false, message: 'Interest not found' })
    res.json({
      success: true,
      message:
        response === 'Accept'
          ? 'Interest accepted — you are now a mutual match'
          : response === 'Reject'
            ? 'Marked as Not Interested'
            : 'Interest set to pending',
      interest: updated,
      mutual: response === 'Accept',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

router.post('/interests/:id/trash', requireMember, async (req, res) => {
  try {
    const ei = await Interest.findOne({ ei_id: Number(req.params.id) }).lean()
    if (!ei) return res.status(404).json({ success: false, message: 'Not found' })
    const mid = req.user.matriId
    if (ei.ei_sender === mid) {
      await Interest.updateOne({ ei_id: ei.ei_id }, { $set: { trash_sender: 'Yes' } })
    } else if (ei.ei_receiver === mid) {
      await Interest.updateOne({ ei_id: ei.ei_id }, { $set: { trash_receiver: 'Yes' } })
    } else {
      return res.status(403).json({ success: false, message: 'Not allowed' })
    }
    res.json({ success: true, message: 'Moved to trash' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

router.get('/shortlist', requireMember, async (req, res) => {
  const items = await Shortlist.find({ from_id: req.user.matriId }).sort({ sh_id: -1 }).lean()
  const ids = items.map((i) => i.to_id)
  const people = await Member.find({ matri_id: { $in: ids } })
    .select('matri_id username firstname lastname photo1 gender')
    .lean()
  const map = Object.fromEntries(people.map((p) => [p.matri_id, p]))
  res.json({
    success: true,
    items: items.map((s) => ({ ...s, ...(map[s.to_id] || {}) })),
  })
})

router.post('/shortlist', requireMember, async (req, res) => {
  const { toMatriId } = req.body || {}
  if (!toMatriId) return res.status(400).json({ success: false, message: 'toMatriId required' })
  const existing = await Shortlist.findOne({ from_id: req.user.matriId, to_id: toMatriId }).lean()
  if (existing) return res.json({ success: true, message: 'Already shortlisted' })
  const max = await Shortlist.findOne().sort({ sh_id: -1 }).lean()
  await Shortlist.create({
    sh_id: Number(max?.sh_id || 0) + 1,
    from_id: req.user.matriId,
    to_id: toMatriId,
    add_date: new Date(),
  })
  res.json({ success: true, message: 'Added to shortlist' })
})

router.delete('/shortlist/:toMatriId', requireMember, async (req, res) => {
  await Shortlist.deleteOne({ from_id: req.user.matriId, to_id: req.params.toMatriId })
  res.json({ success: true, message: 'Removed' })
})

export default router
