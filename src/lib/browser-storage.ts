const memory = new Map<string, string>()
export const browserStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
 getItem(key) { try { if (typeof localStorage !== 'undefined') return localStorage.getItem(key) } catch { /* unavailable */ } return memory.get(key) ?? null },
 setItem(key, value) { memory.set(key, value); try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value) } catch { /* session fallback */ } },
 removeItem(key) { memory.delete(key); try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key) } catch { /* unavailable */ } },
}
