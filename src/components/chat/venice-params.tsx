import { useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useProviderStore } from '../../stores/provider-store'
import { cn } from '../../lib/utils'

export function VeniceParams() {
  const { veniceParams, setVeniceParams, temperature, setTemperature, topP, setTopP, maxTokens, setMaxTokens } = useChatStore()
  const chatProvider = useProviderStore((s) => s.chatProvider)
  const setChatProvider = useProviderStore((s) => s.setChatProvider)
  const qwenBaseUrl = useProviderStore((s) => s.qwenBaseUrl)
  const setQwenBaseUrl = useProviderStore((s) => s.setQwenBaseUrl)
  const qwenModelId = useProviderStore((s) => s.qwenModelId)
  const setQwenModelId = useProviderStore((s) => s.setQwenModelId)
  const qwenApiKey = useProviderStore((s) => s.qwenApiKey)
  const setQwenApiKey = useProviderStore((s) => s.setQwenApiKey)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="px-3 sm:px-4 py-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <ProviderPill provider={chatProvider} onChange={setChatProvider} />
        {chatProvider === 'venice' && (
          <>
            <SearchPill
              value={veniceParams.enable_web_search || 'off'}
              onChange={(v) => setVeniceParams({ enable_web_search: v })}
            />
            <Pill
              label="Citations"
              active={veniceParams.enable_web_citations === true}
              onClick={() => setVeniceParams({ enable_web_citations: !veniceParams.enable_web_citations })}
            />
            <Pill
              label="Search in stream"
              active={veniceParams.include_search_results_in_stream === true}
              onClick={() => setVeniceParams({ include_search_results_in_stream: !veniceParams.include_search_results_in_stream })}
            />
          </>
        )}
        {chatProvider === 'qwen' && (
          <span className="min-h-[36px] flex items-center rounded-full bg-white/[0.03] px-2.5 text-[12px] text-white/40">
            Private OpenAI-compatible route · no silent fallback
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'ml-auto flex items-center gap-1 text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors duration-100 min-h-[36px]',
            showSettings ? 'bg-white/90 text-black' : 'bg-white/[0.06] text-white/55 hover:text-white/80 hover:bg-white/[0.1]',
          )}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          {showSettings ? 'Close' : 'Settings'}
        </button>
      </div>

      {showSettings && (
        <div className="mt-2.5 pb-2 flex flex-col gap-2.5 rounded-xl border border-white/[0.06] bg-black/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] uppercase tracking-[0.08em] text-white/35">Chat engine</div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="min-h-[36px] px-3 rounded-lg bg-white text-black text-[13px] font-medium"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setChatProvider('qwen')} className={providerButton(chatProvider === 'qwen')}>
              Private Qwen
            </button>
            <button type="button" onClick={() => setChatProvider('venice')} className={providerButton(chatProvider === 'venice')}>
              Venice
            </button>
          </div>

          {chatProvider === 'qwen' ? (
            <div className="flex flex-col gap-2 rounded-lg border border-violet-300/10 bg-violet-300/[0.035] p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">OpenAI-compatible base URL</span>
                <input
                  value={qwenBaseUrl}
                  onChange={(e) => setQwenBaseUrl(e.target.value)}
                  placeholder="https://your-qwen-server.example/v1"
                  inputMode="url"
                  className="min-h-10 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-[13px] text-white outline-none focus:border-white/[0.2]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Served model ID</span>
                <input
                  value={qwenModelId}
                  onChange={(e) => setQwenModelId(e.target.value)}
                  className="min-h-10 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-[13px] text-white outline-none focus:border-white/[0.2]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] uppercase tracking-[0.08em] text-white/35">Bearer API key · optional</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={qwenApiKey}
                  onChange={(e) => setQwenApiKey(e.target.value)}
                  placeholder="Leave blank if your private server does not require one"
                  className="min-h-10 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-[13px] text-white outline-none focus:border-white/[0.2]"
                />
              </label>
              <div className="text-[12px] leading-relaxed text-white/40">
                The endpoint is called directly at <span className="font-mono text-white/55">/chat/completions</span>. The API key is kept in session storage only. The server must allow this app origin until the native Android transport is added.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2 text-[13px] leading-relaxed text-white/55">
              Venice uses the API key configured in the app header. The selected model is called directly.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ParamSlider label="Temperature" value={temperature} onChange={setTemperature} min={0} max={2} step={0.1} />
            <ParamSlider label="Top P" value={topP} onChange={setTopP} min={0} max={1} step={0.05} />
            <ParamSlider label="Max Tokens" value={maxTokens} onChange={setMaxTokens} min={256} max={32768} step={256} format={(v) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v)} />
          </div>

          <div className="text-[12px] text-white/35">
            {chatProvider === 'qwen'
              ? 'Qwen reasoning/vision route enabled · cross-provider fallback disabled'
              : 'Venice system prompt: off · thinking: disabled'}
          </div>
        </div>
      )}
    </div>
  )
}

function providerButton(active: boolean) {
  return cn(
    'min-h-10 rounded-lg border px-3 text-[13px] font-medium transition-colors',
    active ? 'border-white/20 bg-white text-black' : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:bg-white/[0.06]',
  )
}

function ParamSlider({ label, value, onChange, min, max, step, format }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: (v: number) => string
}) {
  const display = format ? format(value) : String(value)
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[12px] text-white/35 font-medium uppercase tracking-[0.08em]">{label}</label>
        <span className="text-[12px] text-white/45 font-mono">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full min-h-[32px]" />
    </div>
  )
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-[13px] font-medium px-2.5 py-1.5 rounded-full transition-colors duration-100 min-h-[36px]',
        active
          ? 'bg-white/90 text-black'
          : 'bg-white/[0.03] text-white/35 hover:text-white/55 hover:bg-white/[0.05]',
      )}
    >
      {label}
    </button>
  )
}

function ProviderPill({ provider, onChange }: { provider: 'qwen' | 'venice'; onChange: (provider: 'qwen' | 'venice') => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(provider === 'qwen' ? 'venice' : 'qwen')}
      className="min-h-[36px] rounded-full bg-white/90 px-2.5 text-[13px] font-medium text-black"
      title="Switch chat provider"
    >
      {provider === 'qwen' ? 'Qwen' : 'Venice'}
    </button>
  )
}

const SEARCH_MODES = ['off', 'on', 'auto'] as const
type SearchMode = (typeof SEARCH_MODES)[number]

function SearchPill({ value, onChange }: { value: string; onChange: (v: SearchMode) => void }) {
  const current = SEARCH_MODES.indexOf(value as SearchMode)
  const next = () => onChange(SEARCH_MODES[(current + 1) % SEARCH_MODES.length])
  const label = `Search: ${value}`
  const active = value !== 'off'

  return (
    <button
      type="button"
      onClick={next}
      className={cn(
        'text-[13px] font-medium px-2.5 py-1.5 rounded-full transition-colors duration-100 min-h-[36px]',
        active
          ? 'bg-white/90 text-black'
          : 'bg-white/[0.03] text-white/35 hover:text-white/55 hover:bg-white/[0.05]',
      )}
    >
      {label}
    </button>
  )
}
