export const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || 'https://chilli-production.haitham-elhusseiny-cv.workers.dev'
export function shareUrl(kind: 'recipe' | 'preset', value: string) {
  const url = new URL(PUBLIC_APP_URL)
  url.searchParams.set(kind, value)
  return url.toString()
}
