import { Router } from 'express'
import {
  CmsPage, Advertisement, SuccessStory, Service, EmailTemplate, FirstForm, Interest, Message, Member,
} from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'
import { createUploader } from '../utils/helpers.js'

const router = Router()
router.use(requireAdmin)

const serviceUpload = createUploader('img')
const storyUpload = createUploader('SuccessStory')

function optionalFile(upload, field) {
  return (req, res, next) => {
    const ct = String(req.headers['content-type'] || '')
    if (ct.includes('multipart/form-data')) {
      return upload.single(field)(req, res, next)
    }
    next()
  }
}

router.get('/pages', async (_req, res) => {
  const pages = await CmsPage.find().sort({ cms_id: -1 }).lean()
  res.json({ success: true, pages })
})

router.get('/pages/:id', async (req, res) => {
  const page = await CmsPage.findOne({ cms_id: Number(req.params.id) }).lean()
  if (!page) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, page })
})

router.post('/pages', async (req, res) => {
  const b = req.body || {}
  const max = await CmsPage.findOne().sort({ cms_id: -1 }).lean()
  await CmsPage.create({
    cms_id: Number(max?.cms_id || 0) + 1,
    page_name: b.page_name || b.cms_title || b.title,
    cms_title: b.cms_title || b.title,
    cms_content: b.cms_content || b.content || '',
    status: b.status || 'APPROVED',
  })
  res.json({ success: true, message: 'Page created' })
})

router.put('/pages/:id', async (req, res) => {
  const b = req.body || {}
  await CmsPage.updateOne(
    { cms_id: Number(req.params.id) },
    {
      $set: {
        page_name: b.page_name || b.cms_title || b.title,
        cms_title: b.cms_title || b.title,
        cms_content: b.cms_content || b.content || '',
        status: b.status || 'APPROVED',
      },
    },
  )
  res.json({ success: true, message: 'Page updated' })
})

router.delete('/pages/:id', async (req, res) => {
  await CmsPage.deleteOne({ cms_id: Number(req.params.id) })
  res.json({ success: true, message: 'Deleted' })
})

router.get('/ads', async (_req, res) => {
  const ads = await Advertisement.find().sort({ adv_id: -1 }).lean()
  res.json({ success: true, ads })
})

router.post('/ads', async (req, res) => {
  const b = req.body || {}
  const max = await Advertisement.findOne().sort({ adv_id: -1 }).lean()
  await Advertisement.create({
    adv_id: Number(max?.adv_id || 0) + 1,
    adv_date: b.adv_date || new Date().toISOString().slice(0, 10),
    adv_name: b.adv_name,
    adv_link: b.adv_link || '',
    adv_level: b.adv_level || '1',
    adv_img: b.adv_img || '',
    contact_name: b.contact_name || '',
    phone: b.phone || '',
    status: b.status || 'APPROVED',
  })
  res.json({ success: true, message: 'Ad created' })
})

router.put('/ads/:id', async (req, res) => {
  const b = req.body || {}
  await Advertisement.updateOne(
    { adv_id: Number(req.params.id) },
    {
      $set: {
        adv_name: b.adv_name,
        adv_link: b.adv_link || '',
        adv_level: b.adv_level || '1',
        adv_img: b.adv_img || '',
        contact_name: b.contact_name || '',
        phone: b.phone || '',
        status: b.status || 'APPROVED',
      },
    },
  )
  res.json({ success: true, message: 'Ad updated' })
})

router.delete('/ads/:id', async (req, res) => {
  await Advertisement.deleteOne({ adv_id: Number(req.params.id) })
  res.json({ success: true, message: 'Deleted' })
})

router.get('/success-stories', async (_req, res) => {
  const stories = await SuccessStory.find().sort({ story_id: -1 }).lean()
  res.json({ success: true, stories })
})

router.post('/success-stories', optionalFile(storyUpload, 'weddingphoto'), async (req, res) => {
  try {
    const b = req.body || {}
    const max = await SuccessStory.findOne().sort({ story_id: -1 }).lean()
    const photo = req.file?.filename || b.weddingphoto || ''
    await SuccessStory.create({
      story_id: Number(max?.story_id || 0) + 1,
      bridename: b.bridename || '',
      brideid: b.brideid || '',
      groomname: b.groomname || '',
      groomid: b.groomid || '',
      marriagedate: b.marriagedate || '',
      engagement_date: b.engagement_date || '',
      address: b.address || '',
      country: b.country || '',
      successmessage: b.successmessage || '',
      weddingphoto: photo,
      weddingphoto_type: photo ? pathExt(photo) : '',
      status: b.status || 'APPROVED',
    })
    res.json({ success: true, message: 'Story created' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message || 'Create failed' })
  }
})

