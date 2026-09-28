import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

import adminAuth from './routes/adminAuth.js'
import adminDashboard from './routes/adminDashboard.js'
import adminMembers from './routes/adminMembers.js'
import adminMaster from './routes/adminMaster.js'
import adminApprovals from './routes/adminApprovals.js'
import adminPlans from './routes/adminPlans.js'
import adminCms from './routes/adminCms.js'
import adminSettings from './routes/adminSettings.js'
import adminDatabase from './routes/adminDatabase.js'
import auth from './routes/auth.js'
import member from './routes/member.js'
import publicRoutes from './routes/public.js'
import payments from './routes/payments.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Express app factory — used by server and tests (no listen / no DB connect). */
export function createApp() {
  const app = express()

  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://melathalam-matrimony.netlify.app',
    'https://roaring-cajeta-114fd4.netlify.app',
  ]

  const allowed = new Set([...defaultOrigins, ...envOrigins])

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / server-to-server / curl (no Origin header)
        if (!origin) return callback(null, true)
        if (allowed.has(origin)) return callback(null, true)
        // Any Netlify preview / production subdomain for this project family
        if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin)) {
          return callback(null, true)
        }
        return callback(null, false)
      },
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  const backendRoot = path.resolve(__dirname, '..')
  const uploadDir = path.resolve(backendRoot, process.env.UPLOAD_DIR || '../my_photos')
  app.use('/uploads', express.static(uploadDir))
  app.use('/my_photos', express.static(uploadDir))
  app.use('/documents', express.static(path.resolve(backendRoot, '../documents')))
  app.use('/img', express.static(path.resolve(backendRoot, '../img')))
  app.use('/img/qr', express.static(path.resolve(backendRoot, '../img/qr')))
  app.use('/SuccessStory', express.static(path.resolve(backendRoot, '../SuccessStory')))
  app.use('/horoscope-list', express.static(path.resolve(backendRoot, '../horoscope-list')))

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      message: 'Matrimony API running (MongoDB)',
      time: new Date().toISOString(),
    })
  })

  app.use('/api/auth', auth)
  app.use('/api/public', publicRoutes)
  app.use('/api/member', member)
  app.use('/api/payments', payments)

  app.use('/api/admin/auth', adminAuth)
  app.use('/api/admin/dashboard', adminDashboard)
  app.use('/api/admin/members', adminMembers)
  app.use('/api/admin/master', adminMaster)
  app.use('/api/admin/approvals', adminApprovals)
  app.use('/api/admin/plans', adminPlans)
  app.use('/api/admin/cms', adminCms)
  app.use('/api/admin/settings', adminSettings)
  app.use('/api/admin/database', adminDatabase)

  const frontDist = process.env.FRONTEND_DIST
    ? path.resolve(__dirname, process.env.FRONTEND_DIST)
    : path.resolve(__dirname, '../../frontend/dist')
  if (fs.existsSync(frontDist)) {
    app.use(express.static(frontDist))
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/my_photos') ||
        req.path.startsWith('/documents') ||
        req.path.startsWith('/img') ||
        req.path.startsWith('/uploads') ||
        req.path.startsWith('/horoscope-list') ||
        req.path.startsWith('/SuccessStory')
      ) {
        return next()
      }
      res.sendFile(path.join(frontDist, 'index.html'))
    })
  }

  app.use((err, _req, res, _next) => {
    console.error(err)
    res.status(500).json({ success: false, message: err.message || 'Server error' })
  })

  return app
}

export default createApp
