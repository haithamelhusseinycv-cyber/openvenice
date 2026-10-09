/**
 * Input sanitization utilities for security hardening.
 * Prevents XSS and injection attacks in user prompts.
 */

const MAX_PROMPT_LENGTH = 5000
const DANGEROUS_PATTERNS = [
  /<script[\s>]/gi,
  /<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[\s>]/gi,
  /<object[\s>]/gi,
  /<embed[\s>]/gi,
  /<link[\s>]/gi,
  /<meta[\s>]/gi,
  /data:text\/html/gi,
]

export function sanitizePrompt(input: string): string {
  let sanitized = input.slice(0, MAX_PROMPT_LENGTH)

  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }

  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

  return sanitized.trim()
}

export function validatePrompt(prompt: string): { valid: boolean; error?: string } {
  if (!prompt || prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' }
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` }
  }

  return { valid: true }
}

export function sanitizeApiKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 256)
}
