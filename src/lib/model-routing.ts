const FALLBACK_STATUSES = new Set([400, 403, 404, 408, 425, 429, 500, 502, 503, 504])

export function modelErrorStatus(error: unknown): number {
  if (!error || typeof error !== 'object' || !('status' in error)) return 0
  const status = Number((error as { status?: number }).status)
  return Number.isFinite(status) ? status : 0
}

/**
 * Retry once with the configured backup only when the primary model rejected
 * the request before producing output. Authentication and credit failures are
 * deliberately never hidden by a model switch.
 */
export function shouldUseModelFallback(
  error: unknown,
  options: { aborted?: boolean; hasOutput?: boolean } = {},
): boolean {
  if (options.aborted || options.hasOutput) return false
  return FALLBACK_STATUSES.has(modelErrorStatus(error))
}
