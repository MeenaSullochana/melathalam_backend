import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** backend/ package root (works on Render when only backend is deployed) */
export const BACKEND_ROOT = path.resolve(__dirname, '../..')
/** Monorepo root (local: matrimony/). May not exist on Render. */
export const MONOREPO_ROOT = path.resolve(BACKEND_ROOT, '..')

export function resolveUploadDir(subdir = 'my_photos') {
  const envDir = process.env.UPLOAD_DIR?.trim()
  let dest
  if (envDir && path.isAbsolute(envDir)) {
    dest = envDir
  } else if (envDir) {
    // Relative UPLOAD_DIR is resolved from backend root (Render-safe)
    dest = path.resolve(BACKEND_ROOT, envDir)
  } else if (subdir === 'my_photos' || subdir === 'documents' || subdir === 'img') {
    dest = path.join(BACKEND_ROOT, subdir)
  } else {
    dest = path.join(BACKEND_ROOT, subdir)
  }
  fs.mkdirSync(dest, { recursive: true })
  return dest
}

/** Prefer backend-local folder; fall back to monorepo sibling folders used in local PHP layout. */
export function resolveStaticDirs(...relativeCandidates) {
  const dirs = []
  for (const rel of relativeCandidates) {
    const abs = path.resolve(BACKEND_ROOT, rel)
    if (fs.existsSync(abs) && !dirs.includes(abs)) dirs.push(abs)
  }
  for (const rel of relativeCandidates) {
    const abs = path.resolve(MONOREPO_ROOT, rel.replace(/^\.\.\//, ''))
    if (fs.existsSync(abs) && !dirs.includes(abs)) dirs.push(abs)
  }
  return dirs
}

export function createUploader(subdir = 'my_photos') {
  const dest = resolveUploadDir(subdir)

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
      const safe = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`
      cb(null, safe)
    },
  })

  return multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
        return cb(new Error('Only image or PDF uploads allowed'))
      }
      cb(null, true)
    },
  })
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function findMemberByMatriId(Member, matriId) {
  const raw = decodeURIComponent(String(matriId || '')).trim()
  if (!raw) return null
  let member = await Member.findOne({ matri_id: raw }).lean()
  if (member) return member
  member = await Member.findOne({ matri_id: new RegExp(`^\\s*${escapeRegex(raw)}\\s*$`) }).lean()
  return member
}

export function cleanMember(member) {
  if (!member) return member
  const out = { ...member }
  if (out.matri_id) out.matri_id = String(out.matri_id).trim()
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = out[k].trim()
  }
  // Normalize DOB for clients (HTML date inputs need yyyy-mm-dd)
  const rawDob = out.birthdate || out.birth_date || out.dob
  if (rawDob) {
    const normalized = normalizeDateYmd(rawDob)
    if (normalized) out.birthdate = normalized
  }
  delete out.password
  delete out.cpassword
  return out
}

function normalizeDateYmd(raw) {
  if (raw == null || raw === '') return ''
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10)
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const month = Number(us[1])
    const day = Number(us[2])
    const y = us[3]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const dmy = s.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const y = dmy[3]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ''
}
