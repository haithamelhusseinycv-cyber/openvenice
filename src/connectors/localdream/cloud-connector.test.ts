import { describe, expect, it, vi } from 'vitest'
import { LocalDreamCloudConnector } from './cloud-connector'

function fixture() {
  const data = new Map<string, string>()
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) }, removeItem: (k: string) => { data.delete(k) } }
  const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response
  const fetcher = vi.fn<typeof fetch>()
  const client = new LocalDreamCloudConnector(storage, fetcher)
  return { client, fetcher, storage, response }
}
describe('Shared cloud channel', () => {
  it('recovers a lost submission using exactly the saved token', async () => {
    const f = fixture()
    f.fetcher.mockResolvedValueOnce(f.response({ protocol: 2, profile: 'Best', operations: [{ id: 'create' }] })).mockRejectedValueOnce(new Error('lost reply'))
    await expect(f.client.submit({ operation: 'create', prompt: 'A ceramic mug' })).rejects.toThrow('lost reply')
    const body = f.fetcher.mock.calls[1][1]?.body
    expect(f.client.pending()?.body.quality).toBe('high')
    const reloaded = new LocalDreamCloudConnector(f.storage, f.fetcher)
    f.fetcher.mockResolvedValueOnce(f.response({ id: 'job1', state: 'processing', images: [] }))
    await reloaded.reconnect()
    expect(f.fetcher.mock.calls[2][1]?.body).toEqual(body)
    f.fetcher.mockResolvedValueOnce(f.response({ id: 'job1', state: 'complete', images: [] }))
    await reloaded.reconnect()
    expect(f.fetcher.mock.calls[3][1]?.method).toBe('GET')
  })
  it('does not overwrite an active pending request', async () => {
    const f = fixture()
    f.fetcher.mockResolvedValueOnce(f.response({ protocol: 2, profile: 'Best', operations: [{ id: 'create' }] })).mockResolvedValueOnce(f.response({ id: 'job1', state: 'processing', images: [] }))
    await f.client.submit({ operation: 'create', prompt: 'A mug' })
    await expect(f.client.submit({ operation: 'create', prompt: 'A vase' })).rejects.toThrow('Reconnect')
    expect(f.fetcher).toHaveBeenCalledTimes(2)
  })
  it('rejects a mismatched gateway before paid submission', async () => {
    const f = fixture()
    f.fetcher.mockResolvedValueOnce(f.response({ protocol: 1, profile: 'Quick', operations: [] }))
    await expect(f.client.submit({ operation: 'create', prompt: 'A mug' })).rejects.toThrow('does not support')
    expect(f.client.pending()).toBeUndefined()
    expect(f.fetcher).toHaveBeenCalledTimes(1)
  })
  it('keeps pending state until a terminal result is acknowledged', async () => {
    const f = fixture()
    f.fetcher.mockResolvedValueOnce(f.response({ protocol: 2, profile: 'Best', operations: [{ id: 'create' }] })).mockResolvedValueOnce(f.response({ id: 'job1', state: 'processing', images: [] }))
    await f.client.submit({ operation: 'create', prompt: 'A mug' })
    f.fetcher.mockResolvedValueOnce(f.response({ id: 'job1', state: 'processing', images: [] }))
    await expect(f.client.acknowledge()).rejects.toThrow('still active')
    expect(f.client.pending()).toBeDefined()
    f.fetcher.mockResolvedValueOnce(f.response({ id: 'job1', state: 'needs_review', images: [] }))
    await f.client.acknowledge()
    expect(f.client.pending()).toBeUndefined()
  })
})
