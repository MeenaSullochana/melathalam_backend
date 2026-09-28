import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Member, Interest, Shortlist, WhoViewed, Payment } from '../src/models/index.js'

dotenv.config()

function isBlank(v) {
  return v == null || String(v).trim() === ''
}

async function main() {
  const wipeAll = process.argv.includes('--all')
  const keepDemos = !process.argv.includes('--no-demos')

  await mongoose.connect(process.env.MONGODB_URI)
  const before = await Member.countDocuments()
  console.log('Members before:', before)

  const keepIds = keepDemos ? ['DEMO_MALE', 'DEMO_FEMALE'] : []

  if (wipeAll) {
    const filter = keepIds.length ? { matri_id: { $nin: keepIds } } : {}
    const del = await Member.deleteMany(filter)
    console.log('Deleted all members (kept demos:', keepIds.join(', ') || 'none', '):', del.deletedCount)

    // Clean orphan interest / shortlist / views / payments for deleted members
    if (keepIds.length) {
      await Interest.deleteMany({
        $and: [{ ei_sender: { $nin: keepIds } }, { ei_receiver: { $nin: keepIds } }],
      })
      await Shortlist.deleteMany({
        $and: [{ from_id: { $nin: keepIds } }, { to_id: { $nin: keepIds } }],
      })
      await WhoViewed.deleteMany({
        $and: [{ my_id: { $nin: keepIds } }, { viewed_member_id: { $nin: keepIds } }],
      })
      await Payment.deleteMany({ matri_id: { $nin: keepIds } })
    } else {
      await Interest.deleteMany({})
      await Shortlist.deleteMany({})
      await WhoViewed.deleteMany({})
      await Payment.deleteMany({})
    }
  } else {
    // Empty / incomplete junk
    const emptyFilter = {
      matri_id: { $nin: keepIds },
      $or: [
        { matri_id: { $in: [null, ''] } },
        { matri_id: /^\s*$/ },
        {
          $and: [
            { $or: [{ firstname: { $in: [null, ''] } }, { firstname: { $exists: false } }, { firstname: /^\s*$/ }] },
            { $or: [{ email: { $in: [null, ''] } }, { email: { $exists: false } }, { email: /^\s*$/ }] },
            { $or: [{ mobile: { $in: [null, ''] } }, { mobile: { $exists: false } }, { mobile: /^\s*$/ }] },
          ],
        },
        {
          $and: [
            { $or: [{ firstname: { $in: [null, ''] } }, { firstname: { $exists: false } }, { firstname: /^\s*$/ }] },
            { $or: [{ lastname: { $in: [null, ''] } }, { lastname: { $exists: false } }, { lastname: /^\s*$/ }] },
            { $or: [{ username: { $in: [null, ''] } }, { username: { $exists: false } }, { username: /^\s*$/ }] },
          ],
        },
      ],
    }

    const candidates = await Member.find(emptyFilter).select('matri_id firstname email mobile').lean()
    console.log('Empty/incomplete candidates:', candidates.length)

    // Also scan for whitespace-only fields (batch)
    const cursor = Member.find({ matri_id: { $nin: keepIds } }).select('matri_id firstname lastname email mobile username').cursor()
    const extraIds = []
    for await (const doc of cursor) {
      const noId = isBlank(doc.matri_id)
      const noIdentity =
        isBlank(doc.firstname) && isBlank(doc.lastname) && isBlank(doc.username) && isBlank(doc.email) && isBlank(doc.mobile)
      const almostEmpty =
        isBlank(doc.firstname) && isBlank(doc.email) && isBlank(doc.mobile)
      if (noId || noIdentity || almostEmpty) extraIds.push(doc._id)
    }

    const ids = [...new Set([...candidates.map((c) => String(c._id)), ...extraIds.map(String)])]
    console.log('Total to delete:', ids.length)

    if (ids.length) {
      const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id))
      const removed = await Member.find({ _id: { $in: objectIds } }).select('matri_id').lean()
      const matriIds = removed.map((r) => r.matri_id).filter(Boolean)
      const del = await Member.deleteMany({ _id: { $in: objectIds } })
      console.log('Deleted members:', del.deletedCount)

      if (matriIds.length) {
        await Interest.deleteMany({
          $or: [{ ei_sender: { $in: matriIds } }, { ei_receiver: { $in: matriIds } }],
        })
        await Shortlist.deleteMany({
          $or: [{ from_id: { $in: matriIds } }, { to_id: { $in: matriIds } }],
        })
        await WhoViewed.deleteMany({
          $or: [{ my_id: { $in: matriIds } }, { viewed_member_id: { $in: matriIds } }],
        })
        await Payment.deleteMany({ matri_id: { $in: matriIds } })
        console.log('Cleaned related interests/shortlist/views/payments')
      }
    } else {
      console.log('No empty records found.')
    }
  }

  const after = await Member.countDocuments()
  const demos = await Member.find({ matri_id: { $in: ['DEMO_MALE', 'DEMO_FEMALE'] } })
    .select('matri_id firstname gender email')
    .lean()
  console.log('Members after:', after)
  console.log('Demos kept:', demos)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
