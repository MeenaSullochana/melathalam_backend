import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Master } from '../src/models/index.js'

dotenv.config()

function ftInLabel(inches) {
  if (inches <= 48) return 'Below 4ft'
  if (inches >= 84) return 'Above 7ft'
  const ft = Math.floor(inches / 12)
  const inch = inches % 12
  return `${ft}ft ${inch}in`
}

async function seedType(type, names, metaFn) {
  const existing = await Master.countDocuments({ type })
  if (existing > 0) {
    console.log(type, 'already has', existing, 'rows — skip')
    return
  }
  const docs = names.map((name, i) => ({
    type,
    legacy_id: i + 1,
    name: typeof name === 'string' ? name : name.name,
    status: 'APPROVED',
    meta: metaFn ? metaFn(name, i) : {},
  }))
  await Master.insertMany(docs)
  console.log('Seeded', type, docs.length)
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)

  const heights = []
  for (let inches = 48; inches <= 85; inches++) {
    heights.push({ name: ftInLabel(inches), value: String(inches) })
  }
  await seedType('height', heights, (h) => ({ value: h.value }))

  const weights = []
  for (let kg = 40; kg <= 140; kg++) {
    weights.push({ name: `${kg} Kg`, value: String(kg) })
  }
  await seedType('weight', weights, (w) => ({ value: w.value }))

  await seedType('diet', ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan', 'Jain'])
  await seedType('complexion', ['Very Fair', 'Fair', 'Wheatish', 'Wheatish Brown', 'Dark', 'Other'])
  await seedType('body-type', ['Slim', 'Average', 'Athletic', 'Heavy', 'Other'])

  await mongoose.disconnect()
  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
