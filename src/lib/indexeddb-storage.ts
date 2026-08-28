import type { StateStorage } from 'zustand/middleware'
import { createSafeStorage } from './safe-storage'

const DB_VERSION = 1
const DEFAULT_DB = 'openvenice-state'
const DEFAULT_STORE = 'zustand'

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  })
}

function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'))
  })
}

/**
 * Async Zustand storage backed by IndexedDB.
 *
 * On first read it migrates an existing localStorage value with the same key into
 * IndexedDB, then removes that large localStorage entry. If IndexedDB is unavailable,
 * the existing quota-safe localStorage wrapper remains as a compatibility fallback.
 */
export function createIndexedDBStorage(
  dbName = DEFAULT_DB,
  storeName = DEFAULT_STORE,
): StateStorage {
  const fallback = createSafeStorage()
  let dbPromise: Promise<IDBDatabase> | null = null

  const getDb = () => {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'))
    dbPromise ??= openDatabase(dbName, storeName)
    return dbPromise
  }

  const readFallback = async (name: string): Promise<string | null> => {
    try {
      return await Promise.resolve(fallback.getItem(name))
    } catch {
      return null
    }
  }

  const removeFallback = async (name: string): Promise<void> => {
    try {
      await Promise.resolve(fallback.removeItem(name))
    } catch {
      // Ignore fallback cleanup failures.
    }
  }

  return {
    getItem: async (name) => {
      try {
        const db = await getDb()
        const transaction = db.transaction(storeName, 'readonly')
        const result = await requestToPromise(transaction.objectStore(storeName).get(name))
        if (typeof result === 'string') return result

        const legacy = await readFallback(name)
        if (legacy !== null) {
          try {
            const write = db.transaction(storeName, 'readwrite')
            write.objectStore(storeName).put(legacy, name)
            await transactionDone(write)
            await removeFallback(name)
          } catch {
            // Return the legacy value even if migration could not be completed.
          }
        }
        return legacy
      } catch {
        return readFallback(name)
      }
    },

    setItem: async (name, value) => {
      try {
        const db = await getDb()
        const transaction = db.transaction(storeName, 'readwrite')
        transaction.objectStore(storeName).put(value, name)
        await transactionDone(transaction)
        await removeFallback(name)
      } catch {
        await Promise.resolve(fallback.setItem(name, value))
      }
    },

    removeItem: async (name) => {
      try {
        const db = await getDb()
        const transaction = db.transaction(storeName, 'readwrite')
        transaction.objectStore(storeName).delete(name)
        await transactionDone(transaction)
      } catch {
        // Continue with fallback cleanup.
      }
      await removeFallback(name)
    },
  }
}
