import { Router } from 'express'
import { Master } from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAdmin)

const TYPES = new Set([
  'religion', 'caste', 'sub-caste', 'country', 'state', 'city',
  'occupation', 'education', 'mother-tongue',
  'height', 'weight', 'diet', 'complexion', 'body-type',
])

function mapItem(type, i) {
  const typedIdKey = `${type.replace(/-/g, '_')}_id`
  const mapped = {
    ...i,
    [typedIdKey]: i.legacy_id,
    caste_id: i.meta?.caste_id,
    country_id: i.meta?.country_id || i.meta?.country_code,
    country_code: i.meta?.country_code,
    state_id: i.meta?.state_id || i.meta?.state_code,
    state_code: i.meta?.state_code,
    religion_name: type === 'religion' ? i.name : undefined,
    caste_name: type === 'caste' ? i.name : undefined,
    country_name: type === 'country' ? i.name : undefined,
    state_name: type === 'state' ? i.name : undefined,
    city_name: type === 'city' ? i.name : undefined,
    ocp_name: type === 'occupation' ? i.name : undefined,
    edu_name: type === 'education' ? i.name : undefined,
    mtongue_name: type === 'mother-tongue' ? i.name : undefined,
    height_name: type === 'height' ? i.name : undefined,
    weight_name: type === 'weight' ? i.name : undefined,
    diet_name: type === 'diet' ? i.name : undefined,
    complexion_name: type === 'complexion' ? i.name : undefined,
    body_type_name: type === 'body-type' ? i.name : undefined,
  }
  // Never let meta.religion_id overwrite the religion's own ID (was causing wrong IDs)
  if (type === 'religion') {
    mapped.religion_id = i.legacy_id
  } else {
    mapped.religion_id = i.meta?.religion_id
  }
  return mapped
}

const COUNTRY_LIKE = /^(india|usa|united states|uk|england|canada|australia|pakistan|bangladesh|sri lanka|nepal|china|japan)$/i

function isValidReligionName(name) {
  const n = String(name || '').trim()
  if (!n) return false
  if (COUNTRY_LIKE.test(n)) return false
  if (/^[A-Z]{2,3}$/.test(n)) return false // country codes
  return true
}

