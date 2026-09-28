import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Member } from '../src/models/index.js'

dotenv.config()
await mongoose.connect(process.env.MONGODB_URI)

// Only flip approval flags — do NOT overwrite real media filenames from seed:stages
await Member.updateOne(
  { matri_id: 'DEMO_M2' },
  {
    $set: {
      profile_text: 'Business owner seeking a traditional yet modern partner.',
      profile_text_approve: 'UNAPPROVED',
      part_expect: 'Looking for a compatible partner.',
      part_expect_approve: 'UNAPPROVED',
      photo1_approve: 'UNAPPROVED',
      hor_check: 'UNAPPROVED',
      aadhaar_card_status: 'PENDING',
    },
  },
)

await Member.updateOne(
  { matri_id: 'DEMO_F2' },
  {
    $set: {
      profile_text_approve: 'UNAPPROVED',
      part_expect_approve: 'UNAPPROVED',
      photo1_approve: 'UNAPPROVED',
    },
  },
)

console.log('Pending approval flags set on DEMO_M2 and DEMO_F2 (media filenames preserved)')
await mongoose.disconnect()
