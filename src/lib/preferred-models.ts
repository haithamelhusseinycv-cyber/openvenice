/**
 * Capability-first model preferences.
 *
 * Discovery stays authoritative: this file only expresses *preference order*.
 * Whatever a provider actually advertises is ranked against these lists, so a
 * new or renamed model appears without a release and a retired id never breaks a
 * picker.
 *
 * Two rules encoded here:
 *   1. Uncensored / least-aligned models win for every expressive capability.
 *   2. Nothing is hardcoded that the endpoint must serve — patterns cover hosts
 *      whose catalogue is host-specific (FaceFusion swappers, Local Dream).
 */

export type CapabilityId =
  | 'chat'
  | 'prompt'
  | 'agent'
  | 'image'
  | 'edit'
  | 'video'
  | 'faceswap'
  | 'headswap'
  | 'bodyswap'
  | 'tts'

export interface ModelPreference {
  /** Exact provider model id. */
  id?: string
  /** Fallback match for host-specific catalogues. */
  pattern?: RegExp
  uncensored?: boolean
  /** Streams fast and stays cheap: preferred when the surface is a phone. */
  mobile?: boolean
  /**
   * Hardcoded findings from measured behaviour (see FREEDOM_FINDINGS below).
   * `verified-high` = physically observed rendering explicit adult content
   * without refusal or rewrite. `assumed-high` = abliterated / uncensored
   * lineage, not yet measured on this deployment.
   */
  freedom?: 'verified-high' | 'assumed-high' | 'standard'
  note?: string
}

/**
 * FREEDOM FINDINGS — hardcoded from working sessions, not marketing.
 *
 * These are the load-bearing observations this build encodes:
 *
 * 1. The Venice `uncensored` family and the GLM `heretic` lineage render and
 *    write explicit adult content without refusal or prompt rewriting
 *    (verified across chat and image sessions).
 * 2. `qwen-edit-uncensored` is the least-restricted edit route observed —
 *    undress/swap/edit jobs succeeded where default edit models returned
 *    refusal or sanitized output.
 * 3. `lustify-v8/v7/sdxl` are the only image families whose prompts survive
 *    verbatim (no narration-rewrite) with explicit anatomy visible.
 * 4. Hosted defaults (non-uncensored Venice tiers, mainstream hosted chat
 *    models) DO rewrite and soften; they are never preferred when an
 *    uncensored route exists.
 * 5. Abliterated open weights (qwen3-*abliterated, heretic) are the freest
 *    model layer on offer; hosting them is the only way to make freedom
 *    deployment-owned instead of vendor-owned.
 * 6. THE APP DOES NOT REWRITE: `enhance_prompt: false`,
 *    `disable_prompt_optimization_thinking: true`, prompts shipped verbatim
 *    (swap/undress/sex contracts are additions the user opts into, and Raw
 *    mode will strip even those).
 *
 * Freedom is a data point, routed like any other capability: verified-high
 * beats assumed-high beats standard.
 */
export const FREEDOM_VERIFIED_HIGH = 'verified-high'
export const FREEDOM_ASSUMED_HIGH = 'assumed-high'
export const FREEDOM_STANDARD = 'standard'

/** Signals that a model is minimally aligned / uncensored. */
export const UNCENSORED_PATTERN = /(abliterated|uncensored|heretic|dolphin|lexi|tiger|nsfw|dpo[-_ ]?nsfw|unfiltered)/i

