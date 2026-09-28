import { Router } from 'express'
import { Plan, Payment } from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAdmin)

router.get('/', async (_req, res) => {
  const plans = await Plan.find().sort({ plan_id: -1 }).lean()
  res.json({ success: true, plans })
})

router.get('/payments/list', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = 30
  const [payments, total] = await Promise.all([
    Payment.find().sort({ payid: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(),
  ])
  res.json({ success: true, payments, total, page })
})

router.post('/', async (req, res) => {
  try {
    const b = req.body || {}
    const max = await Plan.findOne().sort({ plan_id: -1 }).lean()
    await Plan.create({
      plan_id: Number(max?.plan_id || 0) + 1,
      plan_name: b.plan_name,
      plan_type: b.plan_type || 'PAID',
      plan_amount: Number(b.plan_amount) || 0,
      plan_amount_type: b.plan_amount_type || 'Rs.',
      plan_duration: Number(b.plan_duration) || 30,
      plan_contacts: Number(b.plan_contacts) || 0,
      profile: Number(b.profile) || 0,
      plan_msg: Number(b.plan_msg) || 0,
      plan_sms: Number(b.plan_sms) || 0,
      video: b.video || 'No',
      chat: b.chat || 'Yes',
      plan_offers: b.plan_offers || null,
      status: b.status || 'APPROVED',
    })
    res.json({ success: true, message: 'Plan created' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Create failed' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const b = req.body || {}
    await Plan.updateOne(
      { plan_id: Number(req.params.id) },
      {
        $set: {
          plan_name: b.plan_name,
          plan_type: b.plan_type || 'PAID',
          plan_amount: Number(b.plan_amount) || 0,
          plan_amount_type: b.plan_amount_type || 'Rs.',
          plan_duration: Number(b.plan_duration) || 30,
          plan_contacts: Number(b.plan_contacts) || 0,
          profile: Number(b.profile) || 0,
          plan_msg: Number(b.plan_msg) || 0,
          plan_sms: Number(b.plan_sms) || 0,
          video: b.video || 'No',
          chat: b.chat || 'Yes',
          plan_offers: b.plan_offers || null,
          status: b.status || 'APPROVED',
        },
      },
    )
    res.json({ success: true, message: 'Plan updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Update failed' })
  }
})

router.delete('/:id', async (req, res) => {
  await Plan.deleteOne({ plan_id: Number(req.params.id) })
  res.json({ success: true, message: 'Plan deleted' })
})

export default router
