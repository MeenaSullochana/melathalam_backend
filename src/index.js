import dotenv from 'dotenv'
import { connectDb } from './config/db.js'
import { createApp } from './app.js'

dotenv.config()

const PORT = Number(process.env.PORT) || 5000
const app = createApp()

await connectDb()
app.listen(PORT, () => {
  console.log(`Matrimony API listening on http://localhost:${PORT}`)
})
