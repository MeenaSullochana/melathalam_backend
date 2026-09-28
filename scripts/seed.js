import dotenv from 'dotenv'
import { connectDb } from '../src/config/db.js'
import {
  AdminUser, Plan, SiteConfig, Master, Member, CmsPage, SuccessStory,
} from '../src/models/index.js'
import { md5 } from '../src/utils/md5.js'

dotenv.config()

async function seed() {
  await connectDb()

  await AdminUser.findOneAndUpdate(
    { uname: 'admin1' },
    {
      $set: {
        id: 1,
        uname: 'admin1',
        pswd: md5('12345678'),
        role_id: 1,
        email: 'admin@matrimony.local',
        status: '1',
      },
    },
    { upsert: true },
  )

  const plans = [
    { plan_id: 28, plan_name: 'NORMAL', plan_type: 'PAID', plan_amount: 4000, plan_amount_type: 'Rs.', plan_duration: 365, plan_contacts: 200, profile: 150, plan_msg: 0, plan_sms: 0, chat: 'Yes', status: 'APPROVED' },
    { plan_id: 29, plan_name: 'PREMIUM', plan_type: 'PAID', plan_amount: 5000, plan_amount_type: 'Rs.', plan_duration: 500, plan_contacts: 300, profile: 100, plan_msg: 0, plan_sms: 0, chat: 'Yes', status: 'APPROVED' },
    { plan_id: 30, plan_name: 'LIFETIME', plan_type: 'PAID', plan_amount: 7500, plan_amount_type: 'Rs.', plan_duration: 750, plan_contacts: 400, profile: 400, plan_msg: 0, plan_sms: 0, chat: 'Yes', status: 'APPROVED' },
    { plan_id: 31, plan_name: 'ELITE', plan_type: 'PAID', plan_amount: 10000, plan_amount_type: 'Rs.', plan_duration: 1000, plan_contacts: 750, profile: 200, plan_msg: 0, plan_sms: 0, chat: 'No', status: 'APPROVED' },
  ]
  for (const p of plans) {
    await Plan.findOneAndUpdate({ plan_id: p.plan_id }, { $set: p }, { upsert: true })
  }

  await SiteConfig.findOneAndUpdate(
    {},
    {
      $set: {
        id: '1',
        web_name: 'http://localhost:5173/',
        welcome_text: 'Welcome to Matrimony',
        web_frienly_name: 'Matrimony',
        contact_no: '97503 81754',
        title: 'Matrimony',
        description: 'Find your life partner',
        keywords: 'matrimony',
        from_email: 'admin@matrimony.local',
        to_email: 'admin@matrimony.local',
        contact_email: 'admin@matrimony.local',
        feedback_email: 'admin@matrimony.local',
        footer: 'Matrimony',
        interest_setting: 'send_to_all',
        profile_view_setting: 'visible_to_all',
        username_setting: 'full_username',
      },
    },
    { upsert: true },
  )

  const religions = [
    { legacy_id: 37, name: 'Hindu' },
    { legacy_id: 45, name: 'Muslim' },
    { legacy_id: 56, name: 'Christian' },
    { legacy_id: 57, name: 'Others' },
  ]
  for (const r of religions) {
    await Master.findOneAndUpdate(
      { type: 'religion', legacy_id: r.legacy_id },
      { $set: { type: 'religion', legacy_id: r.legacy_id, name: r.name, status: 'APPROVED' } },
      { upsert: true },
    )
  }

  const demoCount = await Member.countDocuments()
  if (demoCount === 0) {
    await Member.create({
      index_id: 1001,
      matri_id: '1001',
      email: 'demo@matrimony.local',
      password: md5('12345678'),
      username: 'Demo User',
      firstname: 'Demo',
      lastname: 'User',
      gender: 'Male',
      mobile: '9999999999',
      mobile_code: '+91',
      status: 'Active',
      photo1: 'default.png',
      profile_text: 'Demo profile for testing the MongoDB-backed matrimony app.',
      profile_text_approve: 'Approve',
      m_status: 'Never Married',
      birthdate: '1/1/1995',
      height: '5ft 8in',
      logged_in: '0',
      reg_date: new Date(),
    })
    console.log('Created demo member: demo@matrimony.local / 12345678')
  }

  const cmsCount = await CmsPage.countDocuments()
  if (cmsCount === 0) {
    await CmsPage.insertMany([
      { cms_id: 6, page_name: 'Privacy Policy', cms_title: 'Privacy Policy', cms_content: '<p>Privacy policy content</p>', status: 'APPROVED' },
      { cms_id: 7, page_name: 'Terms & Condition', cms_title: 'Terms & Condition', cms_content: '<p>Terms content</p>', status: 'APPROVED' },
    ])
  }

  const storyCount = await SuccessStory.countDocuments()
  if (storyCount === 0) {
    await SuccessStory.create({
      story_id: 1,
      weddingphoto: '',
      weddingphoto_type: 'photo',
      bridename: 'Priya',
      brideid: 'B1',
      groomname: 'Arun',
      groomid: 'G1',
      marriagedate: '2024-01-01',
      engagement_date: '',
      address: 'Chennai',
      country: 'India',
      successmessage: 'Thank you for helping us find each other.',
      status: 'APPROVED',
      fstatus: '1',
    })
  }

  console.log('Seed complete.')
  console.log('Admin: admin1 / 12345678')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