router.get('/:type', async (req, res) => {
  if (!TYPES.has(req.params.type)) {
    return res.status(404).json({ success: false, message: 'Unknown master type' })
  }
  try {
    const filter = { type: req.params.type }
    const { religion_id, country_id, state_id, caste_id, q } = req.query

    if (religion_id) {
      const rid = String(religion_id).trim()
      filter.$or = [
        { 'meta.religion_id': rid },
        { 'meta.religion_id': Number(rid) },
        { 'meta.religion_id': new RegExp(`^\\s*${rid}\\s*$`) },
      ]
    }
    if (caste_id) {
      const cid = String(caste_id).trim()
      filter.$or = [
        { 'meta.caste_id': cid },
        { 'meta.caste_id': Number(cid) },
        { 'meta.caste_id': new RegExp(`^\\s*${cid}\\s*$`) },
      ]
    }
    if (country_id) {
      const cid = String(country_id).trim()
      filter.$or = [
        { 'meta.country_code': cid },
        { 'meta.country_code': new RegExp(`^\\s*${cid}\\s*$`) },
        { 'meta.country_id': cid },
        { 'meta.country_id': Number(cid) },
        { legacy_id: Number(cid) || -1 },
      ]
    }
    if (state_id) {
      const sid = String(state_id).trim()
      filter.$or = [
        { 'meta.state_code': sid },
        { 'meta.state_code': new RegExp(`^\\s*${sid}\\s*$`) },
        { 'meta.state_id': sid },
        { 'meta.state_id': Number(sid) },
        { legacy_id: Number(sid) || -1 },
      ]
    }
    if (q) {
      filter.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }

    const items = await Master.find(filter).sort({ legacy_id: 1 }).limit(2000).lean()
    const cleaned =
      req.params.type === 'religion'
        ? items.filter((i) => isValidReligionName(i.name))
        : items
    // Remove mis-filed country rows that were saved as religion
    if (req.params.type === 'religion') {
      const junk = items.filter((i) => !isValidReligionName(i.name))
      if (junk.length) {
        await Master.deleteMany({ _id: { $in: junk.map((j) => j._id) }, type: 'religion' })
      }
    }
    res.json({
      success: true,
      items: cleaned.map((i) => mapItem(req.params.type, i)),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load master data' })
  }
})

router.post('/:type', async (req, res) => {
  if (!TYPES.has(req.params.type)) {
    return res.status(404).json({ success: false, message: 'Unknown master type' })
  }
  try {
    const name =
      req.body?.name ||
      req.body?.religion_name ||
      req.body?.caste_name ||
      req.body?.ocp_name ||
      req.body?.edu_name ||
      req.body?.mtongue_name ||
      req.body?.country_name ||
      req.body?.state_name ||
      req.body?.city_name ||
      req.body?.sub_caste_name
    if (!name) return res.status(400).json({ success: false, message: 'Name required' })
    if (req.params.type === 'religion' && !isValidReligionName(name)) {
      return res.status(400).json({
        success: false,
        message: 'That looks like a country name. Add it under Country, not Religion.',
      })
    }
    const max = await Master.findOne({ type: req.params.type }).sort({ legacy_id: -1 }).lean()
    const legacy_id = Number(max?.legacy_id || 0) + 1
    const meta = {
      religion_id: req.body.religion_id != null && req.body.religion_id !== '' ? req.body.religion_id : undefined,
      caste_id: req.body.caste_id != null && req.body.caste_id !== '' ? req.body.caste_id : undefined,
      country_code: req.body.country_code || req.body.country_id || undefined,
      country_id: req.body.country_id || req.body.country_code || undefined,
      state_id: req.body.state_id || req.body.state_code || undefined,
      state_code: req.body.state_code || req.body.state_id || undefined,
    }
    Object.keys(meta).forEach((k) => meta[k] === undefined && delete meta[k])
    await Master.create({
      type: req.params.type,
      legacy_id,
      name: String(name).trim(),
      status: req.body.status || 'APPROVED',
      meta,
    })
    res.json({ success: true, message: 'Created', id: legacy_id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Create failed' })
  }
})

async function updateMaster(req, res) {
  try {
    const name =
      req.body?.name ||
      req.body?.religion_name ||
      req.body?.caste_name ||
      req.body?.ocp_name ||
      req.body?.edu_name ||
      req.body?.mtongue_name ||
      req.body?.country_name ||
      req.body?.state_name ||
      req.body?.city_name
    const $set = {}
    if (name) $set.name = String(name).trim()
    if (req.body?.status) $set.status = req.body.status
    const meta = {}
    if (req.body.religion_id != null && req.body.religion_id !== '') meta.religion_id = req.body.religion_id
    if (req.body.caste_id != null && req.body.caste_id !== '') meta.caste_id = req.body.caste_id
    if (req.body.country_code || req.body.country_id) {
      meta.country_code = req.body.country_code || req.body.country_id
      meta.country_id = req.body.country_id || req.body.country_code
    }
    if (req.body.state_id || req.body.state_code) {
      meta.state_id = req.body.state_id || req.body.state_code
      meta.state_code = req.body.state_code || req.body.state_id
    }
    if (Object.keys(meta).length) {
      for (const [k, v] of Object.entries(meta)) $set[`meta.${k}`] = v
    }
    await Master.updateOne(
      { type: req.params.type, legacy_id: Number(req.params.id) },
      { $set },
    )
    res.json({ success: true, message: 'Updated' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Update failed' })
  }
}

router.patch('/:type/:id', updateMaster)
router.put('/:type/:id', updateMaster)

router.delete('/:type/:id', async (req, res) => {
  try {
    await Master.deleteOne({ type: req.params.type, legacy_id: Number(req.params.id) })
    res.json({ success: true, message: 'Deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Delete failed' })
  }
})

export default router
