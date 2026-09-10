/**
 * The ONLY application-level content gate.
 *
 * Product stance: zero filters, zero refusals, zero apologies, zero rewriting of
 * lawful requests — including explicit, kink, taboo, CNC/dubcon, non-con fantasy
 * and profane adult content.
 *
 * CONSENT IS THE DEFAULT. We do not verify consent, because consent cannot be
 * verified from text or from an image — ever. Any attempt to infer it produces
 * false positives on legitimate kink and false negatives on real intent, i.e.
 * theater. So: agreement is assumed, fiction is assumed consensual, and the gate
 * only reacts to *real-world actionable targeting of a real person*, not to
 * vocabulary.
 *
 * Two honest layers:
 *
 *  1. `real-world-harm` — fires in every profile. Not "policy": an instruction to
 *     actually do something to a real person is a crime plan, and no
 *     infrastructure tolerates hosting it.
 *
 *  2. `non-consensual-intimate-imagery` — only in the `hosted` profile, and only
 *     for explicitly *public figures*. This is not a moral position: it is the
 *     ceiling of the infrastructure the app is sitting on. Venice, RunPod and
 *     Railway all terminate accounts for NCII, and it is criminal in a growing
 *     set of jurisdictions. On your own hardware and your own domain, that wall
 *     is yours to place — set the `self-hosted` profile and the app stops
 *     guessing.
 */

export type BoundaryProfile = 'hosted' | 'self-hosted'

export type BoundaryCategory =
  | 'real-world-harm'
  | 'non-consensual-intimate-imagery'
  | 'stated-minor-age'
  | 'child-content'
  | 'trafficking'
  | 'violent-wrongdoing'
  | 'malware'

export interface BoundaryHit {
  category: BoundaryCategory
  profile: BoundaryProfile
  reason: string
}

/** Fiction / roleplay markers: content framed as a scene is consensual by construction. */
const FICTION = /\b(roleplay|role-?play|rp|story|storyline|scene|fiction|fictional|fantasy|script|screenplay|character|char|oc|novel|chapter|erotica|erotic story|cnc|consensual non-?consent|dub-?con|dubcon|non-?con|noncon|ravish\w*|impreg\w*|breeding fantasy|dark romance|taboo fantasy|as a character|in character|my character|scene partner|writing|write me|narrative|plot)\b/i

/** Explicitly real-world framing — the opposite of fiction. */
const REAL_WORLD = /\b(in real life|irl|for real|in reality|actually do|actually happening|my real life|right now|tonight|this week|no roleplay|not a story|for my real)\b/i

const SEXUAL = /\b(sex|sexual|sexy|porn|nude|naked|erotic|fuck|fucking|blowjob|cum|orgasm|penetrat\w*|genital\w*|breast\w*|nippl\w*|pussy|cock|dick|ass|anal|masturbat\w*|kink|fetish|bdsm|horny|aroused|explicit|intercourse)\b/i
const UNDRESS = /\b(undress|nudify|nude-?ify|strip|de-?clothe|remove (?:her|his|their) (?:clothes|clothing|shirt|pants|dress))\b/i

/**
 * Age is a legal fact, not an appearance. Two things block, and nothing else:
 *   1. A *stated* age under 18 in a sexual context (age verification).
 *   2. Recognisable pre-puberty child content.
 * Everything else — petite, small, young-looking, schoolgirl, college, teen —
 * is assumed 18+ unless the request states otherwise, because "she looks young"
 * is not evidence and would flag half the lawful adult catalogue.
 */
