import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

function storage() {
 const values=new Map<string,string>()
 return {getItem:vi.fn((key:string)=>values.get(key) ?? null),setItem:vi.fn((key:string,value:string)=>values.set(key,value)),removeItem:vi.fn((key:string)=>values.delete(key)),clear:()=>values.clear()}
}
let session:ReturnType<typeof storage>,local:ReturnType<typeof storage>
beforeEach(()=>{vi.resetModules();session=storage();local=storage();vi.stubGlobal('sessionStorage',session);vi.stubGlobal('localStorage',local)})
afterEach(()=>vi.unstubAllGlobals())
describe('provider credential storage',()=>{
 it('migrates a legacy Venice session key to memory and removes plaintext',async()=>{
  session.setItem('venice-auth','legacy-test-key')
  const {useAuthStore}=await import('./auth-store')
  expect(useAuthStore.getState().apiKey).toBe('legacy-test-key')
  expect(session.getItem('venice-auth')).toBeNull()
 })
 it('cleans both plaintext stores when legacy copies coexist',async()=>{
  session.setItem('venice-auth','session-test-key')
  local.setItem('venice-auth',JSON.stringify({state:{apiKey:'legacy-disk-test-key'}}))
  const {useAuthStore}=await import('./auth-store')
  expect(useAuthStore.getState().apiKey).toBe('session-test-key')
  expect(session.getItem('venice-auth')).toBeNull()
  expect(local.getItem('venice-auth')).toBeNull()
 })
 it('keeps ordinary Venice keys in memory only',async()=>{
  const {useAuthStore}=await import('./auth-store')
  await useAuthStore.getState().setApiKey('test-provider-secret')
  expect(useAuthStore.getState().apiKey).toBe('test-provider-secret')
  expect(session.getItem('venice-auth')).toBeNull()
  expect(local.getItem('venice-auth')).toBeNull()
  expect(session.setItem).not.toHaveBeenCalled()
 })
 it('preserves encrypted remembering and rejects wrong passphrases',async()=>{
  const {useAuthStore}=await import('./auth-store')
  await useAuthStore.getState().setApiKey('test-provider-secret',{passphrase:'test-passphrase'})
  expect(local.getItem('venice-auth-enc')).not.toContain('test-provider-secret')
  useAuthStore.setState({apiKey:null})
  expect(await useAuthStore.getState().unlock('wrong')).toBe(false)
  expect(useAuthStore.getState().apiKey).toBeNull()
  expect(await useAuthStore.getState().unlock('test-passphrase')).toBe(true)
  expect(useAuthStore.getState().apiKey).toBe('test-provider-secret')
  expect(session.getItem('venice-auth')).toBeNull()
 })
 it('restores Android device-vault keys without a plaintext session copy',async()=>{
  const nativePromise=vi.fn(async()=>({found:true,value:'native-vault-test-key'}))
  vi.stubGlobal('window',{Capacitor:{getPlatform:()=> 'android',isNativePlatform:()=>true,nativePromise}})
  const {useAuthStore}=await import('./auth-store')
  expect(await useAuthStore.getState().hydrateFromDevice()).toBe(true)
  expect(useAuthStore.getState().apiKey).toBe('native-vault-test-key')
  expect(session.getItem('venice-auth')).toBeNull()
 })
 it('migrates Qwen credentials to memory and excludes them from persisted settings',async()=>{
  session.setItem('openvenice-qwen-api-key','legacy-qwen-test-key')
  const {useProviderStore}=await import('./provider-store')
  expect(useProviderStore.getState().qwenApiKey).toBe('legacy-qwen-test-key')
  expect(session.getItem('openvenice-qwen-api-key')).toBeNull()
  useProviderStore.getState().setQwenApiKey('new-qwen-test-key')
  expect(useProviderStore.getState().qwenApiKey).toBe('new-qwen-test-key')
  expect(session.getItem('openvenice-qwen-api-key')).toBeNull()
  const saved=useProviderStore.persist.getOptions().partialize!(useProviderStore.getState())
  expect(saved).not.toHaveProperty('qwenApiKey')
 })
})
