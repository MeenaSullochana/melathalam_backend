import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { md5 } from '../src/utils/md5.js'
import {
  Member,
  Plan,
  Payment,
  Interest,
  WhoViewed,
  ContactView,
  RenewalRequest,
} from '../src/models/index.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const PHOTOS_DIR = path.join(ROOT, 'my_photos')
const HORO_DIR = path.join(ROOT, 'horoscope-list')
const DOCS_DIR = path.join(ROOT, 'documents')
const SERVICE_DIR = path.join(ROOT, 'img', 'service')

const PASS = md5('demo123')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function pickSource(dir, names) {
  if (!fs.existsSync(dir)) return null
  for (const n of names) {
    const p = path.join(dir, n)
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|pdf)$/i.test(f))
    .sort()
  return files.length ? path.join(dir, files[0]) : null
}

/** Copy a source file into destDir as destName; return destName or ''. */
function copyAs(destDir, destName, sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return ''
  ensureDir(destDir)
  const dest = path.join(destDir, destName)
  fs.copyFileSync(sourcePath, dest)
  return destName
}

function prepareDemoMedia() {
  ensureDir(PHOTOS_DIR)
  ensureDir(HORO_DIR)
  ensureDir(DOCS_DIR)

  const servicePhotos = fs.existsSync(SERVICE_DIR)
    ? fs.readdirSync(SERVICE_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
    : []
  const horoFiles = fs.existsSync(HORO_DIR)
    ? fs.readdirSync(HORO_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
    : []
  const docFiles = fs.existsSync(DOCS_DIR)
    ? fs.readdirSync(DOCS_DIR).filter((f) => /\.(jpe?g|png|webp|pdf)$/i.test(f)).sort()
    : []

  const ids = ['DEMO_M1', 'DEMO_M2', 'DEMO_F1', 'DEMO_F2']
  const media = {}

  ids.forEach((id, i) => {
    const photoSrc = servicePhotos[i]
      ? path.join(SERVICE_DIR, servicePhotos[i])
      : pickSource(SERVICE_DIR, ['1.jpg', '2.jpg', '3.jpg', '5.jpeg'])
    const photo2Src = servicePhotos[i + 4]
      ? path.join(SERVICE_DIR, servicePhotos[i + 4])
      : photoSrc
    const photo3Src = servicePhotos[i + 8]
      ? path.join(SERVICE_DIR, servicePhotos[i + 8])
      : photoSrc
    const horoSrc = horoFiles[i]
      ? path.join(HORO_DIR, horoFiles[i])
      : pickSource(HORO_DIR, ['1598444667.jpg', '1599838047.jpg'])
    const docSrc = docFiles[i]
      ? path.join(DOCS_DIR, docFiles[i])
      : pickSource(DOCS_DIR, [])

    const photo1 = copyAs(PHOTOS_DIR, `${id.toLowerCase()}-photo1.jpg`, photoSrc)
    const photo2 = copyAs(PHOTOS_DIR, `${id.toLowerCase()}-photo2.jpg`, photo2Src)
    const photo3 = copyAs(PHOTOS_DIR, `${id.toLowerCase()}-photo3.jpg`, photo3Src)
    const hor_photo = copyAs(HORO_DIR, `${id.toLowerCase()}-horoscope.jpg`, horoSrc)
    const aadhaar_card = docSrc
      ? copyAs(DOCS_DIR, `${id.toLowerCase()}-aadhaar${path.extname(docSrc) || '.jpg'}`, docSrc)
      : ''

    media[id] = {
      photo1,
      photo2,
      photo3,
      photo1_approve: 'APPROVED',
      photo2_approve: 'APPROVED',
      photo3_approve: 'APPROVED',
      photo_view_status: '1',
      hor_photo,
      hor_check: 'APPROVED',
      aadhaar_card,
      aadhaar_card_status: aadhaar_card ? 'APPROVED' : 'PENDING',
      profile_text_approve: 'APPROVED',
      part_expect_approve: 'APPROVED',
    }
  })

  return media
}

const demos = [
  {
    matri_id: 'DEMO_M1',
    gender: 'Male',
    firstname: 'Arjun',
    lastname: 'Menon',
    email: 'arjun.demo@matrimony.local',
    mobile: '9876543201',
    status: 'Paid',
    stage: 'paid_active',
    birthdate: '1992-05-12',
    age: 33,
    height: '5ft 9in',
    weight: '72 Kg',
    m_status: 'Never Married',
    religion: 'Hindu',
    caste: 'Nair',
    m_tongue: 'Malayalam',
    edu_detail: 'B Tech',
    occupation: 'Software Engineer',
    emp_in: 'Private',
    income: '12 LPA',
    city: 'Kochi',
    diet: 'Non-Vegetarian',
    complexion: 'Wheatish',
    bodytype: 'Athletic',
    gothra: 'Bharadwaja',
    subcaste: 'Menon',
    profile_text: 'Family-oriented software professional looking for a life partner.',
    part_frm_age: 25,
    part_to_age: 32,
    part_religion: 'Hindu',
    part_mtongue: 'Malayalam',
    looking_for: 'Never Married',
  },
  {
    matri_id: 'DEMO_M2',
    gender: 'Male',
    firstname: 'Karthik',
    lastname: 'Rajan',
    email: 'karthik.demo@matrimony.local',
    mobile: '9876543202',
    status: 'Active',
    stage: 'active_free',
    birthdate: '1990-11-03',
    age: 35,
    height: '5ft 7in',
    weight: '68 Kg',
    m_status: 'Never Married',
    religion: 'Hindu',
    caste: 'Iyer',
    m_tongue: 'Tamil',
    edu_detail: 'MBA',
    occupation: 'Business',
    emp_in: 'Business',
    income: '8 LPA',
    city: 'Chennai',
    diet: 'Vegetarian',
    complexion: 'Fair',
    bodytype: 'Average',
    gothra: 'Kashyapa',
    subcaste: 'Vadama',
    profile_text: 'Business owner seeking a traditional yet modern partner.',
    part_frm_age: 26,
    part_to_age: 33,
    part_religion: 'Hindu',
    part_mtongue: 'Tamil',
    looking_for: 'Never Married',
  },
  {
    matri_id: 'DEMO_F1',
    gender: 'Female',
    firstname: 'Ananya',
    lastname: 'Nair',
    email: 'ananya.demo@matrimony.local',
    mobile: '9876543203',
    status: 'Paid',
    stage: 'paid_active',
    birthdate: '1996-08-21',
    age: 29,
    height: '5ft 4in',
    weight: '55 Kg',
    m_status: 'Never Married',
    religion: 'Hindu',
    caste: 'Nair',
    m_tongue: 'Malayalam',
    edu_detail: 'MSc',
    occupation: 'Teacher',
    emp_in: 'Government',
    income: '6 LPA',
    city: 'Trivandrum',
    diet: 'Vegetarian',
    complexion: 'Fair',
    bodytype: 'Slim',
    gothra: 'Vishwamitra',
    subcaste: 'Nair',
    profile_text: 'Soft-spoken teacher who loves classical music and travel.',
    part_frm_age: 28,
    part_to_age: 36,
    part_religion: 'Hindu',
    part_mtongue: 'Malayalam',
    looking_for: 'Never Married',
  },
  {
    matri_id: 'DEMO_F2',
    gender: 'Female',
    firstname: 'Priya',
    lastname: 'Sharma',
    email: 'priya.demo@matrimony.local',
    mobile: '9876543204',
    status: 'Active',
    stage: 'pending_renewal',
    birthdate: '1995-02-14',
    age: 31,
    height: '5ft 3in',
    weight: '58 Kg',
    m_status: 'Never Married',
    religion: 'Hindu',
    caste: 'Brahmin',
    m_tongue: 'Hindi',
    edu_detail: 'MTech',
    occupation: 'Software Engineer',
    emp_in: 'Private',
    income: '15 LPA',
    city: 'Bengaluru',
    diet: 'Eggetarian',
    complexion: 'Wheatish',
    bodytype: 'Average',
    gothra: 'Atri',
    subcaste: 'Sharma',
    profile_text: 'Tech professional looking for a kind, family-oriented partner.',
    part_frm_age: 30,
    part_to_age: 38,
    part_religion: 'Hindu',
    part_mtongue: 'Hindi',
    looking_for: 'Never Married',
  },
]

async function upsertMember(d, index, plan, media = {}) {
  const { stage, ...profile } = d
  const base = {
    ...profile,
    ...media,
    index_id: 9000 + index,
    username: `${d.firstname} ${d.lastname}`,
    mobile_code: '+91',
    password: PASS,
    profileby: 'Self',
    physicalStatus: 'Normal',
    manglik: d.manglik || 'No',
    star: 'Rohini',
    moonsign: 'Vrishabha',
    birthplace: d.city,
    birthtime: '06:30 AM',
    birth_time_type: 'AM',
    padham: '2',
    lagnam: 'Mesha',
    family_type: 'Nuclear',
    family_status: 'Upper Middle Class',
    family_value: 'Moderate',
    family_origin: d.city,
    father_name: `${d.lastname} Father`,
    mother_name: `${d.lastname} Mother`,
    father_occupation: 'Retired',
    mother_occupation: 'Homemaker',
    no_of_brothers: '1',
    no_of_sisters: '1',
    no_marri_brother: '1',
    no_marri_sister: '0',
    address: `${d.city}, India`,
    country_id: 'India',
    state_id: d.city === 'Kochi' || d.city === 'Trivandrum' ? 'Kerala' : d.city === 'Chennai' ? 'Tamil Nadu' : 'Karnataka',
    land_property: 'Own house',
    smoke: 'No',
    drink: 'No',
    hobby: 'Music, Travel, Reading',
    language_known: 'English, Hindi, ' + (d.m_tongue || ''),
    part_height: '5ft 0in',
    part_height_to: '6ft 0in',
    part_edu: d.part_edu || 'Any',
    part_occu: d.part_occu || 'Any',
    part_diet: d.diet,
    part_caste: d.caste,
    part_complexation: d.complexion,
    part_country_living: 'India',
    part_expect: 'Looking for a compatible, respectful partner with strong family values.',
    fstatus: index === 0 ? 'Featured' : '',
    reg_date: new Date(),
  }

  if (d.stage === 'paid_active' && plan) {
    const exp = new Date()
    exp.setDate(exp.getDate() + 180)
    Object.assign(base, {
      plan_id: plan.plan_id,
      plan_name: String(plan.plan_name || '').trim(),
      plan_status: 'Active',
      plan_expired_on: exp.toISOString().slice(0, 10),
      p_profile: Number(plan.profile || 50),
      profile: Number(plan.profile || 50),
      r_profile: 2,
      p_no_contacts: Number(plan.plan_contacts || 20),
      r_cnt: 1,
      viewed_profiles: [],
    })
  }

  if (d.stage === 'pending_renewal' && plan) {
    const exp = new Date()
    exp.setDate(exp.getDate() - 10)
    Object.assign(base, {
      status: 'Paid',
      plan_id: plan.plan_id,
      plan_name: String(plan.plan_name || '').trim(),
      plan_status: 'Expired',
      plan_expired_on: exp.toISOString().slice(0, 10),
      p_profile: Number(plan.profile || 50),
      r_profile: Number(plan.profile || 50),
      p_no_contacts: Number(plan.plan_contacts || 20),
      r_cnt: Number(plan.plan_contacts || 20),
    })
  }

  await Member.findOneAndUpdate({ matri_id: d.matri_id }, { $set: base }, { upsert: true, new: true })
  return base
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)

  // Fix spaced plan status/names so website can show packages
  const plans = await Plan.find().lean()
  for (const p of plans) {
    await Plan.updateOne(
      { _id: p._id },
      {
        $set: {
          plan_name: String(p.plan_name || '').trim(),
          status: String(p.status || 'APPROVED').trim() || 'APPROVED',
        },
      },
    )
  }
  console.log('Cleaned', plans.length, 'plans')

  const premium = await Plan.findOne({ plan_id: 29 }).lean()
  const normal = await Plan.findOne({ plan_id: 28 }).lean()

  // Clear old demo ids if present
  const ids = demos.map((d) => d.matri_id)
  await Member.deleteMany({ matri_id: { $in: [...ids, 'DEMO_MALE', 'DEMO_FEMALE'] } })
  await Payment.deleteMany({ matri_id: { $in: ids } })
  await Interest.deleteMany({
    $or: [{ ei_sender: { $in: ids } }, { ei_receiver: { $in: ids } }],
  })
  await WhoViewed.deleteMany({
    $or: [{ my_id: { $in: ids } }, { viewed_member_id: { $in: ids } }],
  })
  await ContactView.deleteMany({
    $or: [{ viewer_id: { $in: ids } }, { viewed_id: { $in: ids } }],
  })
  await RenewalRequest.deleteMany({ matri_id: { $in: ids } })

  const mediaMap = prepareDemoMedia()
  console.log('Prepared demo photos / horoscopes / documents in my_photos, horoscope-list, documents')

  for (let i = 0; i < demos.length; i++) {
    const plan = demos[i].stage === 'active_free' ? null : i % 2 === 0 ? premium : normal
    await upsertMember(demos[i], i, plan, mediaMap[demos[i].matri_id] || {})
    console.log('Upserted', demos[i].matri_id, demos[i].stage, mediaMap[demos[i].matri_id]?.photo1 || '(no photo)')
  }

  // Payments for paid members
  let payid = Number((await Payment.findOne().sort({ payid: -1 }).lean())?.payid || 1000)
  for (const mid of ['DEMO_M1', 'DEMO_F1', 'DEMO_F2']) {
    payid += 1
    const m = await Member.findOne({ matri_id: mid }).lean()
    await Payment.create({
      payid,
      matri_id: mid,
      plan_id: m.plan_id,
      plan_name: m.plan_name,
      plan_amount: mid === 'DEMO_F2' ? 4000 : 5000,
      status: mid === 'DEMO_F2' ? 'Paid' : 'Paid',
      mode: 'manual',
      pay_date: new Date(),
      created_at: new Date(),
      profile: m.p_profile,
      r_profile: m.r_profile,
      p_no_contacts: m.p_no_contacts,
      r_cnt: m.r_cnt,
      exp_date: m.plan_expired_on,
    })
  }

  // Pending payment awaiting approval (DEMO_M2 checkout stage)
  payid += 1
  await Payment.create({
    payid,
    matri_id: 'DEMO_M2',
    plan_id: normal?.plan_id || 28,
    plan_name: String(normal?.plan_name || 'NORMAL').trim(),
    plan_amount: 4000,
    status: 'Awaiting Approval',
    mode: 'manual',
    txn_ref: 'DEMO-TXN-001',
    note: 'Demo pending payment for admin approval',
    pay_date: new Date(),
    created_at: new Date(),
  })

  // Renewal request for DEMO_F2
  const maxRr = await RenewalRequest.findOne().sort({ rr_id: -1 }).lean()
  await RenewalRequest.create({
    rr_id: Number(maxRr?.rr_id || 0) + 1,
    matri_id: 'DEMO_F2',
    plan_id: normal?.plan_id || 28,
    plan_name: String(normal?.plan_name || 'NORMAL').trim(),
    note: 'Demo renewal request — expired plan',
    status: 'Pending',
    created_at: new Date(),
  })

  // Interests: M1 → F1 (pending), F1 → M1 (accept = mutual), M1 → F2 (pending), F2 → M2 (reject)
  let ei = Number((await Interest.findOne().sort({ ei_id: -1 }).lean())?.ei_id || 0)
  const interests = [
    { from: 'DEMO_M1', to: 'DEMO_F1', response: 'Accept', message: 'Would like to know more about you.' },
    { from: 'DEMO_F1', to: 'DEMO_M1', response: 'Accept', message: 'Happy to connect.' },
    { from: 'DEMO_M1', to: 'DEMO_F2', response: 'Pending', message: 'Interested in your profile.' },
    { from: 'DEMO_F2', to: 'DEMO_M2', response: 'Reject', message: 'Not a match for me.' },
    { from: 'DEMO_M2', to: 'DEMO_F1', response: 'Pending', message: 'Hi, interested.' },
  ]
  for (const it of interests) {
    ei += 1
    await Interest.create({
      ei_id: ei,
      ei_sender: it.from,
      ei_receiver: it.to,
      receiver_response: it.response,
      ei_message: it.message,
      ei_sent_date: new Date(),
      status: 'APPROVED',
      trash_sender: 'No',
      trash_receiver: 'No',
    })
  }

  // Profile views + contact unlocks
  let who = Number((await WhoViewed.findOne().sort({ who_id: -1 }).lean())?.who_id || 0)
  const views = [
    ['DEMO_M1', 'DEMO_F1'],
    ['DEMO_M1', 'DEMO_F2'],
    ['DEMO_F1', 'DEMO_M1'],
    ['DEMO_F1', 'DEMO_M2'],
    ['DEMO_M2', 'DEMO_F1'],
  ]
  for (const [a, b] of views) {
    who += 1
    await WhoViewed.create({ who_id: who, my_id: a, viewed_member_id: b, viewed_date: new Date() })
  }

  let cv = Number((await ContactView.findOne().sort({ cv_id: -1 }).lean())?.cv_id || 0)
  for (const [a, b] of [
    ['DEMO_M1', 'DEMO_F1'],
    ['DEMO_F1', 'DEMO_M1'],
  ]) {
    cv += 1
    await ContactView.create({ cv_id: cv, viewer_id: a, viewed_id: b, viewed_date: new Date() })
  }

  console.log('\nDemo logins (password: demo123)')
  console.log('  DEMO_M1 / arjun.demo@matrimony.local  — Paid male, mutual interest with F1, credits used')
  console.log('  DEMO_M2 / karthik.demo@matrimony.local — Free male, payment awaiting approval')
  console.log('  DEMO_F1 / ananya.demo@matrimony.local — Paid female, mutual with M1')
  console.log('  DEMO_F2 / priya.demo@matrimony.local  — Expired paid, renewal pending')
  console.log('\nWebsite packages should show after plan status trim fix.')

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
