import { Router } from 'express'
import { SiteConfig, FieldSettings, PaymentMethod, EmailSetting } from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'
import { createUploader } from '../utils/helpers.js'
import { DEFAULT_EMAIL_SETTINGS, DEFAULT_FIELD_SETTINGS } from '../config/defaultSettings.js'

const router = Router()
router.use(requireAdmin)

const siteUpload = createUploader('img')

function stripMeta(doc = {}) {
  const out = { ...doc }
  delete out._id
  delete out.__v
  delete out.createdAt
  delete out.updatedAt
  return out
}

router.get('/site', async (_req, res) => {
  let config = await SiteConfig.findOne().lean()
  if (!config) config = await SiteConfig.create({ id: '1' }).then((d) => d.toObject())
  res.json({ success: true, config })
})

router.put('/site', async (req, res) => {
  const body = { ...(req.body || {}) }
  delete body._id
  delete body.__v
  const config = await SiteConfig.findOneAndUpdate({}, { $set: body }, { upsert: true, new: true }).lean()
  res.json({ success: true, config, message: 'Settings saved' })
})

router.post(
  '/site/upload',
  siteUpload.fields([
    { name: 'favicon', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'logo_footer', maxCount: 1 },
    { name: 'banner_image', maxCount: 1 },
    { name: 'enquiry_image', maxCount: 1 },
    { name: 'gallery_image_1', maxCount: 1 },
    { name: 'gallery_image_2', maxCount: 1 },
    { name: 'gallery_image_3', maxCount: 1 },
    { name: 'gallery_pay_image', maxCount: 1 },
    { name: 'watermark_image', maxCount: 1 },
    { name: 'default_male_photo', maxCount: 1 },
    { name: 'default_female_photo', maxCount: 1 },
    { name: 'default_horoscope', maxCount: 1 },
    { name: 'default_document', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const $set = { ...(req.body || {}) }
      delete $set._id
      for (const key of [
        'favicon',
        'logo',
        'logo_footer',
        'banner_image',
        'enquiry_image',
        'gallery_image_1',
        'gallery_image_2',
        'gallery_image_3',
        'gallery_pay_image',
        'watermark_image',
        'default_male_photo',
        'default_female_photo',
        'default_horoscope',
        'default_document',
      ]) {
        const file = req.files?.[key]?.[0]
        if (file) $set[key] = file.filename
      }
      // Also allow gates / toggles in same form
      const config = await SiteConfig.findOneAndUpdate({}, { $set }, { upsert: true, new: true }).lean()
      res.json({ success: true, config, message: 'Uploaded & saved' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ success: false, message: 'Upload failed' })
    }
  },
)

router.get('/fields', async (_req, res) => {
  let fields = await FieldSettings.findOne().lean()
  if (!fields) {
    fields = await FieldSettings.create({ ...DEFAULT_FIELD_SETTINGS }).then((d) => d.toObject())
  } else {
    const merged = { ...DEFAULT_FIELD_SETTINGS, ...stripMeta(fields) }
    const known = Object.keys(DEFAULT_FIELD_SETTINGS).filter((k) => k !== 'id')
    const missing = known.some((k) => fields[k] == null || fields[k] === '')
    if (missing) {
      fields = await FieldSettings.findOneAndUpdate({}, { $set: merged }, { new: true }).lean()
    } else {
      fields = { ...DEFAULT_FIELD_SETTINGS, ...stripMeta(fields) }
    }
  }
  res.json({ success: true, fields: stripMeta(fields) })
})

router.put('/fields', async (req, res) => {
  const body = { ...DEFAULT_FIELD_SETTINGS, ...(req.body || {}) }
  delete body._id
  delete body.__v
  const fields = await FieldSettings.findOneAndUpdate({}, { $set: body }, { upsert: true, new: true }).lean()
  res.json({ success: true, fields: stripMeta(fields), message: 'Field settings saved' })
})

router.get('/payment-method', async (_req, res) => {
  const { ensurePaymentMethods } = await import('./payments.js')
  await ensurePaymentMethods()
  const methods = await PaymentMethod.find().sort({ pay_id: 1 }).lean()
  res.json({ success: true, methods })
})

router.put('/payment-method/:id', async (req, res) => {
  const body = { ...(req.body || {}) }
  delete body._id
  delete body.__v
  const pay_id = Number(req.params.id)
  body.pay_id = pay_id
  // Gateway: only keys + status; Manual: bank + qr filename fields
  if (pay_id === 2) {
    const allowed = {
      pay_id: 2,
      pay_name: body.pay_name || 'Razorpay',
      status: body.status || 'ACTIVE',
      razorpay_key: body.razorpay_key || '',
      razorpay_secret: body.razorpay_secret || '',
    }
    await PaymentMethod.updateOne({ pay_id: 2 }, { $set: allowed }, { upsert: true })
  } else {
    await PaymentMethod.updateOne({ pay_id }, { $set: body }, { upsert: true })
  }
  const method = await PaymentMethod.findOne({ pay_id }).lean()
  res.json({ success: true, method, message: 'Payment method updated' })
})

const qrUpload = createUploader('img/qr')
router.post('/payment-method/:id/qr', qrUpload.single('payment_qr'), async (req, res) => {
  try {
    const pay_id = Number(req.params.id) || 1
    if (!req.file) return res.status(400).json({ success: false, message: 'QR image required' })
    await PaymentMethod.updateOne(
      { pay_id },
      { $set: { payment_qr: req.file.filename, pay_id } },
      { upsert: true },
    )
    const method = await PaymentMethod.findOne({ pay_id }).lean()
    res.json({ success: true, method, message: 'QR uploaded' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'QR upload failed' })
  }
})

router.get('/email-setting', async (_req, res) => {
  let setting = await EmailSetting.findOne().lean()
  if (!setting) {
    setting = await EmailSetting.create({ ...DEFAULT_EMAIL_SETTINGS }).then((d) => d.toObject())
  } else {
    const merged = { ...DEFAULT_EMAIL_SETTINGS, ...stripMeta(setting) }
    const known = Object.keys(DEFAULT_EMAIL_SETTINGS).filter((k) => k !== 'id')
    const missing = known.some((k) => setting[k] == null)
    if (missing) {
      setting = await EmailSetting.findOneAndUpdate({}, { $set: merged }, { upsert: true, new: true }).lean()
    } else {
      setting = merged
    }
  }
  res.json({ success: true, setting: stripMeta(setting) })
})

router.put('/email-setting', async (req, res) => {
  const body = { ...DEFAULT_EMAIL_SETTINGS, ...(req.body || {}) }
  delete body._id
  delete body.__v
  const setting = await EmailSetting.findOneAndUpdate({}, { $set: body }, { upsert: true, new: true }).lean()
  res.json({ success: true, setting: stripMeta(setting), message: 'Email settings saved' })
})

export default router
