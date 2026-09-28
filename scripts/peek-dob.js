import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Member } from '../src/models/index.js'

dotenv.config()

await mongoose.connect(process.env.MONGODB_URI)
const samples = await Member.find({})
  .select('matri_id firstname birthdate birth_date dob age birthplace birthtime')
  .limit(5)
  .lean()
console.log(JSON.stringify(samples, null, 2))
await mongoose.disconnect()
