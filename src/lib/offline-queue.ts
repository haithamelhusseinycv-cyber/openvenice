/**
 * Offline job queue: persists generation requests when offline,
 * executes them when connectivity returns.
 */

import type { StartGenerationParams } from '../services/generation-executor'

const QUEUE_DB = 'chili-offline-queue'
const QUEUE_STORE = 'pending-generations'

export interface QueuedGeneration {
  id: string
  params: StartGenerationParams
  queuedAt: number
  retryCount: number
}

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function enqueueGeneration(params: StartGenerationParams): Promise<QueuedGeneration> {
  const queued: QueuedGeneration = {
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    params,
    queuedAt: Date.now(),
    retryCount: 0,
  }

  const db = await openQueueDB()
  const tx = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  store.put(queued)

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()

  return queued
}

export async function getQueuedGenerations(): Promise<QueuedGeneration[]> {
  try {
    const db = await openQueueDB()
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const store = tx.objectStore(QUEUE_STORE)
    const all = await new Promise<QueuedGeneration[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return all.sort((a, b) => a.queuedAt - b.queuedAt)
  } catch {
    return []
  }
}

export async function dequeueGeneration(id: string): Promise<void> {
  const db = await openQueueDB()
  const tx = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  store.delete(id)

  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

export async function incrementRetryCount(id: string): Promise<number> {
  const db = await openQueueDB()
  const tx = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)

  const item = await new Promise<QueuedGeneration | undefined>((resolve) => {
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(undefined)
  })

  if (!item) {
    db.close()
    return 0
  }

  item.retryCount += 1
  store.put(item)

  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()

  return item.retryCount
}

export async function clearQueue(): Promise<void> {
  const db = await openQueueDB()
  const tx = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  store.clear()

  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

export async function getQueueLength(): Promise<number> {
  try {
    const db = await openQueueDB()
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const store = tx.objectStore(QUEUE_STORE)
    const count = await new Promise<number>((resolve, reject) => {
      const req = store.count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return count
  } catch {
    return 0
  }
}
