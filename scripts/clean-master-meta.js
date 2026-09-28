import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Master } from '../src/models/index.js'

dotenv.config()

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  let n = 0
  const cursor = Master.find({}).cursor()
  for await (const doc of cursor) {
    const updates = {}
    if (typeof doc.name === 'string' && doc.name !== doc.name.trim()) updates.name = doc.name.trim()
    if (typeof doc.status === 'string' && doc.status !== doc.status.trim()) updates.status = doc.status.trim()
    if (doc.meta && typeof doc.meta === 'object') {
      const meta = { ...(doc.meta.toObject?.() || doc.meta) }
      let changed = false
      for (const [k, v] of Object.entries(meta)) {
        if (typeof v === 'string') {
          const t = v.trim()
          if (/^\d+$/.test(t)) {
            meta[k] = Number(t)
            changed = true
          } else if (t !== v) {
            meta[k] = t
            changed = true
          }
        }
      }
      if (changed) updates.meta = meta
    }
    if (Object.keys(updates).length) {
      await Master.updateOne({ _id: doc._id }, { $set: updates })
      n++
    }
  }
  console.log('cleaned', n)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
