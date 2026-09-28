import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { getApp, seedAdmin, seedMember, loginAdmin, auth } from './helpers.js'
import { md5 } from '../src/utils/md5.js'
import { Member } from '../src/models/index.js'

describe('Approvals', () => {
  const app = getApp()
  let adminToken

  beforeEach(async () => {
    await seedAdmin()
    adminToken = await loginAdmin(app)
    await seedMember({
      matri_id: 'AP1',
      email: 'ap1@test.local',
      status: 'Active',
      password: md5('demo123'),
      profile_text: 'About me pending',
      profile_text_approve: 'UNAPPROVED',
      part_expect: 'Partner text',
      part_expect_approve: 'UNAPPROVED',
      photo1: 'p1.jpg',
      photo1_approve: 'UNAPPROVED',
      hor_photo: 'h1.jpg',
      hor_check: 'UNAPPROVED',
      aadhaar_card: 'a1.pdf',
      aadhaar_card_status: 'PENDING',
    })
  })

  it('lists pending members in inbox', async () => {
    const res = await request(app)
      .get('/api/admin/approvals/pending-members')
      .set(auth(adminToken))
    expect(res.status).toBe(200)
    expect(res.body.items?.some((i) => i.matri_id === 'AP1')).toBe(true)
    const row = res.body.items.find((i) => i.matri_id === 'AP1')
    expect(row.pendingCount).toBeGreaterThan(0)
  })

  it('loads member approval items and approve-all', async () => {
    const detail = await request(app)
      .get('/api/admin/approvals/member/AP1')
      .set(auth(adminToken))
    expect(detail.status).toBe(200)
    expect(detail.body.pendingCount).toBeGreaterThan(0)

    const act = await request(app)
      .post('/api/admin/approvals/member/AP1')
      .set(auth(adminToken))
      .send({ action: 'approve-all' })
    expect(act.status).toBe(200)

    const after = await request(app)
      .get('/api/admin/approvals/member/AP1')
      .set(auth(adminToken))
    expect(after.body.pendingCount).toBe(0)
    expect(after.body.items.every((i) => i.status === 'APPROVED')).toBe(true)

    const m = await Member.findOne({ matri_id: 'AP1' }).lean()
    expect(['Approve', 'APPROVED']).toContain(m.profile_text_approve)
    expect(m.photo1_approve).toBe('APPROVED')
    expect(m.hor_check).toBe('APPROVED')
  })

  it('rejects checked keys only', async () => {
    const act = await request(app)
      .post('/api/admin/approvals/member/AP1')
      .set(auth(adminToken))
      .send({ action: 'reject', keys: ['about-me'] })
    expect(act.status).toBe(200)
    const m = await Member.findOne({ matri_id: 'AP1' }).lean()
    expect(m.profile_text_approve).toBe('UNAPPROVED')
  })
})
