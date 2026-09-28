import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Member } from '../src/models/index.js'

dotenv.config()

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const cursor = Member.find({ matri_id: /^\s|\s$/ }).cursor()
  let n = 0
  for await (const doc of cursor) {
    const trimmed = String(doc.matri_id || '').trim()
    if (!trimmed || trimmed === doc.matri_id) continue
    const exists = await Member.findOne({ matri_id: trimmed, _id: { $ne: doc._id } }).lean()
    if (exists) {
      // keep unique: append index if collision
      const alt = `${trimmed}-dup-${doc.index_id || n}`
      await Member.updateOne({ _id: doc._id }, { $set: { matri_id: alt } })
    } else {
      await Member.updateOne({ _id: doc._id }, { $set: { matri_id: trimmed } })
    }
    n++
    if (n % 500 === 0) console.log('trimmed', n)
  }
  console.log('Done. Trimmed', n, 'matri_id values')
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
