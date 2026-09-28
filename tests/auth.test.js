import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { getApp, seedAdmin, seedMember, loginAdmin, loginMember, auth } from './helpers.js'

describe('Auth', () => {
  const app = getApp()

  beforeEach(async () => {
    await seedAdmin()
  })

  it('registers and logs in a member', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'newuser@test.local',
      phone: '9123456789',
      password: 'pass1234',
      firstName: 'New',
      lastName: 'User',
      gender: 'Male',
    })
    expect(reg.status).toBe(201)
    expect(reg.body.success).toBe(true)
    expect(reg.body.token).toBeTruthy()
    expect(reg.body.member?.email).toBe('newuser@test.local')

    const login = await request(app).post('/api/auth/login').send({
      identifier: 'newuser@test.local',
      password: 'pass1234',
    })
    expect(login.status).toBe(200)
    expect(login.body.token).toBeTruthy()

    const me = await request(app).get('/api/auth/me').set(auth(login.body.token))
    expect(me.status).toBe(200)
    expect(me.body.member?.email).toBe('newuser@test.local')
  })

  it('rejects wrong member password', async () => {
    await seedMember({ matri_id: 'M100', email: 'm100@test.local', plainPassword: 'demo123' })
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'M100',
      password: 'wrong',
    })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('logs in admin', async () => {
    const token = await loginAdmin(app)
    expect(token).toBeTruthy()
    const me = await request(app).get('/api/admin/auth/me').set(auth(token))
    expect(me.status).toBe(200)
    expect(me.body.admin?.uname).toBe('admin1')
  })

  it('rejects wrong admin password', async () => {
    const res = await request(app).post('/api/admin/auth/login').send({
      username: 'admin1',
      password: 'nope',
    })
    expect(res.status).toBe(401)
  })

  it('loginMember helper works', async () => {
    await seedMember({ matri_id: 'M200', email: 'm200@test.local' })
    const token = await loginMember(app, 'M200')
    expect(token).toBeTruthy()
  })
})
