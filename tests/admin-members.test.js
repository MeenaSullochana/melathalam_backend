import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import {
  getApp,
  seedAdmin,
  seedMember,
  seedPlan,
  loginAdmin,
  auth,
} from './helpers.js'
import { md5 } from '../src/utils/md5.js'
import { Payment, Interest, WhoViewed } from '../src/models/index.js'

describe('Admin members', () => {
  const app = getApp()
  let adminToken

  beforeEach(async () => {
    await seedAdmin()
    adminToken = await loginAdmin(app)
    await seedPlan({ plan_id: 28, plan_name: 'NORMAL', profile: 50, plan_contacts: 20 })
    await seedMember({
      matri_id: 'ADM1',
      email: 'adm1@test.local',
      firstname: 'Arjun',
      lastname: 'Demo',
      status: 'Paid',
      plan_id: 28,
      plan_name: 'NORMAL',
      plan_expired_on: '2099-01-01',
      password: md5('demo123'),
      mobile: '9333333333',
    })
    await seedMember({
      matri_id: 'ADM2',
      email: 'other@test.local',
      firstname: 'Other',
      status: 'Active',
      password: md5('demo123'),
      mobile: '9444444444',
      index_id: 8002,
    })
  })

  it('searches by matri_id and email', async () => {
    const byId = await request(app)
      .get('/api/admin/members?q=ADM1')
      .set(auth(adminToken))
    expect(byId.status).toBe(200)
    expect(byId.body.members?.some((m) => m.matri_id === 'ADM1')).toBe(true)

    const byEmail = await request(app)
      .get('/api/admin/members?q=adm1@test.local')
      .set(auth(adminToken))
    expect(byEmail.body.members?.some((m) => m.email === 'adm1@test.local')).toBe(true)
  })

  it('sets member inactive', async () => {
    const res = await request(app)
      .patch('/api/admin/members/ADM1/status')
      .set(auth(adminToken))
      .send({ status: 'Inactive' })
    expect(res.status).toBe(200)

    const get = await request(app).get('/api/admin/members/ADM1').set(auth(adminToken))
    expect(get.body.member?.status).toBe('Inactive')
  })

  it('returns member history', async () => {
    await Payment.create({
      payid: 1,
      matri_id: 'ADM1',
      plan_id: 28,
      plan_name: 'NORMAL',
      plan_amount: 4000,
      status: 'Paid',
      pay_date: new Date(),
    })
    await Interest.create({
      ei_id: 1,
      ei_sender: 'ADM1',
      ei_receiver: 'ADM2',
      receiver_response: 'Pending',
      trash_sender: 'No',
      trash_receiver: 'No',
    })
    await WhoViewed.create({
      who_id: 1,
      my_id: 'ADM1',
      viewed_member_id: 'ADM2',
      viewed_date: new Date(),
    })

    const res = await request(app)
      .get('/api/admin/members/ADM1/history')
      .set(auth(adminToken))
    expect(res.status).toBe(200)
    expect(res.body.history?.payments?.length).toBe(1)
    expect(res.body.history?.interestsSent?.length).toBe(1)
    expect(res.body.history?.profilesViewed?.length).toBe(1)
    expect(res.body.history?.package?.plan_name).toBe('NORMAL')
  })
})
