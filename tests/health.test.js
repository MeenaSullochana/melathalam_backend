import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { getApp } from './helpers.js'

describe('GET /api/health', () => {
  it('returns success', async () => {
    const res = await request(getApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toMatch(/Matrimony API/)
  })
})
