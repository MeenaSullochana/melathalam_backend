import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { getApp, seedPlan } from './helpers.js'

describe('Public plans', () => {
  const app = getApp()

  it('returns plans even when status has leading spaces', async () => {
    await seedPlan({
      plan_id: 28,
      plan_name: ' NORMAL',
      status: ' APPROVED',
      plan_amount: 4000,
      plan_contacts: 200,
      profile: 150,
    })
    await seedPlan({
      plan_id: 29,
      plan_name: 'PREMIUM',
      status: 'APPROVED',
      plan_amount: 5000,
      plan_contacts: 300,
      profile: 100,
    })
    await seedPlan({
      plan_id: 99,
      plan_name: 'HIDDEN',
      status: 'UNAPPROVED',
      plan_amount: 1,
    })

    const res = await request(app).get('/api/public/plans')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const names = (res.body.plans || []).map((p) => p.plan_name)
    expect(names).toContain('NORMAL')
    expect(names).toContain('PREMIUM')
    expect(names).not.toContain('HIDDEN')
    expect(res.body.plans.every((p) => p.status === 'APPROVED')).toBe(true)
  })
})
