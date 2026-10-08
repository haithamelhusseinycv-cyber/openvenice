/// <reference types="node" />
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, it, expect, vi } from 'vitest'
const source = readFileSync('public/sw.js','utf8').replace('__VERSION__','new').replace('__PRECACHE__',JSON.stringify(['/index.html','/assets/a.js']))
function setup(fail = false) {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {}
  const stores = new Map<string, {match: () => Promise<string>; addAll?: () => Promise<void>}>([['chilli-shell-old',{match:async()=> 'previous shell'}]])
  const skipWaiting = vi.fn()
  const caches = {keys:async()=>[...stores.keys()],delete:async(key:string)=>stores.delete(key),open:async(key:string)=>{
    if(!stores.has(key)) stores.set(key,{addAll:async()=>{if(fail)throw Error('Connection interrupted')},match:async()=> 'new shell'})
    return stores.get(key)
  }}
  vm.runInNewContext(source,{self:{addEventListener:(name:string,fn:(event: Record<string, unknown>) => void)=>handlers[name]=fn,skipWaiting,clients:{claim:vi.fn()},location:{origin:'https://chilli.test'}},caches,URL,fetch:async()=>{throw Error('Offline')}})
  const invoke = (name:string, fields = {}) => new Promise((resolve,reject)=>handlers[name]({...fields,waitUntil:(p:Promise<unknown>)=>p.then(resolve,reject),respondWith:(p:Promise<unknown>)=>p.then(resolve,reject)}))
  return {stores,skipWaiting,handlers,invoke}
}
describe('Interrupted PWA update recovery',()=>{
 it('preserves the working shell when a new asset download fails',async()=>{
  const s=setup(true)
  await expect(s.invoke('install')).rejects.toThrow('Connection interrupted')
  expect([...s.stores.keys()]).toEqual(['chilli-shell-old'])
  expect(s.skipWaiting).not.toHaveBeenCalled()
 })
 it('waits for explicit activation after a complete update',async()=>{
  const s=setup()
  await s.invoke('install')
  expect(s.stores.has('chilli-shell-new')).toBe(true)
  expect(s.skipWaiting).not.toHaveBeenCalled()
  s.handlers.message({data:'SKIP_WAITING'})
  expect(s.skipWaiting).toHaveBeenCalledOnce()
  await s.invoke('activate')
  expect(s.stores.has('chilli-shell-old')).toBe(true)
  expect(await s.invoke('fetch',{request:{method:'GET',url:'https://chilli.test/image',mode:'navigate'}})).toBe('new shell')
 })
})
