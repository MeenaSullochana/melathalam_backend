import { Member, Plan, Payment, SiteConfig, ContactView } from '../models/index.js'

/** Activate / renew membership and seed PHP-style quotas on member + payment */
export async function activateMembership(matriId, planId, planName, paymentDoc = null) {
  const mid = String(matriId || '').trim()
  const plan = await Plan.findOne({ plan_id: Number(planId) }).lean()
  const days = Number(plan?.plan_duration || 30)
  const exp = new Date()
  exp.setDate(exp.getDate() + (Number.isFinite(days) ? days : 30))
  const profileQuota = Number(plan?.profile ?? plan?.plan_profile ?? 0) || 0
  const contactQuota = Number(plan?.plan_contacts ?? 0) || 0
  const msgQuota = Number(plan?.plan_msg ?? 0) || 0
  const smsQuota = Number(plan?.plan_sms ?? 0) || 0

  const $set = {
    status: 'Paid',
    plan_id: planId,
    plan_name: planName || plan?.plan_name,
    plan_status: 'Active',
    plan_expired_on: exp.toISOString().slice(0, 10),
    p_profile: profileQuota,
    profile: profileQuota,
    r_profile: 0,
    p_no_contacts: contactQuota,
    r_cnt: 0,
    p_msg: msgQuota,
    r_msg: 0,
    p_sms: smsQuota,
    r_sms: 0,
  }
  await Member.updateOne({ matri_id: mid }, { $set })

  if (paymentDoc) {
    const payFilter = paymentDoc._id
      ? { _id: paymentDoc._id }
      : { payid: Number(paymentDoc.payid) }
    await Payment.updateOne(payFilter, {
      $set: {
        profile: profileQuota,
        r_profile: 0,
        p_no_contacts: contactQuota,
        r_cnt: 0,
        p_msg: msgQuota,
        r_msg: 0,
        exp_date: exp.toISOString().slice(0, 10),
        status: 'Paid',
      },
    }).catch(() => {})
  }

  return { ...$set, plan }
}

export function planRemaining(me = {}) {
  const profilesTotal = Number(me.p_profile ?? me.profile ?? 0) || 0
  const profilesUsed = Number(me.r_profile ?? 0) || 0
  const contactsTotal = Number(me.p_no_contacts ?? 0) || 0
  const contactsUsed = Number(me.r_cnt ?? 0) || 0
  const expired =
    me.plan_expired_on && new Date(me.plan_expired_on) < new Date(new Date().toDateString())
  const isPaid = String(me.status || '').toLowerCase() === 'paid' && !expired
  return {
    isPaid,
    expired: !!expired,
    plan_name: me.plan_name || '',
    plan_id: me.plan_id,
    plan_expired_on: me.plan_expired_on || '',
    profilesTotal,
    profilesUsed,
    profilesLeft: Math.max(0, profilesTotal - profilesUsed),
    contactsTotal,
    contactsUsed,
    contactsLeft: Math.max(0, contactsTotal - contactsUsed),
  }
}

export async function getSiteGates() {
  const cfg = (await SiteConfig.findOne().lean()) || {}
  return {
    interest_setting: cfg.interest_setting || 'All', // All | Paid
    profile_view_setting: cfg.profile_view_setting || 'All',
    contact_view_setting: cfg.contact_view_setting || 'Paid',
    username_setting: cfg.username_setting || 'Yes',
    default_male_photo: cfg.default_male_photo || 'male.png',
    default_female_photo: cfg.default_female_photo || 'female.png',
    default_horoscope: cfg.default_horoscope || '',
    default_document: cfg.default_document || 'document-default.jpg',
  }
}

/**
 * Consume one profile-view credit (PHP: payments.profile / r_profile).
 * Free/basic members may be blocked by site gate.
 */