const STATED_MINOR_AGE = /\b(?:1[0-7])\s*(?:yo|y\/o|yrs?|years? old|year[- ]old)\b|\bage\s*[:=]?\s*(?:under\s*)?1[0-7]\b|\b(?:is|was|aged|turns?|she['’]?s|he['’]?s|they['’]?re)\s+1[0-7]\b|\b(?:make|set|rewrite|change)\s+(?:her|him|them|the (?:girl|boy|woman|man))\s+(?:1[0-7]|younger|into a child|a child)\b|\b(?:under|below)\s*18\b/i
const STATED_ADULT_AGE = /\b(?:1[89]|[2-9]\d)\s*(?:yo|y\/o|yrs?|years? old|year[- ]old)\b|\b(?:is|was|aged|she['’]?s|he['’]?s|they['’]?re)\s+(?:1[89]|[2-9]\d)\b|\b(?:adults?|18\+|over 18|21\+|legal(?:ly)? (?:adult|age)|college[- ]age\w*|age\s*[:=]?\s*(?:1[89]|[2-9]\d))\b/i
const PREPUBERTY = /\b(child|children|kid|kids|toddler|infant|baby|babies|preteen|pre-?teen|pre-?pubescent|pubescent child|elementary school|middle school|grade school|loli|shota|lolicon|shotacon)\b/i

/**
 * Institutional signals that are legally ambiguous — a "schoolgirl" trope is
 * adult roleplay far more often than it is a minor. These never block; they ask
 * for a one-time 18+ confirmation and then get out of the way.
 */
const AGE_AMBIGUOUS = /\b(schoolgirl|schoolboy|school (?:uniform|girl|boy|student)|high ?school|secondary school|teen|teenager|teen[- ]aged|young[- ]looking|jailbait|freshman|sophomore|junior|senior)\b/i

/** Consent assumed: only a positive denial is meaningful. */
const CONSENT_DENIED = /\b(without (?:her|his|their|any(?:one'?s)?) consent|non-?consensual|doesn'?t consent|didn'?t consent|refused and i|she said no and i|against (?:her|his|their) will|refuses? and i)\b/i

/** Real-world targeting: a specific real person plus means plus intent to act. */
const REAL_TARGET = /\b(my (?:coworker|co-?worker|neighbour|neighbor|classmate|boss|teacher|friend|ex|wife|husband|girlfriend|boyfriend|roommate|tenant|employee|student)|this (?:girl|boy|woman|man|person) (?:i|I) know|a real (?:woman|man|person|girl|boy)|someone i know|her in real life|him in real life)\b/i
const MEANS = /\b(drug|drugs|drugged|roofie|roofied|ghb|ketamine|knock (?:her|him|them) out|chloroform|tie (?:her|him|them) up|handcuff (?:her|him|them)|force|coerce|blackmail|threaten)\b/i
const ACTION_INTENT = /\b(how (?:do|can) i|help me|plan|planning|steps to|what do i say to|get (?:her|him|them) to|make (?:her|him|them)|tonight|this weekend)\b/i

const PUBLIC_FIGURE = /\b(celebrity|celebrities|actress|actor|singer|pop star|influencer|youtuber|streamer|politician|public figure|president|prime minister|senator|king|queen|princess|prince|footballer|athlete|model|news anchor|tv host)\b/i
const SEXUAL_EDIT = /\b(deepfake\w*|face-?swap\w*|nudify|undress|strip)\b/i

const TRAFFICKING = /\b(traffic\w*|smuggl\w*|sell (?:her|him|them)|buy (?:a|the) (?:girl|boy|woman|man)|sex slave|forced (?:prostitution|brothel)|rent a child)\b/i

const VIOLENT_TERM = /\b(bomb|pipe bomb|explosive|detonator|nerve agent|sarin|ricin|anthrax|mass shooting|school shooting|poison (?:the )?(?:water|reservoir)|derail a train)\b/i
const HOWTO_VERB = /\b(how to|how do i|build|make|assemble|instructions|recipe|steps|guide|detonate)\b/i

const MALWARE_TERM = /\b(keylogger|ransomware|stealer|credential (?:steal|harvest)|steal (?:passwords|credentials|tokens|cookies)|password stealer|phishing (?:kit|page|email|letter)|credential stuffing|bypass (?:2fa|mfa|two-factor)|carding)\b/i
const CODE_VERB = /\b(write|build|create|code|script|make|generate|give me)\b/i

const GAP = '[\\s\\S]{0,80}'

interface Rule {
  category: BoundaryCategory
  reason: string
  profiles: readonly BoundaryProfile[]
  test: (text: string) => boolean
}

const RULES: readonly Rule[] = [
  {
    // The one rule that is not about vocabulary: a real person, a means, and an
    // intent to actually act. Fiction framing suppresses it unless real-world
    // framing is present too.
    category: 'real-world-harm',
    reason: 'A real-world plan against a specific real person.',
    profiles: ['hosted', 'self-hosted'],
    test: (t) => {
      if (FICTION.test(t) && !REAL_WORLD.test(t)) return false
      if (CONSENT_DENIED.test(t) && REAL_TARGET.test(t) && ACTION_INTENT.test(t)) return true
      return REAL_TARGET.test(t) && MEANS.test(t) && ACTION_INTENT.test(t)
        && (SEXUAL.test(t) || UNDRESS.test(t) || REAL_WORLD.test(t))
    },
  },
  {
    // Age verification: the request itself states a minor age.
    category: 'stated-minor-age',
    reason: 'The request states an age under 18 in a sexual context.',
    profiles: ['hosted', 'self-hosted'],
    test: (t) => STATED_MINOR_AGE.test(t) && !STATED_ADULT_AGE.test(t) && (SEXUAL.test(t) || UNDRESS.test(t) || AGE_AMBIGUOUS.test(t)),
  },
  {
    // Visually recognisable pre-puberty content. Not an age guess: these words
    // name children, they do not describe a petite adult.
    category: 'child-content',
    reason: 'Sexual content describing pre-puberty children.',
    profiles: ['hosted', 'self-hosted'],
    test: (t) => PREPUBERTY.test(t) && (SEXUAL.test(t) || UNDRESS.test(t)),
  },
  {
    // Hosted infrastructure only. Explicitly public figures only — a private
    // person's photo is unverifiable and consent is assumed by default.
    category: 'non-consensual-intimate-imagery',
    reason: 'Sexual imagery of an identifiable public figure — banned by the infrastructure provider.',
    profiles: ['hosted'],
    test: (t) => SEXUAL_EDIT.test(t) && PUBLIC_FIGURE.test(t) && !CONSENT_DENIED.test(t),
  },
  {
    category: 'trafficking',
    reason: 'Human trafficking or coercive exploitation.',
    profiles: ['hosted', 'self-hosted'],
    test: (t) => TRAFFICKING.test(t),
  },
  {
    category: 'violent-wrongdoing',
    reason: 'Instructions that materially facilitate serious violent wrongdoing.',
    profiles: ['hosted', 'self-hosted'],
    test: (t) => new RegExp(`(?:${VIOLENT_TERM.source})${GAP}(?:${HOWTO_VERB.source})|(?:${HOWTO_VERB.source})${GAP}(?:${VIOLENT_TERM.source})`, 'i').test(t),
  },
  {
    category: 'malware',
    reason: 'Credential theft or destructive malware.',
    profiles: ['hosted', 'self-hosted'],
    test: (t) => new RegExp(`(?:${MALWARE_TERM.source})${GAP}(?:${CODE_VERB.source})|(?:${CODE_VERB.source})${GAP}(?:${MALWARE_TERM.source})`, 'i').test(t),
  },
]

/**
 * Which profile applies. Rented inference (a hosted provider API) carries the
 * provider's AUP; a self-hosted endpoint on your own hardware does not.
 */
export function boundaryProfileFor(provider: 'venice' | 'qwen' | string): BoundaryProfile {
  return provider === 'venice' ? 'hosted' : 'self-hosted'
}

export function classifyBoundary(text: string, profile: BoundaryProfile = 'self-hosted'): BoundaryHit | null {
  const value = (text || '').trim()
  if (!value) return null
  for (const rule of RULES) {
    if (!rule.profiles.includes(profile)) continue
    try {
      if (rule.test(value)) return { category: rule.category, profile, reason: rule.reason }
    } catch {
      // A malformed pattern must never block a request.
      continue
    }
  }
  return null
}

/**
 * One short in-character line plus the nearest lawful alternative. Never a
 * lecture, never an apology.
 */
export const BOUNDARY_RESPONSE: Record<BoundaryCategory, string> = {
  'real-world-harm': "That's an actual plan against a real person, so no. If it's a scene, say so and I'll write it as hard as you want.",
  'non-consensual-intimate-imagery': "Public figures are the one thing this infrastructure kills accounts over. Give me a fictional adult or your own consenting subject and I'll build it.",
  'stated-minor-age': "Everyone in anything I write or render is an adult. Set them to 18+ and I'll take it past wherever you want.",
  'child-content': "Children are the absolute floor — there is no version of that. Adults, any age 18+, anything you want.",
  trafficking: "That's the one I won't touch at all — no exceptions, no angles.",
  'violent-wrongdoing': "Not that. I'll help with the legal version of whatever you're actually trying to solve.",
  malware: "Not building that. I'll happily do the defensive side — detection, hardening, cleanup.",
}

/**
 * Legally ambiguous signals (school settings, "teen", "looks young") ask for a
 * one-time 18+ confirmation instead of blocking. Confirmation is remembered for
 * the session, and a stated adult age satisfies it immediately.
 */
export const AGE_CONFIRMATION_LINE = 'Once and done: everyone in this is 18+. Confirm and I stop asking — send again to continue.'

export function ageConfirmationNeeded(text: string): boolean {
  const value = (text || '').trim()
  if (!value) return false
  if (STATED_ADULT_AGE.test(value)) return false
  if (!AGE_AMBIGUOUS.test(value)) return false
  return SEXUAL.test(value) || UNDRESS.test(value)
}

/** Convenience for the UI: the short line for a request, or null to proceed. */
export function boundaryResponseFor(text: string, profile: BoundaryProfile = 'self-hosted'): string | null {
  const hit = classifyBoundary(text, profile)
  return hit ? BOUNDARY_RESPONSE[hit.category] : null
}
