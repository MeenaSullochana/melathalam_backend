/**
 * Migrate key tables from the PHP MySQL dump into MongoDB Atlas.
 * Usage: npm run migrate -- [path-to-sql]
 * Default SQL path: ../u153810436_ammaiyappamatr.sql
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { connectDb } from '../src/config/db.js'
import {
  AdminUser, Member, Plan, SiteConfig, Master, CmsPage, SuccessStory,
  Advertisement, Interest, FirstForm, Payment,
} from '../src/models/index.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlPath = path.resolve(
  process.argv[2] || path.join(__dirname, '../../u153810436_ammaiyappamatr.sql'),
)

const TABLE_MAP = {
  admin_users: { model: AdminUser, key: 'uname' },
  register: { model: Member, key: 'matri_id' },
  membership_plan: { model: Plan, key: 'plan_id' },
  site_config: { model: SiteConfig, key: null },
  religion: { model: Master, type: 'religion', idField: 'religion_id', nameField: 'religion_name' },
  caste: { model: Master, type: 'caste', idField: 'caste_id', nameField: 'caste_name' },
  occupation: { model: Master, type: 'occupation', idField: 'ocp_id', nameField: 'ocp_name' },
  education_detail: { model: Master, type: 'education', idField: 'edu_id', nameField: 'edu_name' },
  mothertongue: { model: Master, type: 'mother-tongue', idField: 'mtongue_id', nameField: 'mtongue_name' },
  country: { model: Master, type: 'country', idField: 'country_id', nameField: 'country_name' },
  cms_pages: { model: CmsPage, key: 'cms_id' },
  success_story: { model: SuccessStory, key: 'story_id' },
  advertisement: { model: Advertisement, key: 'adv_id' },
  expressinterest: { model: Interest, key: 'ei_id' },
  first_form: { model: FirstForm, key: 'id' },
  payments: { model: Payment, key: 'payid' },
}

function splitSqlValues(tuple) {
  const values = []
  let cur = ''
  let inStr = false
  let quote = null
  let escaped = false
  for (let i = 0; i < tuple.length; i++) {
    const ch = tuple[i]
    if (escaped) {
      cur += ch
      escaped = false
      continue
    }
    if (inStr) {
      if (ch === '\\') {
        escaped = true
        cur += ch
        continue
      }
      if (ch === quote) {
        // MySQL escaped quote as ''
        if (tuple[i + 1] === quote) {
          cur += quote
          i++
          continue
        }
        inStr = false
        quote = null
        continue
      }
      cur += ch
      continue
    }
    if (ch === "'" || ch === '"') {
      inStr = true
      quote = ch
      continue
    }
    if (ch === ',') {
      values.push(cur.trim() === 'NULL' ? null : cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.length || values.length) values.push(cur.trim() === 'NULL' ? null : cur)
  return values.map((v) => {
    if (v === null) return null
    if (v === '') return ''
    // unescape common sequences
    return String(v)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
  })
}

function extractTuples(valuesSql) {
  const tuples = []
  let depth = 0
  let start = -1
  let inStr = false
  let quote = null
  let escaped = false
  for (let i = 0; i < valuesSql.length; i++) {
    const ch = valuesSql[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inStr) {
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === quote) {
        if (valuesSql[i + 1] === quote) {
          i++
          continue
        }
        inStr = false
        quote = null
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      inStr = true
      quote = ch
      continue
    }
    if (ch === '(') {
      if (depth === 0) start = i + 1
      depth++
      continue
    }
    if (ch === ')') {
      depth--
      if (depth === 0 && start >= 0) {
        tuples.push(valuesSql.slice(start, i))
        start = -1
      }
    }
  }
  return tuples
}

function rowFromColumns(columns, values) {
  const doc = {}
  columns.forEach((col, idx) => {
    let val = values[idx]
    if (val === undefined) return
    // numeric-looking fields
    if (val !== null && val !== '' && /^-?\d+(\.\d+)?$/.test(val) && !col.includes('mobile') && !col.includes('phone') && col !== 'matri_id' && col !== 'brideid' && col !== 'groomid') {
      const n = Number(val)
      if (!Number.isNaN(n)) val = n
    }
    doc[col] = val
  })
  return doc
}

async function upsertRows(table, columns, rows) {
  const cfg = TABLE_MAP[table]
  if (!cfg || !rows.length) return 0

  if (cfg.type) {
    const ops = rows.map((r) => {
      const legacy_id = r[cfg.idField]
      const name = r[cfg.nameField]
      const meta = { ...r }
      delete meta[cfg.idField]
      delete meta[cfg.nameField]
      delete meta.status
      return {
        updateOne: {
          filter: { type: cfg.type, legacy_id },
          update: {
            $set: {
              type: cfg.type,
              legacy_id,
              name,
              status: r.status || 'APPROVED',
              meta,
            },
          },
          upsert: true,
        },
      }
    })
    if (ops.length) await Master.bulkWrite(ops, { ordered: false })
    return ops.length
  }

  if (table === 'site_config') {
    for (const r of rows) {
      await SiteConfig.findOneAndUpdate({}, { $set: r }, { upsert: true })
    }
    return rows.length
  }

  const key = cfg.key
  const ops = rows
    .filter((r) => key && r[key] != null && r[key] !== '')
    .map((r) => ({
      updateOne: {
        filter: { [key]: r[key] },
        update: { $set: r },
        upsert: true,
      },
    }))
  if (ops.length) await cfg.model.bulkWrite(ops, { ordered: false })
  return ops.length
}

async function migrate() {
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath)
    process.exit(1)
  }

  console.log('Connecting MongoDB...')
  await connectDb()
  console.log('Reading SQL dump (streaming):', sqlPath)

  const rl = readline.createInterface({
    input: fs.createReadStream(sqlPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let buffer = ''
  let currentTable = null
  let columns = []
  let total = 0
  const counts = {}

  const flushInsert = async (sql) => {
    const m = sql.match(/INSERT\s+INTO\s+`([^`]+)`\s*(?:\(([^)]*)\))?\s*VALUES\s*([\s\S]*)/i)
    if (!m) return
    const table = m[1]
    if (!TABLE_MAP[table]) return
    const cols = m[2]
      ? m[2].split(',').map((c) => c.replace(/[`\s]/g, ''))
      : columns
    if (!cols.length) return
    const tuples = extractTuples(m[3])
    const rows = tuples.map((t) => rowFromColumns(cols, splitSqlValues(t)))
    const n = await upsertRows(table, cols, rows)
    counts[table] = (counts[table] || 0) + n
    total += n
    if (n) process.stdout.write(`\rImported ${total} rows... (${table}+${n})`)
  }

  for await (const line of rl) {
    const createMatch = line.match(/^CREATE TABLE `([^`]+)`/i)
    if (createMatch) {
      currentTable = createMatch[1]
      columns = []
      continue
    }
    if (currentTable && TABLE_MAP[currentTable] && /^\s*`([^`]+)`/.test(line) && !line.includes('PRIMARY') && !line.includes('KEY')) {
      const cm = line.match(/^\s*`([^`]+)`/)
      if (cm) columns.push(cm[1])
      continue
    }
    if (line.startsWith(') ENGINE') || line.startsWith(')ENGINE')) {
      currentTable = null
      continue
    }

    if (/^INSERT\s+INTO/i.test(line.trim())) {
      buffer = line
      if (line.trim().endsWith(';')) {
        await flushInsert(buffer)
        buffer = ''
      }
      continue
    }
    if (buffer) {
      buffer += '\n' + line
      if (line.trim().endsWith(';')) {
        await flushInsert(buffer)
        buffer = ''
      }
    }
  }

  console.log('\nMigration finished.')
  console.log(counts)
  process.exit(0)
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