router.put('/success-stories/:id', optionalFile(storyUpload, 'weddingphoto'), async (req, res) => {
  try {
    const b = req.body || {}
    const $set = {
      bridename: b.bridename || '',
      brideid: b.brideid || '',
      groomname: b.groomname || '',
      groomid: b.groomid || '',
      marriagedate: b.marriagedate || '',
      engagement_date: b.engagement_date || '',
      address: b.address || '',
      country: b.country || '',
      successmessage: b.successmessage || '',
      status: b.status || 'APPROVED',
    }
    if (req.file?.filename) {
      $set.weddingphoto = req.file.filename
      $set.weddingphoto_type = pathExt(req.file.filename)
    } else if (b.weddingphoto) {
      $set.weddingphoto = b.weddingphoto
    }
    await SuccessStory.updateOne({ story_id: Number(req.params.id) }, { $set })
    res.json({ success: true, message: 'Story updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message || 'Update failed' })
  }
})

router.delete('/success-stories/:id', async (req, res) => {
  await SuccessStory.deleteOne({ story_id: Number(req.params.id) })
  res.json({ success: true, message: 'Deleted' })
})

router.get('/services', async (_req, res) => {
  const services = await Service.find().sort({ sort_order: 1, service_id: 1 }).lean()
  res.json({ success: true, services })
})

router.post('/services', optionalFile(serviceUpload, 'image'), async (req, res) => {
  try {
    const b = req.body || {}
    const max = await Service.findOne().sort({ service_id: -1 }).lean()
    const nextOrder =
      b.sort_order !== undefined && b.sort_order !== ''
        ? Number(b.sort_order)
        : Number(max?.sort_order || 0) + 1
    await Service.create({
      service_id: Number(max?.service_id || 0) + 1,
      title: b.title || '',
      text: b.text || '',
      image: req.file?.filename || b.image || '',
      sort_order: nextOrder,
      status: b.status || 'APPROVED',
    })
    res.json({ success: true, message: 'Service created' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message || 'Create failed' })
  }
})

router.put('/services/:id', optionalFile(serviceUpload, 'image'), async (req, res) => {
  try {
    const b = req.body || {}
    const $set = {
      title: b.title || '',
      text: b.text || '',
      sort_order: Number(b.sort_order || 0),
      status: b.status || 'APPROVED',
    }
    if (req.file?.filename) $set.image = req.file.filename
    else if (b.image != null) $set.image = b.image
    await Service.updateOne({ service_id: Number(req.params.id) }, { $set })
    res.json({ success: true, message: 'Service updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: err.message || 'Update failed' })
  }
})

router.delete('/services/:id', async (req, res) => {
  await Service.deleteOne({ service_id: Number(req.params.id) })
  res.json({ success: true, message: 'Deleted' })
})

function pathExt(name) {
  const i = String(name).lastIndexOf('.')
  return i >= 0 ? String(name).slice(i + 1).toLowerCase() : ''
}

router.get('/email-templates', async (_req, res) => {
  const templates = await EmailTemplate.find().lean()
  res.json({ success: true, templates })
})

router.post('/email-templates', async (req, res) => {
  try {
    const b = req.body || {}
    await EmailTemplate.create({
      EMAIL_TEMPLATE_NAME: b.name || b.EMAIL_TEMPLATE_NAME || 'Template',
      EMAIL_SUBJECT: b.subject || b.EMAIL_SUBJECT || '',
      EMAIL_CONTENT: b.content || b.EMAIL_CONTENT || '',
      PRE_CONDITION: b.pre_condition || '',
      STATUS: b.status || 'APPROVED',
    })
    res.json({ success: true, message: 'Template created' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to create template' })
  }
})

router.post('/send-email', async (req, res) => {
  try {
    const { subject, message, status } = req.body || {}
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'subject and message required' })
    }
    const filter = status ? { status } : { status: { $nin: ['Suspended'] } }
    const recipients = await Member.find(filter).select('email matri_id username').limit(5000).lean()
    const max = await FirstForm.findOne().sort({ id: -1 }).lean()
    await FirstForm.create({
      id: Number(max?.id || 0) + 1,
      gender: '',
      first_name: 'BULK_EMAIL',
      last_name: '',
      dob: '',
      mobile_no: String(recipients.length),
      email_id: subject,
      address: message,
    })
    res.json({
      success: true,
      message: `Email prepared for ${recipients.length} members (logged for delivery integration)`,
      count: recipients.length,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Send failed' })
  }
})

router.get('/first-form', async (req, res) => {
  const filter = {}
  const source = String(req.query.source || '').trim()
  if (source === 'enquiry') {
    filter.$or = [
      { source: 'enquiry' },
      { source: 'contact' },
      { form_type: 'enquiry' },
      { form_type: 'contact' },
      // Legacy rows without source: real enquiries (exclude bulk email log)
      {
        source: { $exists: false },
        form_type: { $exists: false },
        first_name: { $ne: 'BULK_EMAIL' },
        address: { $exists: true, $ne: '' },
      },
    ]
  } else if (source) {
    filter.$or = [{ source }, { form_type: source }]
  }
  const leads = await FirstForm.find(filter).sort({ id: -1 }).limit(500).lean()
  res.json({ success: true, leads })
})

router.delete('/first-form/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const result = await FirstForm.deleteOne({ id })
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' })
    }
    res.json({ success: true, message: 'Deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Delete failed' })
  }
})

router.get('/interests', async (_req, res) => {
  const items = await Interest.find().sort({ ei_id: -1 }).limit(200).lean()
  res.json({ success: true, items })
})

router.get('/messages', async (_req, res) => {
  const items = await Message.find().sort({ mes_id: -1 }).limit(200).lean()
  res.json({ success: true, items })
})

export default router
