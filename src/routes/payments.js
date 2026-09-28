import { Router } from 'express'
import { Payment, PaymentMethod, Plan, Member } from '../models/index.js'
import { requireMember, requireAdmin } from '../middleware/auth.js'
import { createUploader } from '../utils/helpers.js'
import { activateMembership } from '../services/membership.js'

const router = Router()
const qrUpload = createUploader('img/qr')

function publicMethod(m) {
  if (!m) return null
  const out = {
    pay_id: m.pay_id,
    pay_name: m.pay_name || m.name,
    status: m.status,
    type: Number(m.pay_id) === 2 ? 'gateway' : 'manual',
  }
  if (Number(m.pay_id) === 2) {
    out.razorpay_key = m.razorpay_key || ''
    // never expose secret from admin if stored
  } else {
    out.bank_name = m.bank_name
    out.bank_account_no = m.bank_account_no
    out.bank_account_name = m.bank_account_name
    out.bank_account_type = m.bank_account_type
    out.bank_ifsc = m.bank_ifsc
    out.payment_phone = m.payment_phone
    out.payment_qr = m.payment_qr
  }
  return out
}

/** Ensure default Bank + Razorpay rows exist */
export async function ensurePaymentMethods() {
  const count = await PaymentMethod.countDocuments()
  if (count > 0) return
  await PaymentMethod.create([
    {
      pay_id: 1,
      pay_name: 'Bank / Manual / QR',
      status: 'ACTIVE',
      bank_name: '',
      bank_account_no: '',
      bank_account_name: '',
      bank_account_type: 'Savings',
      bank_ifsc: '',
      payment_phone: '',
      payment_qr: '',
    },
    {
      pay_id: 2,
      pay_name: 'Razorpay',
      status: 'ACTIVE',
      razorpay_key: '',
      razorpay_secret: '',
    },
  ])
}

router.get('/methods', async (_req, res) => {
  try {
    await ensurePaymentMethods()
    const methods = await PaymentMethod.find({
      $or: [{ status: 'ACTIVE' }, { status: '1' }, { status: 'APPROVED' }, { status: { $exists: false } }],
    }).lean()
    res.json({
      success: true,
      methods: methods.map(publicMethod).filter((m) => m && String(m.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load payment methods' })
  }
})

router.post('/checkout', requireMember, async (req, res) => {
  try {
    const { plan_id, pay_id, note } = req.body || {}
    if (!plan_id || !pay_id) {
      return res.status(400).json({ success: false, message: 'plan_id and pay_id required' })
    }
    const plan = await Plan.findOne({ plan_id: Number(plan_id) }).lean()
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' })
    const method = await PaymentMethod.findOne({ pay_id: Number(pay_id) }).lean()
    if (!method) return res.status(404).json({ success: false, message: 'Payment method not found' })

    const max = await Payment.findOne().sort({ payid: -1 }).lean()
    const payid = Number(max?.payid || max?.id || 0) + 1
    const doc = {
      payid,
      matri_id: req.user.matriId,
      plan_id: plan.plan_id,
      plan_name: plan.plan_name,
      plan_amount: plan.plan_amount,
      pay_id: Number(pay_id),
      pay_name: method.pay_name,
      mode: Number(pay_id) === 2 ? 'gateway' : 'manual',
      status: Number(pay_id) === 2 ? 'Initiated' : 'Pending',
      note: note || '',
      created_at: new Date(),
      pay_date: new Date(),
    }
    await Payment.create(doc)

    const response = {
      success: true,
      payment: doc,
      method: publicMethod(method),
      plan,
    }

    if (Number(pay_id) === 2) {
      // Frontend opens Razorpay Checkout with key; secret stays on server only
      response.razorpay = {
        key: method.razorpay_key || '',
        amount: Math.round(Number(plan.plan_amount || 0) * 100),
        currency: 'INR',
        name: plan.plan_name,
        description: `Membership ${plan.plan_name}`,
        order_receipt: `pay_${payid}`,
      }
      if (!method.razorpay_key) {
        response.message = 'Razorpay key not configured in admin. Use manual payment or update keys.'
      }
    } else {
      response.message = 'Complete bank transfer / UPI using QR, then submit payment proof.'
    }

    res.json(response)
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Checkout failed' })
  }
})

router.post('/manual-confirm', requireMember, async (req, res) => {
  try {
    const { payid, txn_ref, note } = req.body || {}
    if (!payid) return res.status(400).json({ success: false, message: 'payid required' })
    const payment = await Payment.findOne({ payid: Number(payid), matri_id: req.user.matriId })
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })
    payment.status = 'Awaiting Approval'
    payment.txn_ref = txn_ref || ''
    payment.note = note || payment.note
    payment.updated_at = new Date()
    await payment.save()
    res.json({ success: true, message: 'Submitted for admin approval', payment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Confirm failed' })
  }
})

router.post('/gateway-confirm', requireMember, async (req, res) => {
  try {
    const { payid, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {}
    if (!payid || !razorpay_payment_id) {
      return res.status(400).json({ success: false, message: 'payid and razorpay_payment_id required' })
    }
    const payment = await Payment.findOne({ payid: Number(payid), matri_id: req.user.matriId })
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })

    // Keys-only setup: store gateway ids; activate membership (signature verify needs secret — optional)
    payment.status = 'Paid'
    payment.razorpay_payment_id = razorpay_payment_id
    payment.razorpay_order_id = razorpay_order_id || ''
    payment.razorpay_signature = razorpay_signature || ''
    payment.updated_at = new Date()
    await payment.save()

    await activateMembership(payment.matri_id, payment.plan_id, payment.plan_name, payment)

    res.json({ success: true, message: 'Payment recorded. Membership activated.', payment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Gateway confirm failed' })
  }
})

router.get('/my', requireMember, async (req, res) => {
  const payments = await Payment.find({ matri_id: req.user.matriId }).sort({ payid: -1 }).limit(50).lean()
  res.json({ success: true, payments })
})

/** Admin: approve manual payment */
router.post('/admin/approve/:payid', requireAdmin, async (req, res) => {
  try {
    const payment = await Payment.findOne({ payid: Number(req.params.payid) })
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' })
    payment.status = 'Paid'
    payment.approved_at = new Date()
    await payment.save()
    await activateMembership(payment.matri_id, payment.plan_id, payment.plan_name, payment)
    res.json({ success: true, message: 'Approved & membership activated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Approve failed' })
  }
})

export default router

export { qrUpload, publicMethod }
