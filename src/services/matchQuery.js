/** Build Mongo filters for member search / preference matching */

export function oppositeGender(g) {
  if (!g) return 'Female'
  return String(g).toLowerCase().startsWith('f') ? 'Male' : 'Female'
}

/** Parse "5ft 9in" / "5'9\"" / "Below 4ft" → inches (or null). */
export function heightToInches(str) {
  const s = String(str || '').trim().toLowerCase()
  if (!s) return null
  if (s.includes('below')) return 47
  const m =
    s.match(/(\d+)\s*(?:ft|')\s*(\d+)\s*(?:in|")?/) ||
    s.match(/(\d+)\s*(?:ft|')/) ||
    s.match(/(\d+)\s*(?:in|")/)
  if (!m) return null
  if (/in|"/.test(s) && !/ft|'/.test(s)) return Number(m[1])
  return Number(m[1]) * 12 + Number(m[2] || 0)
}

/** Mongo $expr snippet: coerce age (string or number) to double. */
function ageNumberExpr(field = '$age') {
  return {
    $convert: {
      input: { $ifNull: [field, 0] },
      to: 'double',
      onError: 0,
      onNull: 0,
    },
  }
}

/** Mongo $expr: parse height string like "5ft 9in" / "5'9\"" to inches. */
function heightInchesExpr(field = '$height') {
  return {
    $let: {
      vars: {
        m: {
          $regexFind: {
            input: { $toString: { $ifNull: [field, ''] } },
            regex: "(\\d+)\\s*(?:ft|')\\s*(\\d+)\\s*(?:in|\")?",
            options: 'i',
          },
        },
      },
      in: {
        $cond: [
          { $ne: ['$$m', null] },
          {
            $add: [
              {
                $multiply: [{ $toInt: { $arrayElemAt: ['$$m.captures', 0] } }, 12],
              },
              {
                $toInt: {
                  $ifNull: [{ $arrayElemAt: ['$$m.captures', 1] }, '0'],
                },
              },
            ],
          },
          0,
        ],
      },
    },
  }
}

/** Values that mean "no preference" — do not hard-filter. */
function isOpenPreference(value) {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return true
  return /^(any|all|n\/?a|na|none|doesn'?t\s*matter|no\s*preference|open|-)$/i.test(s)
}

/** Split multi-value prefs and drop open/any tokens. */
function meaningfulParts(value) {
  return String(value || '')
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter((s) => s && !isOpenPreference(s))
}

/** Broaden education labels so "Graduate" matches B Tech / MBA / etc. */
function educationMatchers(label) {
  const s = String(label || '').trim()
  if (!s) return []
  const lower = s.toLowerCase()
  if (lower === 'graduate' || lower === 'graduates') {
    return [
      'graduate',
      'b\\.?\\s*tech',
      'b\\.?e\\b',
      'b\\.?sc',
      'b\\.?com',
      'b\\.?a\\b',
      'mba',
      'm\\.?tech',
      'm\\.?sc',
      'm\\.?com',
      'm\\.?a\\b',
      'engineer',
      'bachelor',
      'masters?',
      'post\\s*grad',
      'phd',
      'doctorate',
    ]
  }
  if (lower === 'undergraduate' || lower === 'ug') {
    return ['undergrad', 'diploma', '12th', 'hsc', 'higher\\s*secondary']
  }
  return [escape(s)]
}

function rx(pattern, flags = 'i') {
  return { $regex: String(pattern), $options: flags }
}

export function applyAdvancedFilters(filter, query = {}) {
  const q = query
  // Soft contains matches — member fields often differ slightly from master labels
  if (q.religion) {
    const pat = `^\\s*${escape(q.religion)}\\s*$`
    filter.$and = filter.$and || []
    filter.$and.push({
      $or: [{ religion: rx(pat) }, { religion_name: rx(pat) }],
    })
  }
  if (q.caste) filter.caste = rx(escape(q.caste))
  if (q.subcaste) filter.subcaste = rx(escape(q.subcaste))
  if (q.m_status) filter.m_status = rx(escape(q.m_status))
  if (q.country) filter.country_id = rx(escape(q.country))
  if (q.state) filter.state_id = rx(escape(q.state))
  if (q.city) filter.city = rx(escape(q.city))
  if (q.occupation) {
    filter.$and = filter.$and || []
    filter.$and.push({
      $or: [{ occupation: rx(escape(q.occupation)) }, { emp_in: rx(escape(q.occupation)) }],
    })
  }
  if (q.education) {
    const patterns = educationMatchers(q.education)
    filter.$and = filter.$and || []
    filter.$and.push({
      $or: patterns.map((p) => ({ edu_detail: rx(p) })),
    })
  }
  if (q.m_tongue) filter.m_tongue = rx(escape(q.m_tongue))
  if (q.diet) filter.diet = rx(escape(q.diet))
  if (q.manglik) filter.manglik = rx(escape(q.manglik))
  if (q.complexion) filter.complexion = rx(escape(q.complexion))
  if (q.bodytype) filter.bodytype = rx(escape(q.bodytype))
  if (q.physicalStatus) filter.physicalStatus = rx(escape(q.physicalStatus))
  if (q.smoke) filter.smoke = rx(escape(q.smoke))
  if (q.drink) filter.drink = rx(escape(q.drink))
  if (q.income) filter.income = rx(escape(q.income))
  if (q.star) filter.star = rx(escape(q.star))

  filter.$and = filter.$and || []

  // Prefer numeric inches from master meta (height_from_in) when provided
  const fromIn =
    q.height_from_in != null && q.height_from_in !== ''
      ? Number(q.height_from_in)
      : q.height_from
        ? heightToInches(q.height_from) ?? (Number.isFinite(Number(q.height_from)) ? Number(q.height_from) : null)
        : null
  const toIn =
    q.height_to_in != null && q.height_to_in !== ''
      ? Number(q.height_to_in)
      : q.height_to
        ? heightToInches(q.height_to) ?? (Number.isFinite(Number(q.height_to)) ? Number(q.height_to) : null)
        : null
  if ((fromIn != null && !Number.isNaN(fromIn)) || (toIn != null && !Number.isNaN(toIn))) {
    const parts = []
    if (fromIn != null && !Number.isNaN(fromIn)) parts.push({ $gte: [heightInchesExpr('$height'), fromIn] })
    if (toIn != null && !Number.isNaN(toIn)) parts.push({ $lte: [heightInchesExpr('$height'), toIn] })
    filter.$and.push({ $expr: parts.length === 1 ? parts[0] : { $and: parts } })
  }

  if (q.age_from || q.age_to) {
    const parts = []
    if (q.age_from) parts.push({ $gte: [ageNumberExpr('$age'), Number(q.age_from)] })
    if (q.age_to) parts.push({ $lte: [ageNumberExpr('$age'), Number(q.age_to)] })
    filter.$and.push({ $expr: parts.length === 1 ? parts[0] : { $and: parts } })
  }

  if (q.q) {
    const term = escape(String(q.q).trim())
    filter.$and.push({
      $or: [
        { matri_id: rx(term) },
        { firstname: rx(term) },
        { lastname: rx(term) },
        { username: rx(term) },
        { email: rx(term) },
      ],
    })
  }

  if (!filter.$and.length) delete filter.$and
  return filter
}

export function preferenceFilter(me) {
  const filter = {}
  const and = []

  const religionParts = meaningfulParts(me.part_religion)
  if (religionParts.length) {
    and.push({
      $or: religionParts.map((p) => ({ religion: rx(`^\\s*${escape(p)}\\s*$`) })),
    })
  }
  const casteParts = meaningfulParts(me.part_caste)
  if (casteParts.length) {
    and.push({ $or: casteParts.map((p) => ({ caste: rx(escape(p)) })) })
  }
  const tongueParts = meaningfulParts(me.part_mtongue)
  if (tongueParts.length) {
    and.push({ $or: tongueParts.map((p) => ({ m_tongue: rx(escape(p)) })) })
  }
  const countryParts = meaningfulParts(me.part_country_living)
  if (countryParts.length) {
    and.push({ $or: countryParts.map((p) => ({ country_id: rx(escape(p)) })) })
  }
  const eduParts = meaningfulParts(me.part_edu)
  if (eduParts.length) {
    const patterns = eduParts.flatMap(educationMatchers)
    if (patterns.length) {
      and.push({ $or: patterns.map((p) => ({ edu_detail: rx(p) })) })
    }
  }
  const occuParts = meaningfulParts(me.part_occu)
  if (occuParts.length) {
    and.push({ $or: occuParts.map((p) => ({ occupation: rx(escape(p)) })) })
  }
  if (me.part_frm_age || me.part_to_age) {
    const parts = []
    if (me.part_frm_age) parts.push({ $gte: [ageNumberExpr('$age'), Number(me.part_frm_age)] })
    if (me.part_to_age) parts.push({ $lte: [ageNumberExpr('$age'), Number(me.part_to_age)] })
    and.push({ $expr: parts.length === 1 ? parts[0] : { $and: parts } })
  }
  const fromH = me.part_height ? heightToInches(me.part_height) : null
  const toH = me.part_height_to ? heightToInches(me.part_height_to) : null
  if (fromH != null || toH != null) {
    const parts = []
    if (fromH != null) parts.push({ $gte: [heightInchesExpr('$height'), fromH] })
    if (toH != null) parts.push({ $lte: [heightInchesExpr('$height'), toH] })
    and.push({ $expr: parts.length === 1 ? parts[0] : { $and: parts } })
  }
  const lookingParts = meaningfulParts(me.looking_for)
  if (lookingParts.length) {
    and.push({ $or: lookingParts.map((p) => ({ m_status: rx(escape(p)) })) })
  }

  if (and.length) filter.$and = and
  return filter
}

function escape(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const MATCH_SELECT =
  'index_id matri_id username firstname lastname gender birthdate age height religion caste subcaste photo1 photo1_approve photo_protect status fstatus city state_id country_id m_status occupation edu_detail last_login profile_text emp_in income diet manglik m_tongue part_expect'
