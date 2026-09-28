import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()
await mongoose.connect(process.env.MONGODB_URI)
const types = await mongoose.connection.collection('masters').aggregate([
  { $group: { _id: '$type', n: { $sum: 1 } } },
]).toArray()
console.log(types)
await mongoose.disconnect()
