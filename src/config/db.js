import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

export async function connectDb() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set in backend/.env')

  // Legacy PHP fields (religion, caste, etc.) are not all declared on the schema.
  // strictQuery:true strips those paths from filters — breaking search.
  mongoose.set('strictQuery', false)
  await mongoose.connect(uri)
  console.log('MongoDB connected:', mongoose.connection.name)
  return mongoose.connection
}

export default mongoose
