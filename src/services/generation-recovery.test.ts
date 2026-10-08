import { afterEach, expect, it, vi } from 'vitest'
import { GenerationExecutor } from './generation-executor'
afterEach(() => vi.unstubAllGlobals())
it('restores an interrupted paid request without submitting it again', () => {
 const stored = JSON.stringify({id:'interrupted',status:'running',provider:'venice',prompt:'A mug',route:{operation:'create'}})
 const fetcher = vi.fn()
 vi.stubGlobal('fetch',fetcher)
 vi.stubGlobal('localStorage',{getItem:()=>stored,setItem:vi.fn(),removeItem:vi.fn()})
 const executor = new GenerationExecutor()
 expect(executor.getCurrentJob()?.status).toBe('failed')
 expect(executor.getCurrentJob()?.message).toContain('provider may have completed')
 expect(fetcher).not.toHaveBeenCalled()
})
