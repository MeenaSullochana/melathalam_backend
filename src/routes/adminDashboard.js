import { Router } from 'express'
import { Member, Advertisement, Plan, Interest, SuccessStory } from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAdmin)

router.get('/stats', async (_req, res) => {
  try {
    const [
      allMembers,
      activeMembers,
      paidMembers,
      featuredMembers,
      ads,
      plans,
      interests,
      stories,
      pendingPhotos,
      pendingAbout,
      pendingAadhaar,
      pendingHoroscope,
      latest,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: 'Active' }),
      Member.countDocuments({ status: 'Paid' }),
      Member.countDocuments({ fstatus: 'Featured' }),
      Advertisement.countDocuments(),
      Plan.countDocuments(),
      Interest.countDocuments(),
      SuccessStory.countDocuments(),
      Member.countDocuments({
        $or: [
          { photo1_approve: 'UNAPPROVED' },
          { photo2_approve: 'UNAPPROVED' },
          { photo3_approve: 'UNAPPROVED' },
          { photo4_approve: 'UNAPPROVED' },
          { photo5_approve: 'UNAPPROVED' },
          { photo6_approve: 'UNAPPROVED' },
        ],
      }),
      Member.countDocuments({
        profile_text: { $exists: true, $nin: [null, ''] },
        profile_text_approve: { $nin: ['Approve', 'APPROVED'] },
      }),
      Member.countDocuments({
        aadhaar_card: { $exists: true, $nin: [null, ''] },
        aadhaar_card_status: { $in: ['UNAPPROVED', 'PENDING', null] },
      }),
      Member.countDocuments({
        hor_photo: { $exists: true, $nin: [null, ''] },
        hor_check: { $in: ['UNAPPROVED', null] },
      }),
      Member.find()
        .sort({ index_id: -1 })
        .limit(12)
        .select('index_id matri_id username firstname lastname gender email mobile status fstatus photo1 reg_date last_login')
        .lean(),
    ])

    res.json({
      success: true,
      stats: {
        allMembers,
        activeMembers,
        paidMembers,
        featuredMembers,
        ads,
        plans,
        interests,
        stories,
        pendingPhotos,
        pendingAbout,
        pendingAadhaar,
        pendingHoroscope,
      },
      latest,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Failed to load dashboard' })
  }
})

export default router
