import { Router } from 'express'
import {
  SiteConfig, Plan, SuccessStory, Service, CmsPage, Master, Member, FirstForm,
} from '../models/index.js'

const router = Router()

router.get('/site-config', async (_req, res) => {
  const config = await SiteConfig.findOne().lean()
  res.json({ success: true, config })
})

router.get('/plans', async (_req, res) => {
  const plans = await Plan.find({
    $or: [
      { status: 'APPROVED' },
      { status: /^\s*APPROVED\s*$/i },
      { status: { $exists: false } },
    ],
  })
    .sort({ plan_amount: 1 })
    .lean()
  res.json({
    success: true,
    plans: plans.map((p) => ({
      ...p,
      plan_name: String(p.plan_name || '').trim(),
      status: String(p.status || 'APPROVED').trim(),
    })),
  })
})

router.get('/success-stories', async (_req, res) => {
  const stories = await SuccessStory.find({ status: 'APPROVED' }).sort({ story_id: -1 }).limit(50).lean()
  res.json({ success: true, stories })
})

router.get('/services', async (_req, res) => {
  const services = await Service.find({
    $or: [{ status: 'APPROVED' }, { status: /^\s*APPROVED\s*$/i }, { status: { $exists: false } }],
  })
    .sort({ sort_order: 1, service_id: 1 })
    .lean()
  res.json({ success: true, services })
})

router.get('/cms/:pageName', async (req, res) => {
  const page = await CmsPage.findOne({
    $or: [{ page_name: req.params.pageName }, { cms_title: req.params.pageName }],
    status: 'APPROVED',
  }).lean()
  if (!page) return res.status(404).json({ success: false, message: 'Page not found' })
  res.json({ success: true, page })
})

function approvedMaster(type) {
  return {
    type,
    $or: [
      { status: 'APPROVED' },
      { status: /approved/i },
      { status: { $exists: false } },
      { status: null },
      { status: '' },
    ],
  }
}

router.get('/master/religions', async (_req, res) => {
  const items = await Master.find(approvedMaster('religion')).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/castes', async (req, res) => {
  const filter = approvedMaster('caste')
  if (req.query.religion_id) {
    const rid = String(req.query.religion_id).trim()
    filter.$and = [
      {
        $or: [
          { 'meta.religion_id': rid },
          { 'meta.religion_id': Number(rid) || -1 },
        ],
      },
    ]
  }
  const items = await Master.find(filter).lean()
  res.json({
    success: true,
    items: items.map((i) => ({ id: i.legacy_id, name: i.name, religion_id: i.meta?.religion_id })),
  })
})

router.get('/master/mother-tongues', async (_req, res) => {
  const items = await Master.find(approvedMaster('mother-tongue')).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/occupations', async (_req, res) => {
  const items = await Master.find(approvedMaster('occupation')).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/education', async (_req, res) => {
  const items = await Master.find(approvedMaster('education')).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/heights', async (_req, res) => {
  const items = await Master.find(approvedMaster('height')).sort({ legacy_id: 1 }).lean()
  res.json({
    success: true,
    items: items.map((i) => ({ id: i.legacy_id, name: i.name, value: i.meta?.value || i.name })),
  })
})

router.get('/master/weights', async (_req, res) => {
  const items = await Master.find(approvedMaster('weight')).sort({ legacy_id: 1 }).lean()
  res.json({
    success: true,
    items: items.map((i) => ({ id: i.legacy_id, name: i.name, value: i.meta?.value || i.name })),
  })
})

router.get('/master/diets', async (_req, res) => {
  const items = await Master.find(approvedMaster('diet')).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/complexions', async (_req, res) => {
  const items = await Master.find(approvedMaster('complexion')).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/body-types', async (_req, res) => {
  const items = await Master.find(approvedMaster('body-type')).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/countries', async (_req, res) => {
  const items = await Master.find({ type: 'country', status: 'APPROVED' }).limit(300).lean()
  res.json({ success: true, items: items.map((i) => ({ id: i.legacy_id, name: i.name })) })
})

router.get('/master/states', async (req, res) => {
  const filter = { type: 'state', status: 'APPROVED' }
  if (req.query.country_code) filter['meta.country_code'] = req.query.country_code
  const items = await Master.find(filter).limit(500).lean()
  res.json({
    success: true,
    items: items.map((i) => ({ id: i.legacy_id, name: i.name, country_code: i.meta?.country_code })),
  })
})

/** Generic master list for any approved type (keep after specific /master/* routes) */
router.get('/master/:type', async (req, res) => {
  const type = String(req.params.type || '').replace(/_/g, '-')
  const allowed = new Set([
    'religion', 'caste', 'sub-caste', 'country', 'state', 'city',
    'occupation', 'education', 'mother-tongue',
    'height', 'weight', 'diet', 'complexion', 'body-type',
  ])
  if (!allowed.has(type)) return res.status(404).json({ success: false, message: 'Unknown type' })
  const filter = { type, status: 'APPROVED' }
  if (type === 'caste' && req.query.religion_id) {
    filter.$or = [
      { 'meta.religion_id': Number(req.query.religion_id) },
      { 'meta.religion_id': String(req.query.religion_id) },
    ]
  }
  const items = await Master.find(filter).sort({ legacy_id: 1 }).limit(2000).lean()
  res.json({
    success: true,
    items: items.map((i) => ({
      id: i.legacy_id,
      name: i.name,
      value: i.meta?.value || i.name,
      meta: i.meta,
    })),
  })
})

router.get('/stats', async (_req, res) => {
  const [all, male, female, paid] = await Promise.all([
    Member.countDocuments({ status: { $nin: ['Inactive', 'Suspended'] } }),
    Member.countDocuments({ gender: 'Male', status: { $nin: ['Inactive', 'Suspended'] } }),
    Member.countDocuments({ gender: 'Female', status: { $nin: ['Inactive', 'Suspended'] } }),
    Member.countDocuments({ status: 'Paid' }),
  ])
  res.json({
    success: true,
    stats: { members: all, grooms: male, brides: female, paid },
  })
})

router.post('/enquiry', async (req, res) => {
  try {
    const b = req.body || {}
    const max = await FirstForm.findOne().sort({ id: -1 }).lean()
    await FirstForm.create({
      id: Number(max?.id || 0) + 1,
      source: 'enquiry',
      form_type: 'enquiry',
      gender: b.gender || '',
      first_name: b.first_name || b.name || '',
      last_name: b.last_name || '',
      dob: b.dob || '',
      mobile_no: b.mobile || b.phone || '',
      email_id: b.email || '',
      address: b.message || b.address || '',
    })
    res.json({ success: true, message: 'Enquiry submitted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to submit enquiry' })
  }
})

router.post('/contact', async (req, res) => {
  try {
    const b = req.body || {}
    const max = await FirstForm.findOne().sort({ id: -1 }).lean()
    await FirstForm.create({
      id: Number(max?.id || 0) + 1,
      source: 'contact',
      form_type: 'contact',
      gender: '',
      first_name: b.name || '',
      last_name: '',
      dob: '',
      mobile_no: b.phone || '',
      email_id: b.email || '',
      address: b.message || '',
    })
    res.json({ success: true, message: 'Message sent' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed' })
  }
})

export default router
