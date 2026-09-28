import { Router } from 'express'
import { Member, AdminUser, Plan, SiteConfig, Interest, Payment, CmsPage, SuccessStory, Master } from '../models/index.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()
router.use(requireAdmin)

router.get('/backup', async (_req, res) => {
  try {
    const [members, admins, plans, config, interests, payments, cms, stories, master] = await Promise.all([
      Member.find().select('-password -cpassword').lean(),
      AdminUser.find().select('-pswd').lean(),
      Plan.find().lean(),
      SiteConfig.find().lean(),
      Interest.find().lean(),
      Payment.find().lean(),
      CmsPage.find().lean(),
      SuccessStory.find().lean(),
      Master.find().lean(),
    ])
    const payload = {
      exportedAt: new Date().toISOString(),
      counts: {
        members: members.length,
        admins: admins.length,
        plans: plans.length,
        interests: interests.length,
        payments: payments.length,
        cms: cms.length,
        stories: stories.length,
        master: master.length,
      },
      members,
      admins,
      plans,
      config,
      interests,
      payments,
      cms,
      stories,
      master,
    }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="matrimony-backup-${Date.now()}.json"`)
    res.send(JSON.stringify(payload, null, 2))
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Backup failed' })
  }
})

export default router
