export interface PromptStats {
  characters: number
  words: number
  estimatedTokens: number
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function countWords(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function analyzePrompt(text: string): PromptStats {
  return {
    characters: text.length,
    words: countWords(text),
    estimatedTokens: estimateTokens(text),
  }
}

export function formatTokenCount(count: number): string {
  if (count < 1000) return `${count}`
  return `${(count / 1000).toFixed(1)}k`
}
