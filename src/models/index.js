import mongoose from 'mongoose'

/** Flexible schemas so all legacy PHP/MySQL columns are preserved */

const adminUserSchema = new mongoose.Schema(
  {
    id: Number,
    uname: { type: String, required: true, unique: true },
    pswd: { type: String, required: true },
    role_id: { type: Number, default: 1 },
    email: String,
    status: { type: String, default: '1' },
  },
  { timestamps: true, strict: false },
)

const memberSchema = new mongoose.Schema(
  {
    index_id: { type: Number, index: true },
    matri_id: { type: String, required: true, unique: true, index: true },
    email: { type: String, index: true },
    mobile: { type: String, index: true },
    password: String,
    username: String,
    firstname: String,
    lastname: String,
    gender: String,
    status: { type: String, default: 'Active', index: true },
    fstatus: String,
    logged_in: String,
    last_login: Date,
    reg_date: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: false },
)

const planSchema = new mongoose.Schema(
  {
    plan_id: { type: Number, unique: true },
    plan_name: String,
    plan_type: String,
    plan_amount: Number,
    plan_amount_type: { type: String, default: 'Rs.' },
    plan_duration: Number,
    plan_contacts: Number,
    profile: Number,
    plan_msg: Number,
    plan_sms: Number,
    video: String,
    chat: String,
    plan_offers: String,
    status: { type: String, default: 'APPROVED' },
  },
  { strict: false },
)

const interestSchema = new mongoose.Schema(
  {
    ei_id: { type: Number, index: true },
    ei_sender: { type: String, index: true },
    ei_receiver: { type: String, index: true },
    receiver_response: { type: String, default: 'Pending' },
    ei_message: String,
    ei_sent_date: { type: Date, default: Date.now },
    status: { type: String, default: 'APPROVED' },
    trash_receiver: { type: String, default: 'No' },
    trash_sender: { type: String, default: 'No' },
  },
  { strict: false },
)

const shortlistSchema = new mongoose.Schema(
  {
    sh_id: Number,
    from_id: { type: String, index: true },
    to_id: String,
    add_date: { type: Date, default: Date.now },
  },
  { strict: false },
)

const siteConfigSchema = new mongoose.Schema({}, { strict: false })

const masterSchema = new mongoose.Schema(
  {
    type: { type: String, index: true },
    legacy_id: Number,
    name: String,
    status: { type: String, default: 'APPROVED' },
    meta: mongoose.Schema.Types.Mixed,
  },
  { strict: false },
)

const cmsPageSchema = new mongoose.Schema(
  {
    cms_id: Number,
    page_name: String,
    cms_title: String,
    cms_content: String,
    status: { type: String, default: 'APPROVED' },
  },
  { strict: false },
)

const successStorySchema = new mongoose.Schema(
  {
    story_id: Number,
    weddingphoto: String,
    weddingphoto_type: String,
    bridename: String,
    brideid: String,
    groomname: String,
    groomid: String,
    marriagedate: String,
    engagement_date: String,
    address: String,
    country: String,
    successmessage: String,
    status: { type: String, default: 'APPROVED' },
    fstatus: String,
  },
  { strict: false },
)

const serviceSchema = new mongoose.Schema(
  {
    service_id: Number,
    title: String,
    text: String,
    image: String,
    sort_order: { type: Number, default: 0 },
    status: { type: String, default: 'APPROVED' },
  },
  { strict: false },
)

const advertisementSchema = new mongoose.Schema(
  {
    adv_id: Number,
    adv_date: String,
    adv_name: String,
    adv_link: String,
    adv_level: String,
    adv_img: String,
    contact_name: String,
    phone: String,
    status: { type: String, default: 'APPROVED' },
  },
  { strict: false },
)

const paymentSchema = new mongoose.Schema({}, { strict: false })
const messageSchema = new mongoose.Schema({}, { strict: false })
const firstFormSchema = new mongoose.Schema(
  {
    id: Number,
    gender: String,
    first_name: String,
    last_name: String,
    dob: String,
    mobile_no: String,
    email_id: String,
    address: String,
  },
  { strict: false, timestamps: true },
)

const whoViewedSchema = new mongoose.Schema(
  {
    who_id: Number,
    my_id: String,
    viewed_member_id: String,
    viewed_date: Date,
  },
  { strict: false },
)

const contactViewSchema = new mongoose.Schema(
  {
    cv_id: { type: Number, index: true },
    viewer_id: { type: String, index: true },
    viewed_id: { type: String, index: true },
    viewed_date: { type: Date, default: Date.now },
  },
  { strict: false },
)

const renewalRequestSchema = new mongoose.Schema(
  {
    rr_id: { type: Number, index: true },
    matri_id: { type: String, index: true },
    plan_id: Number,
    plan_name: String,
    note: String,
    status: { type: String, default: 'Pending' }, // Pending | Approved | Rejected
    created_at: { type: Date, default: Date.now },
    decided_at: Date,
    decided_by: String,
  },
  { strict: false },
)

const paymentMethodSchema = new mongoose.Schema({}, { strict: false })
const fieldSettingsSchema = new mongoose.Schema({}, { strict: false })
const emailSettingSchema = new mongoose.Schema({}, { strict: false })
const emailTemplateSchema = new mongoose.Schema({}, { strict: false })

export const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema)
export const Member = mongoose.models.Member || mongoose.model('Member', memberSchema)
export const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema)
export const Interest = mongoose.models.Interest || mongoose.model('Interest', interestSchema)
export const Shortlist = mongoose.models.Shortlist || mongoose.model('Shortlist', shortlistSchema)
export const SiteConfig = mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema)
export const Master = mongoose.models.Master || mongoose.model('Master', masterSchema)
export const CmsPage = mongoose.models.CmsPage || mongoose.model('CmsPage', cmsPageSchema)
export const SuccessStory = mongoose.models.SuccessStory || mongoose.model('SuccessStory', successStorySchema)
export const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema)
export const Advertisement = mongoose.models.Advertisement || mongoose.model('Advertisement', advertisementSchema)
export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema)
export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema)
export const FirstForm = mongoose.models.FirstForm || mongoose.model('FirstForm', firstFormSchema)
export const WhoViewed = mongoose.models.WhoViewed || mongoose.model('WhoViewed', whoViewedSchema)
export const ContactView = mongoose.models.ContactView || mongoose.model('ContactView', contactViewSchema)
export const RenewalRequest =
  mongoose.models.RenewalRequest || mongoose.model('RenewalRequest', renewalRequestSchema)
export const PaymentMethod = mongoose.models.PaymentMethod || mongoose.model('PaymentMethod', paymentMethodSchema)
export const FieldSettings = mongoose.models.FieldSettings || mongoose.model('FieldSettings', fieldSettingsSchema)
export const EmailSetting = mongoose.models.EmailSetting || mongoose.model('EmailSetting', emailSettingSchema)
export const EmailTemplate = mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', emailTemplateSchema)

export function lean(doc) {
  if (!doc) return null
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
  delete obj.__v
  if (obj._id) obj._id = String(obj._id)
  return obj
}
