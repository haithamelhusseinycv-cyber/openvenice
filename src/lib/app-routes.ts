import type { VisibleTab } from './allowed-models'
export const APP_ROUTES: Record<VisibleTab, string> = { studio: '/studio', playground: '/noor', image: '/create' }
export function tabForPath(path: string): VisibleTab {
  return path.replace(/\/$/, '') === '/noor' ? 'playground' : path.replace(/\/$/, '') === '/create' ? 'image' : 'studio'
}
