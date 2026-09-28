import { describe, it, expect } from 'vitest'
import {
  activateMembership,
  planRemaining,
  consumeProfileView,
  unlockContact,
} from '../src/services/membership.js'
import { Member, ContactView } from '../src/models/index.js'
import { seedMember, seedPlan } from './helpers.js'
import { md5 } from '../src/utils/md5.js'

describe('membership service', () => {
  it('planRemaining reports paid quotas', () => {
    const rem = planRemaining({
      status: 'Paid',
      plan_expired_on: '2099-01-01',
      p_profile: 20,
      r_profile: 5,
      p_no_contacts: 10,
      r_cnt: 2,
      plan_name: 'PREMIUM',
    })
    expect(rem.isPaid).toBe(true)
    expect(rem.profilesLeft).toBe(15)
    expect(rem.contactsLeft).toBe(8)
  })

  it('activateMembership seeds quotas from plan', async () => {
    await seedPlan({ plan_id: 10, plan_name: 'GOLD', profile: 25, plan_contacts: 12, plan_duration: 30 })
    await seedMember({
      matri_id: 'ACT1',
      email: 'act1@test.local',
      status: 'Active',
      password: md5('demo123'),
    })
    await activateMembership('ACT1', 10, 'GOLD')
    const m = await Member.findOne({ matri_id: 'ACT1' }).lean()
    expect(m.status).toBe('Paid')
    expect(m.plan_name).toBe('GOLD')
    expect(Number(m.p_profile)).toBe(25)
    expect(Number(m.p_no_contacts)).toBe(12)
    expect(Number(m.r_profile)).toBe(0)
    expect(m.plan_expired_on).toBeTruthy()
  })

  it('consumeProfileView charges once per unique target', async () => {
    await seedPlan({ plan_id: 11, profile: 5, plan_contacts: 5 })
    await seedMember({
      matri_id: 'VIEWER1',
      email: 'v1@test.local',
      gender: 'Male',
      status: 'Paid',
      plan_expired_on: '2099-01-01',
      p_profile: 5,
      r_profile: 0,
      password: md5('demo123'),
    })
    await seedMember({
      matri_id: 'TARGET1',
      email: 't1@test.local',
      gender: 'Female',
      status: 'Active',
      password: md5('demo123'),
    })

    const first = await consumeProfileView('VIEWER1', 'TARGET1')
    expect(first.ok).toBe(true)
    expect(first.charged).toBe(true)

    const second = await consumeProfileView('VIEWER1', 'TARGET1')
    expect(second.ok).toBe(true)
    expect(second.charged).toBe(false)

    const viewer = await Member.findOne({ matri_id: 'VIEWER1' }).lean()
    expect(Number(viewer.r_profile)).toBe(1)
  })

  it('unlockContact creates ContactView and increments r_cnt', async () => {
    await seedMember({
      matri_id: 'CV1',
      email: 'cv1@test.local',
      gender: 'Male',
      status: 'Paid',
      plan_expired_on: '2099-01-01',
      p_no_contacts: 5,
      r_cnt: 0,
      password: md5('demo123'),
    })
    await seedMember({
      matri_id: 'CV2',
      email: 'cv2@test.local',
      mobile: '9000000002',
      gender: 'Female',
      status: 'Active',
      password: md5('demo123'),
    })

    const res = await unlockContact('CV1', 'CV2')
    expect(res.ok).toBe(true)
    expect(res.contact?.matri_id).toBe('CV2')
    expect(await ContactView.countDocuments({ viewer_id: 'CV1', viewed_id: 'CV2' })).toBe(1)

    const again = await unlockContact('CV1', 'CV2')
    expect(again.already).toBe(true)

    const viewer = await Member.findOne({ matri_id: 'CV1' }).lean()
    expect(Number(viewer.r_cnt)).toBe(1)
  })
})
