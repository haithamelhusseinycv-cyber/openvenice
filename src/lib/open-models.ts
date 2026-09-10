import type { ModelCapabilities, ModelTrait } from '../types/venice'

/**
 * Normalized view of a model served by an OpenAI-compatible endpoint.
 *
 * `/v1/models` only guarantees `id` (and usually `owned_by`). Everything else
 * here is *inferred* from the id and labelled as such in the UI — we never claim
 * a backend capability we cannot prove, because a wrong `supportsResponseSchema`
 * turns into an HTTP 400 at request time.
 */
export interface DiscoveredModel {
  id: string
  name: string
  capabilities: ModelCapabilities
  traits: ModelTrait[]
  reasoning: boolean
  vision: boolean
  /** True when the capability flags were derived from the id, not declared. */
  inferred: true
}

const VISION_PATTERN = /(vl\b|-vl|_vl|vision|llava|multimodal|pixtral|internvl|gemma-?3|gemma3)/i
const REASONING_PATTERN = /(thinking|reason|-r1\b|_r1|qwq|deepseek-r|magistral|think)/i
const CODE_PATTERN = /(coder|code-|codestral|devstral|deepseek-coder|starcoder|codegemma)/i
const TOOL_PATTERN = /(qwen|hermes|mistral|mixtral|llama-?3\.[13]|llama-?4|command-r|granite|glm|phi-4|nous)/i
const INSTRUCT_PATTERN = /(instruct|chat|it\b|-it$)/i

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Derive capabilities from a model id.
 *
 * Deliberately conservative: `supportsResponseSchema` stays false because most
 * self-hosted servers only honour `response_format` for selected models, and a
 * false positive costs the user a failed request.
 */
export function inferCapabilities(id: string): ModelCapabilities {
  const vision = VISION_PATTERN.test(id)
  const reasoning = REASONING_PATTERN.test(id)
  const code = CODE_PATTERN.test(id)
  return {
    supportsVision: vision,
    supportsVideoInput: false,
    supportsAudioInput: false,
    supportsReasoning: reasoning,
    supportsReasoningEffort: false,
    supportsFunctionCalling: TOOL_PATTERN.test(id),
    supportsResponseSchema: false,
    supportsWebSearch: false,
    supportsXSearch: false,
    supportsLogProbs: false,
    supportsMultipleImages: vision,
    supportsTeeAttestation: false,
    supportsE2EE: false,
    optimizedForCode: code,
  }
}

export function toDiscoveredModel(id: string): DiscoveredModel {
  const capabilities = inferCapabilities(id)
  const traits: ModelTrait[] = []
  if (capabilities.supportsReasoning) traits.push('default_reasoning')
  if (capabilities.optimizedForCode) traits.push('default_code')
  if (capabilities.supportsVision) traits.push('default_vision')

  return {
    id,
    name: id,
    capabilities,
    traits,
    reasoning: capabilities.supportsReasoning === true,
    vision: capabilities.supportsVision === true,
    inferred: true,
  }
}

/** Accept whatever shape the server returned and produce a clean, ordered list. */
export function normalizeDiscoveredModels(entries: unknown): DiscoveredModel[] {
  if (!Array.isArray(entries)) return []
  const seen = new Set<string>()
  const models: DiscoveredModel[] = []
  for (const entry of entries) {
    const raw = clean(typeof entry === 'string' ? entry : (entry as { id?: unknown })?.id)
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    models.push(toDiscoveredModel(raw))
  }
  return models
}

/** Mark the user's preference as recommended without reordering the rest. */
export function rankDiscoveredModels(models: DiscoveredModel[], preferred?: string): DiscoveredModel[] {
  const wanted = clean(preferred)
  if (!wanted) return models
  const index = models.findIndex((model) => model.id === wanted)
  if (index <= 0) return models
  return [models[index], ...models.slice(0, index), ...models.slice(index + 1)]
}

/**
 * Resolve which model to actually call.
 *
 * The configured id is a preference: if the endpoint does not serve it, we use
 * what the endpoint does serve instead of failing the request. An empty
 * discovery list keeps the configured id so an offline endpoint still produces a
 * meaningful error message rather than "no model".
 */
export function pickOpenModelId(discovered: string[], preferred?: string): string {
  const wanted = clean(preferred)
  const available = discovered.map(clean).filter((id) => id.length > 0)
  if (wanted && available.includes(wanted)) return wanted
  if (available.length > 0) return available[0]
  return wanted
}

export function hasDiscoveredModels(discovered: string[]): boolean {
  return discovered.some((id) => clean(id).length > 0)
}

export function isInstructionTuned(id: string): boolean {
  return INSTRUCT_PATTERN.test(id)
}
