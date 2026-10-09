import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { shareImage as shareMedia } from './native-media'

export interface SavedImage {
  id: string; uri: string; prompt: string; provider: string; createdAt: number
  thumbnailUri?: string; filePath?: string
}
const DB_NAME = 'chili-images', STORE_NAME = 'images', MAX_STORED = 100
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' }) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
function complete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Image storage was interrupted'))
  })
}
async function put(image: SavedImage) {
  const db = await openDB()
  try { const tx = db.transaction(STORE_NAME, 'readwrite'); const done = complete(tx); tx.objectStore(STORE_NAME).put(image); await done }
  finally { db.close() }
}
async function dataUrl(imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('Could not read generated image')
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
export async function saveGeneratedImage(params: { id: string; imageUrl: string; prompt: string; provider: string }): Promise<SavedImage> {
  const bytes = await dataUrl(params.imageUrl)
  let uri = bytes, filePath: string | undefined
  if (Capacitor.isNativePlatform()) {
    filePath = 'images/chilli_' + params.id.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png'
    const result = await Filesystem.writeFile({ path: filePath, data: bytes.split(',')[1], directory: Directory.Data, recursive: true })
    uri = Capacitor.convertFileSrc(result.uri)
  }
  const saved: SavedImage = { id: params.id, uri, filePath, prompt: params.prompt, provider: params.provider, createdAt: Date.now() }
  await put(saved)
  const all = await getSavedImages()
  for (const old of all.slice(MAX_STORED)) await deleteSavedImage(old.id)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('chilli-images-saved'))
  return saved
}
export async function getSavedImages(): Promise<SavedImage[]> {
  const db = await openDB()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const all = await new Promise<SavedImage[]>((resolve, reject) => { const req = tx.objectStore(STORE_NAME).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    return all.map(image => ({ ...image, uri: image.filePath && Capacitor.isNativePlatform() ? image.uri : image.uri.startsWith('file:') ? Capacitor.convertFileSrc(image.uri) : image.uri })).sort((a, b) => b.createdAt - a.createdAt)
  } finally { db.close() }
}
export async function deleteSavedImage(id: string): Promise<void> {
  const db = await openDB()
  let image: SavedImage | undefined
  try {
    const read = db.transaction(STORE_NAME, 'readonly')
    image = await new Promise((resolve, reject) => { const req = read.objectStore(STORE_NAME).get(id); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
    const tx = db.transaction(STORE_NAME, 'readwrite'), done = complete(tx)
    tx.objectStore(STORE_NAME).delete(id); await done
  } finally { db.close() }
  if (image?.filePath && Capacitor.isNativePlatform()) await Filesystem.deleteFile({ path: image.filePath, directory: Directory.Data }).catch(() => undefined)
  if (image?.uri.startsWith('blob:')) URL.revokeObjectURL(image.uri)
}
export async function shareImage(image: SavedImage) {
  await shareMedia(image.uri, 'image/png', 'chilli_' + image.id + '.png')
}
