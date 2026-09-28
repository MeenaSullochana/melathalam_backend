import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { Interest } from '../src/models/index.js'
import { getApp, seedMember, loginMember, auth } from './helpers.js'
import { md5 } from '../src/utils/md5.js'

describe('Interests flow', () => {
  const app = getApp()
  let maleToken
  let femaleToken

  beforeEach(async () => {
    await seedMember({
      matri_id: 'IM1',
      email: 'im1@test.local',
      gender: 'Male',
      status: 'Paid',
      plan_expired_on: '2099-01-01',
      password: md5('demo123'),
    })
    await seedMember({
      matri_id: 'IF1',
      email: 'if1@test.local',
      gender: 'Female',
      status: 'Active',
      password: md5('demo123'),
      mobile: '9111111111',
    })
    maleToken = await loginMember(app, 'IM1')
    femaleToken = await loginMember(app, 'IF1')
  })

  it('sends interest, accepts as mutual, and rejects as not interested', async () => {
    const send = await request(app)
      .post('/api/member/interests')
      .set(auth(maleToken))
      .send({ toMatriId: 'IF1', message: 'Hello' })
    expect(send.status).toBe(200)
    expect(send.body.success).toBe(true)

    const listF = await request(app).get('/api/member/interests').set(auth(femaleToken))
    expect(listF.body.received?.length).toBe(1)
    const eiId = listF.body.received[0].ei_id

    const accept = await request(app)
      .post(`/api/member/interests/${eiId}/respond`)
      .set(auth(femaleToken))
      .send({ action: 'accept' })
    expect(accept.status).toBe(200)
    expect(accept.body.mutual).toBe(true)

    const updated = await Interest.findOne({ ei_id: eiId }).lean()
    expect(updated.receiver_response).toBe('Accept')

    // Second interest to reject
    await seedMember({
      matri_id: 'IM2',
      email: 'im2@test.local',
      gender: 'Male',
      status: 'Paid',
      plan_expired_on: '2099-01-01',
      password: md5('demo123'),
      mobile: '9222222222',
      index_id: 5002,
    })
    const male2 = await loginMember(app, 'IM2')
    await request(app)
      .post('/api/member/interests')
      .set(auth(male2))
      .send({ toMatriId: 'IF1', message: 'Hi again' })

    const list2 = await request(app).get('/api/member/interests').set(auth(femaleToken))
    const pending = list2.body.received.find((r) => r.receiver_response === 'Pending')
    expect(pending).toBeTruthy()

    const reject = await request(app)
      .post(`/api/member/interests/${pending.ei_id}/respond`)
      .set(auth(femaleToken))
      .send({ action: 'reject' })
    expect(reject.status).toBe(200)
    expect(reject.body.message).toMatch(/Not Interested/i)

    const rejected = await Interest.findOne({ ei_id: pending.ei_id }).lean()
    expect(rejected.receiver_response).toBe('Reject')
  })

  it('blocks duplicate interest', async () => {
    await request(app)
      .post('/api/member/interests')
      .set(auth(maleToken))
      .send({ toMatriId: 'IF1' })
    const again = await request(app)
      .post('/api/member/interests')
      .set(auth(maleToken))
      .send({ toMatriId: 'IF1' })
    expect(again.status).toBe(409)
  })
})
