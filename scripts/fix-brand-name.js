import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const BRAND = 'Melathalam Matrimony'
const OLD_BRAND_RE = /ammai?appa(\s*matrimon(?:y|ial))?|forever\s*mine(\s*matrimony)?|http:\/\/ammai?appamatrimonial\.com\/?/gi

function replaceBrand(value) {
  if (typeof value !== 'string') return value
  let next = value.replace(OLD_BRAND_RE, BRAND)
  if (/^matrimony$/i.test(next.trim())) next = BRAND
  return next
}

function scrubDoc(doc) {
  const $set = {}
  for (const [key, val] of Object.entries(doc)) {
    if (key === '_id' || key === '__v') continue
    if (typeof val === 'string') {
      const next = replaceBrand(val)
      if (next !== val) $set[key] = next
    }
  }
  return $set
}

await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db

await db.collection('siteconfigs').updateOne(
  {},
  { $set: { web_name: BRAND, web_title: BRAND, from_name: BRAND } },
  { upsert: true },
)
await db.collection('emailsettings').updateMany({}, { $set: { from_name: BRAND } })

const re = /ammai?appa|forever\s*mine/i
const names = (await db.listCollections().toArray()).map((c) => c.name)
for (const name of names) {
  const docs = await db.collection(name).find({}).limit(300).toArray()
  let updates = 0
  for (const doc of docs) {
    if (!re.test(JSON.stringify(doc))) continue
    const $set = scrubDoc(doc)
    if (!Object.keys($set).length) continue
    await db.collection(name).updateOne({ _id: doc._id }, { $set })
    updates += 1
    console.log('updated', name, doc._id.toString(), Object.keys($set))
  }
  if (updates) console.log(`${name}: ${updates} docs`)
}

const site = await db.collection('siteconfigs').findOne({})
console.log('site now', { web_name: site?.web_name, web_title: site?.web_title, logo: site?.logo })
await mongoose.disconnect()
console.log('done')