export async function consumeProfileView(viewerMatriId, targetMatriId) {
  if (!viewerMatriId || viewerMatriId === targetMatriId) {
    return { ok: true, charged: false }
  }
  const gates = await getSiteGates()
  const me = await Member.findOne({ matri_id: viewerMatriId }).lean()
  if (!me) return { ok: false, message: 'Viewer not found' }

  const rem = planRemaining(me)
  if (gates.profile_view_setting === 'Paid' && !rem.isPaid) {
    return { ok: false, code: 'UPGRADE', message: 'Upgrade membership to view full profiles' }
  }

  // Already viewed before — don't charge again
  // (caller still logs WhoViewed; we only decrement once per unique target)
  // Check in-memory: under mongoose strictQuery, filtering on undeclared
  // `viewed_profiles` would be stripped and falsely match every member.
  if (rem.isPaid && rem.profilesTotal > 0) {
    const viewed = Array.isArray(me.viewed_profiles) ? me.viewed_profiles : []
    const already = viewed.includes(targetMatriId)
    if (!already) {
      if (rem.profilesLeft <= 0) {
        return { ok: false, code: 'QUOTA', message: 'Profile view limit reached. Renew or upgrade your plan.' }
      }
      await Member.updateOne(
        { matri_id: viewerMatriId },
        {
          $inc: { r_profile: 1 },
          $addToSet: { viewed_profiles: targetMatriId },
        },
      )
      return { ok: true, charged: true, remaining: rem.profilesLeft - 1 }
    }
  }
  return { ok: true, charged: false, remaining: rem.profilesLeft }
}

/** Unlock contact details (PHP contact_detail / contact_checker) */
export async function unlockContact(viewerMatriId, targetMatriId) {
  const mid = String(viewerMatriId || '').trim()
  const tid = String(targetMatriId || '').trim()
  if (!mid || !tid || mid === tid) {
    return { ok: false, message: 'Invalid request' }
  }
  const gates = await getSiteGates()
  const me = await Member.findOne({ matri_id: mid }).lean()
  if (!me) return { ok: false, message: 'Member not found' }
  const rem = planRemaining(me)

  if (gates.contact_view_setting === 'Paid' && !rem.isPaid) {
    return { ok: false, code: 'UPGRADE', message: 'Paid membership required to view contacts' }
  }

  const existing = await ContactView.findOne({ viewer_id: mid, viewed_id: tid }).lean()
  if (existing) {
    const target = await Member.findOne({ matri_id: tid })
      .select('matri_id email mobile mobile_code address firstname lastname username')
      .lean()
    return { ok: true, already: true, contact: target, remaining: rem.contactsLeft }
  }

  if (rem.isPaid && rem.contactsTotal > 0 && rem.contactsLeft <= 0) {
    return { ok: false, code: 'QUOTA', message: 'Contact view limit reached. Renew your plan.' }
  }

  const max = await ContactView.findOne().sort({ cv_id: -1 }).lean()
  await ContactView.create({
    cv_id: Number(max?.cv_id || 0) + 1,
    viewer_id: mid,
    viewed_id: tid,
    viewed_date: new Date(),
  })
  if (rem.isPaid && rem.contactsTotal > 0) {
    await Member.updateOne({ matri_id: mid }, { $inc: { r_cnt: 1 } })
  }
  const target = await Member.findOne({ matri_id: tid })
    .select('matri_id email mobile mobile_code address firstname lastname username')
    .lean()
  return {
    ok: true,
    already: false,
    contact: target,
    remaining: Math.max(0, rem.contactsLeft - 1),
  }
}

export async function canSendInterest(senderMatriId) {
  const gates = await getSiteGates()
  if (gates.interest_setting !== 'Paid') return { ok: true }
  const me = await Member.findOne({ matri_id: senderMatriId }).lean()
  const rem = planRemaining(me || {})
  if (!rem.isPaid) {
    return { ok: false, message: 'Only paid members can send interest. Please upgrade.' }
  }
  return { ok: true }
}