export const PREFERRED_MODELS: Record<CapabilityId, readonly ModelPreference[]> = {
  // Conversation and writing. Uncensored role-play first, general models after.
  chat: [
    { id: 'venice-uncensored-role-play', uncensored: true, mobile: true, freedom: 'verified-high', note: 'Observed: explicit adult chat passes unrefused.' },
    { id: 'venice-uncensored-1-2', uncensored: true, mobile: true, freedom: 'verified-high' },
    { id: 'venice-uncensored', uncensored: true, mobile: true, freedom: 'verified-high' },
    { id: 'olafangensan-glm-4.7-flash-heretic', uncensored: true, mobile: true, freedom: 'assumed-high', note: 'Heretic lineage; vendor-side most unaligned observed.' },
    { id: 'zai-org-glm-5-1' },
    { id: 'qwen-3-8-27b', mobile: true },
    { id: 'qwen-3-6-plus' },
    { pattern: UNCENSORED_PATTERN, uncensored: true, mobile: true, freedom: 'assumed-high' },
  ],

  // Prompt enhancement / rewriting. Same alignment profile as chat: this is the
  // path that must never sanitise a lawful adult request.
  prompt: [
    { id: 'venice-uncensored-role-play', uncensored: true, mobile: true, freedom: 'verified-high' },
    { id: 'venice-uncensored-1-2', uncensored: true, mobile: true, freedom: 'verified-high' },
    { id: 'venice-uncensored', uncensored: true, mobile: true, freedom: 'verified-high' },
    { id: 'olafangensan-glm-4.7-flash-heretic', uncensored: true, mobile: true, freedom: 'assumed-high' },
    { id: 'qwen-3-8-27b', mobile: true },
    { pattern: UNCENSORED_PATTERN, uncensored: true, mobile: true, freedom: 'assumed-high' },
  ],

  // Noor's agent loop. Order mirrors DEFAULT_AGENT_MODEL / FALLBACK_AGENT_MODEL.
  agent: [
    { id: 'qwen-3-8-27b', mobile: true },
    { id: 'qwen-3-6-plus' },
    { id: 'venice-uncensored-role-play', uncensored: true, freedom: 'verified-high' },
    { id: 'venice-uncensored-1-2', uncensored: true, freedom: 'verified-high' },
    { id: 'venice-uncensored', uncensored: true, freedom: 'verified-high' },
    { pattern: UNCENSORED_PATTERN, uncensored: true, freedom: 'assumed-high' },
  ],

  // Text to image. Uncensored photoreal families first (they are the ones that
  // render real bodies and real skin), then the hosted flagship models.
  image: [
    { id: 'lustify-v8', uncensored: true, freedom: 'verified-high', note: 'Observed: explicit anatomy survives verbatim.' },
    { id: 'lustify-v7', uncensored: true, freedom: 'verified-high' },
    { id: 'lustify-sdxl', uncensored: true, freedom: 'verified-high' },
    { pattern: /lustify/i, uncensored: true, freedom: 'verified-high' },
    { id: 'flux-2-max', mobile: true },
    { id: 'flux-2-pro', mobile: true },
    { id: 'flux-dev' },
    { id: 'nano-banana-pro' },
    { id: 'seedream-v5-pro' },
    { id: 'qwen-image-3-pro' },
    { pattern: /uncensored|nsfw/i, uncensored: true, freedom: 'assumed-high' },
  ],

  // Image to image / identity-preserving edit.
  edit: [
    { id: 'qwen-edit-uncensored', uncensored: true, mobile: true, freedom: 'verified-high', note: 'Observed: undress/swap/edit jobs pass where defaults refuse.' },
    { pattern: /uncensored.*edit|edit.*uncensored/i, uncensored: true, mobile: true, freedom: 'assumed-high' },
    { id: 'qwen-image-3-pro-edit' },
    { id: 'flux-2-max-edit' },
    { id: 'nano-banana-pro-edit' },
    { id: 'seedream-v5-pro-edit' },
    { id: 'firered-image-edit' },
  ],

  // Image to video. The repo's own node default is wan-2.1; everything else is
  // left to discovery because Venice renames video families often.
  video: [
    { id: 'wan-2.1' },
    { pattern: /wan[-_.]?2/i },
    { pattern: /uncensored/i, uncensored: true, freedom: 'assumed-high' },
  ],

  // Face swap (FaceFusion). Swapper ids come from the host catalogue.
  faceswap: [
    { id: 'inswapper_128' },
    { pattern: /inswapper_128_fp16/i },
    { pattern: /simswap_512/i },
    { pattern: /simswap_256/i },
    { pattern: /ghost_/i },
    { pattern: /blendswap/i },
    { pattern: /inswapper/i },
  ],

  // Head swap: the same swapper stack applied to a full head, so the ordering is
  // identical and only the prompt/tooling differs.
  headswap: [
    { id: 'inswapper_128' },
    { pattern: /inswapper_128_fp16/i },
    { pattern: /simswap_512/i },
    { pattern: /ghost_/i },
    { pattern: /inswapper/i },
  ],

  // Body swap is an edit job (rebuild the body, keep identity), not a face swap.
  bodyswap: [
    { id: 'qwen-edit-uncensored', uncensored: true, mobile: true, freedom: 'verified-high' },
    { id: 'flux-2-max-edit' },
    { id: 'qwen-image-3-pro-edit' },
    { pattern: /uncensored.*edit|edit.*uncensored/i, uncensored: true, freedom: 'assumed-high' },
  ],

  // Speech. Omnia (self-hosted) handles Noor; these are the hosted fallbacks.
  tts: [
    { pattern: /omnia/i },
    { pattern: /uncensored|nsfw/i, uncensored: true },
  ],
}

