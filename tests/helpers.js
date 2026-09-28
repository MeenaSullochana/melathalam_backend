import request from 'supertest'
import { createApp } from '../src/app.js'
import { md5 } from '../src/utils/md5.js'
import { AdminUser, Member, Plan } from '../src/models/index.js'

export function getApp() {
  return createApp()
}

export async function seedAdmin({
  uname = 'admin1',
  password = 'admin',
  email = 'admin@test.local',
} = {}) {
  await AdminUser.create({
    id: 1,
    uname,
    pswd: md5(password),
    role_id: 1,
    email,
    status: '1',
  })
  return { uname, password, email }
}

export async function seedMember(overrides = {}) {
  const index_id = overrides.index_id || Math.floor(Math.random() * 90000) + 1000
  const matri_id = overrides.matri_id || `T${index_id}`
  const password = overrides.plainPassword || 'demo123'
  const doc = {
    index_id,
    matri_id,
    email: overrides.email || `${matri_id.toLowerCase()}@test.local`,
    mobile: overrides.mobile || `9${String(index_id).padStart(9, '0')}`,
    password: md5(password),
    username: overrides.username || `User ${matri_id}`,
    firstname: overrides.firstname || 'Test',
    lastname: overrides.lastname || 'User',
    gender: overrides.gender || 'Male',
    status: overrides.status || 'Active',
    birthdate: overrides.birthdate || '1995-01-15',
    age: overrides.age || '30',
    ...overrides,
  }
  delete doc.plainPassword
  await Member.create(doc)
  return { ...doc, plainPassword: password }
}

export async function seedPlan(overrides = {}) {
  const plan = {
    plan_id: overrides.plan_id || 101,
    plan_name: overrides.plan_name || 'TEST PLAN',
    plan_amount: overrides.plan_amount ?? 1000,
    plan_duration: overrides.plan_duration ?? 30,
    plan_contacts: overrides.plan_contacts ?? 10,
    profile: overrides.profile ?? 20,
    plan_msg: 0,
    plan_sms: 0,
    status: overrides.status ?? 'APPROVED',
    ...overrides,
  }
  await Plan.create(plan)
  return plan
}

export async function loginAdmin(app, { username = 'admin1', password = 'admin' } = {}) {
  const res = await request(app).post('/api/admin/auth/login').send({ username, password })
  if (!res.body?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(res.body)}`)
  }
  return res.body.token
}

export async function loginMember(app, identifier, password = 'demo123') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier, password })
  if (!res.body?.token) {
    throw new Error(`Member login failed: ${JSON.stringify(res.body)}`)
  }
  return res.body.token
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` }
}
