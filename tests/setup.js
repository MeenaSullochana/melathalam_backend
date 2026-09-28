import { beforeAll, afterAll, beforeEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-matrimony'
process.env.JWT_EXPIRES_IN = '1d'
process.env.NODE_ENV = 'test'

let mongo

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri()
  mongoose.set('strictQuery', true)
  await mongoose.connect(process.env.MONGODB_URI)
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
})

beforeEach(async () => {
  const cols = await mongoose.connection.db.collections()
  for (const col of cols) {
    await col.deleteMany({})
  }
})