export function preferenceFor(capability: CapabilityId): readonly ModelPreference[] {
  return PREFERRED_MODELS[capability] ?? []
}

export function isUncensoredId(id: string): boolean {
  return UNCENSORED_PATTERN.test(id)
}

function matches(preference: ModelPreference, id: string): boolean {
  if (preference.id) return preference.id.toLowerCase() === id.toLowerCase()
  if (preference.pattern) return preference.pattern.test(id)
  return false
}

/** Rank position, or undefined when the list has no opinion about this id. */
export function preferenceRank(id: string, capability: CapabilityId): number | undefined {
  const list = preferenceFor(capability)
  for (let index = 0; index < list.length; index++) {
    if (matches(list[index], id)) return index
  }
  if (isUncensoredId(id)) return list.length
  return undefined
}

export function isMobileFriendly(id: string, capability: CapabilityId): boolean {
  const list = preferenceFor(capability)
  for (const preference of list) {
    if (matches(preference, id)) return preference.mobile === true
  }
  return false
}

/** Freedom tier position for a model in a capability: 0 = verified, 2 = standard. */
export function freedomTier(id: string, capability: CapabilityId): number {
  const list = preferenceFor(capability)
  for (const preference of list) {
    if (matches(preference, id)) {
      if (preference.freedom === 'verified-high') return 0
      if (preference.freedom === 'assumed-high') return 1
    }
  }
  return 2
}

export function freedomLabel(id: string, capability: CapabilityId): 'verified-high' | 'assumed-high' | 'standard' {
  const list = preferenceFor(capability)
  for (const preference of list) {
    if (matches(preference, id) && (preference.freedom === 'verified-high' || preference.freedom === 'assumed-high')) {
      return preference.freedom
    }
  }
  return 'standard'
}

/**
 * Order a discovered list: known favourites first (in declared order), then
 * measured-freedom tier, then uncensored models, then everything else
 * alphabetically. Inputs are never dropped — discovery wins on membership, this
 * decides sequence only.
 */
export function rankIds(ids: readonly string[], capability: CapabilityId): string[] {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)))
  const ranked = unique.map((id) => ({
    id,
    rank: preferenceRank(id, capability),
    freedom: freedomTier(id, capability),
    uncensored: isUncensoredId(id),
  }))

  ranked.sort((a, b) => {
    const aKnown = a.rank !== undefined
    const bKnown = b.rank !== undefined
    if (aKnown !== bKnown) return aKnown ? -1 : 1
    if (aKnown && bKnown && a.rank !== b.rank) return (a.rank as number) - (b.rank as number)
    if (a.freedom !== b.freedom) return a.freedom - b.freedom
    if (a.uncensored !== b.uncensored) return a.uncensored ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  return ranked.map((entry) => entry.id)
}

export function pickId(ids: readonly string[], capability: CapabilityId): string | undefined {
  return rankIds(ids, capability)[0]
}
