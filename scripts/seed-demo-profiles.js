import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Member, PaymentMethod, Plan } from '../src/models/index.js'
import { md5 } from '../src/utils/md5.js'
import { ensurePaymentMethods } from '../src/routes/payments.js'

dotenv.config()

const DEMO_MALE = {
  matri_id: 'DEMO_MALE',
  firstname: 'Arjun',
  lastname: 'Kumar',
  username: 'Arjun Kumar',
  email: 'demo.male@matrimony.local',
  mobile: '9876500001',
  mobile_code: '+91',
  gender: 'Male',
  password: md5('12345678'),
  status: 'Paid',
  fstatus: 'Featured',
  birthdate: '1994-05-12',
  age: 31,
  m_status: 'Never Married',
  m_tongue: 'Tamil',
  religion: 'Hindu',
  caste: 'Other',
  subcaste: '',
  edu_detail: 'B.E / B.Tech',
  occupation: 'Software Engineer',
  emp_in: 'Private',
  income: '10-15 Lakh',
  height: '5ft 9in',
  weight: '72',
  diet: 'Vegetarian',
  smoke: 'No',
  drink: 'No',
  manglik: 'No',
  city: 'Chennai',
  state_id: 'Tamil Nadu',
  country_id: 'India',
  address: 'Anna Nagar, Chennai',
  family_type: 'Nuclear',
  family_status: 'Middle Class',
  father_name: 'Ravi Kumar',
  mother_name: 'Lakshmi',
  profile_text: 'Well-settled software professional looking for a life partner with similar values.',
  looking_for: 'Never Married',
  part_frm_age: 24,
  part_to_age: 32,
  part_religion: 'Hindu',
  part_caste: '',
  part_mtongue: 'Tamil',
  part_edu: 'Graduate',
  part_occu: '',
  part_expect: 'Educated, family-oriented, and kind-hearted.',
  plan_name: 'Gold',
  plan_status: 'Active',
  photo1: '',
  profileby: 'Self',
}

const DEMO_FEMALE = {
  matri_id: 'DEMO_FEMALE',
  firstname: 'Priya',
  lastname: 'Sharma',
  username: 'Priya Sharma',
  email: 'demo.female@matrimony.local',
  mobile: '9876500002',
  mobile_code: '+91',
  gender: 'Female',
  password: md5('12345678'),
  status: 'Paid',
  fstatus: 'Featured',
  birthdate: '1996-08-20',
  age: 29,
  m_status: 'Never Married',
  m_tongue: 'Tamil',
  religion: 'Hindu',
  caste: 'Other',
  subcaste: '',
  edu_detail: 'MBA',
  occupation: 'HR Manager',
  emp_in: 'Private',
  income: '8-10 Lakh',
  height: '5ft 4in',
  weight: '55',
  diet: 'Vegetarian',
  smoke: 'No',
  drink: 'No',
  manglik: 'No',
  city: 'Chennai',
  state_id: 'Tamil Nadu',
  country_id: 'India',
  address: 'T Nagar, Chennai',
  family_type: 'Nuclear',
  family_status: 'Middle Class',
  father_name: 'Suresh Sharma',
  mother_name: 'Meena',
  profile_text: 'Warm and ambitious professional seeking a compatible partner for a lifelong journey.',
  looking_for: 'Never Married',
  part_frm_age: 28,
  part_to_age: 35,
  part_religion: 'Hindu',
  part_caste: '',
  part_mtongue: 'Tamil',
  part_edu: 'Graduate',
  part_occu: 'Software Engineer',
  part_expect: 'Respectful, career-oriented, and family values.',
  plan_name: 'Gold',
  plan_status: 'Active',
  photo1: '',
  profileby: 'Self',
}

async function upsertMember(data) {
  const max = await Member.findOne().sort({ index_id: -1 }).lean()
  const existing = await Member.findOne({ matri_id: data.matri_id })
  if (existing) {
    await Member.updateOne({ matri_id: data.matri_id }, { $set: { ...data, index_id: existing.index_id } })
    console.log('Updated', data.matri_id)
  } else {
    await Member.create({ ...data, index_id: Number(max?.index_id || 0) + 1, reg_date: new Date() })
    console.log('Created', data.matri_id)
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)

  // Remove truly empty junk (no name, no email, no mobile, no matri_id)
  const del = await Member.deleteMany({
    $and: [
      { $or: [{ firstname: { $in: [null, ''] } }, { firstname: { $exists: false } }] },
      { $or: [{ email: { $in: [null, ''] } }, { email: { $exists: false } }] },
      { $or: [{ mobile: { $in: [null, ''] } }, { mobile: { $exists: false } }] },
      { matri_id: { $nin: ['DEMO_MALE', 'DEMO_FEMALE'] } },
    ],
  })
  console.log('Removed empty members:', del.deletedCount)

  await upsertMember(DEMO_MALE)
  await upsertMember(DEMO_FEMALE)

  await ensurePaymentMethods()
  const plans = await Plan.countDocuments()
  if (!plans) {
    await Plan.create({
      plan_id: 1,
      plan_name: 'Gold',
      plan_amount: 2999,
      plan_duration: 90,
      plan_contacts: 50,
      profile: 100,
      status: 'APPROVED',
    })
    console.log('Created default Gold plan')
  }

  console.log('\nDemo logins:')
  console.log('  Male:   demo.male@matrimony.local / 12345678  (DEMO_MALE)')
  console.log('  Female: demo.female@matrimony.local / 12345678  (DEMO_FEMALE)')
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
