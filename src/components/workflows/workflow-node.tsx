import { memo, useCallback, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps, type Node } from '@xyflow/react'
import type { VeniceNodeData, VeniceNodeType } from '../../stores/workflow-store'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useModels } from '../../hooks/use-models'
import { DEFAULT_CHAT_MAX_TOKENS } from '../../lib/allowed-models'
import { Select } from '../ui/select'
import { cn } from '../../lib/utils'

function InputIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 9 8 12 2 12" /></svg>
}
function ChatIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
}
function ImageIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
}
function OutputIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 12h8M12 8v8" /></svg>
}
function UnsupportedIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 8l8 8M16 8l-8 8" /></svg>
}

const NODE_CONFIG: Partial<Record<VeniceNodeType, { label: string; Icon: () => React.JSX.Element; color: string; hasInput: boolean; hasOutput: boolean }>> = {
  textInput: { label: 'Input', Icon: InputIcon, color: 'border-blue-500/30', hasInput: false, hasOutput: true },
  chat: { label: 'LLM', Icon: ChatIcon, color: 'border-purple-500/30', hasInput: true, hasOutput: true },
  imageGen: { label: 'Image Gen', Icon: ImageIcon, color: 'border-pink-500/30', hasInput: true, hasOutput: true },
  output: { label: 'Output', Icon: OutputIcon, color: 'border-white/20', hasInput: true, hasOutput: false },
}

const selectCls = 'nodrag bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5 text-[12px] text-white/55 outline-none'
const inputCls = 'nodrag w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-1 text-[13px] text-white/70 outline-none placeholder:text-white/20'

type WorkflowNode = Node<VeniceNodeData>

function ModelSelect({ nodeType, value, onChange }: { nodeType: 'chat' | 'imageGen'; value: string; onChange: (v: string) => void }) {
  const { data: models } = useModels(nodeType === 'chat' ? 'text' : 'image')
  const options = models?.map((model) => ({ value: model.id, label: model.model_spec?.name || model.id })) ?? []

  return (
    <div className="nodrag">
      <Select
        value={value}
        onChange={onChange}
        options={options}
        searchable
        placeholder="Select model..."
        className="w-full [&_button]:!py-1 [&_button]:!text-[13px] [&_button]:!px-2"
      />
    </div>
  )
}

function parseFiniteNumber(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function WorkflowNodeComponent({ id, data }: NodeProps<WorkflowNode>) {
  const config = NODE_CONFIG[data.nodeType]
  const result = useWorkflowStore((state) => state.runResults[id])
  const { setNodes } = useReactFlow()
  const [outputExpanded, setOutputExpanded] = useState(false)

  const updateNode = useCallback((updates: Partial<VeniceNodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...updates } } : node)),
    )
  }, [id, setNodes])

  const deleteNode = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== id))
  }, [id, setNodes])

  if (!config) {
    return (
      <div className="rounded-xl border-2 border-red-500/30 bg-[#111] shadow-xl min-w-[300px] max-w-[340px]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <span className="text-red-300/70"><UnsupportedIcon /></span>
          <span className="text-[14px] font-medium text-red-300/80">Unsupported node</span>
          <span className="ml-auto text-[11px] text-white/30 font-mono">{data.nodeType}</span>
          <button onClick={deleteNode} className="nodrag text-white/25 hover:text-red-300 transition-colors p-0.5" title="Delete node">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <p className="px-4 py-3 text-[13px] leading-relaxed text-white/45">This saved node type is disabled in the customized build. Delete it or replace it with Chat / Image Gen.</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 bg-[#111] shadow-xl min-w-[300px] max-w-[340px]',
        config.color,
        result?.status === 'running' && 'ring-2 ring-white/20 animate-pulse',
        result?.status === 'done' && 'ring-2 ring-green-500/30',
        result?.status === 'error' && 'ring-2 ring-red-500/30',
      )}
    >
      {config.hasInput && <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-white/30 !border-2 !border-[#111]" />}

      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <span className="text-white/35"><config.Icon /></span>
        <span className="text-[14px] font-medium text-white/70">{config.label}</span>
        {result?.status === 'running' && <span className="text-[12px] text-white/35 ml-auto mr-1">Running...</span>}
        {result?.status === 'done' && <span className="text-[12px] text-green-400/70 ml-auto mr-1">Done</span>}
        {result?.status === 'error' && <span className="text-[12px] text-red-400/70 ml-auto mr-1">Error</span>}
        {!result?.status && <span className="ml-auto" />}
        <button onClick={deleteNode} className="nodrag text-white/20 hover:text-red-400/70 transition-colors p-0.5" title="Delete node">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1.5">
        {data.nodeType === 'output' ? (
          result?.status === 'done' && result.output ? (
            <div className="min-h-[60px]">
              {result.output.startsWith('[image:') ? (
                <img src={result.output.slice(7, -1)} alt="Generated" className="w-full rounded-lg border border-white/[0.06]" />
              ) : (
                <p className={cn('text-[14px] text-white/65 leading-relaxed whitespace-pre-wrap', !outputExpanded && 'line-clamp-8')} onClick={() => setOutputExpanded(!outputExpanded)}>
                  {result.output}
                </p>
              )}
            </div>
          ) : result?.status === 'running' ? (
            <div className="min-h-[40px] flex items-center justify-center"><span className="text-[13px] text-white/30">Waiting for input...</span></div>
          ) : result?.status === 'error' ? (
            <p className="text-[13px] text-red-400/70">{result.error}</p>
          ) : (
            <div className="min-h-[40px] flex items-center justify-center"><span className="text-[13px] text-white/20">Run workflow to see output</span></div>
          )
        ) : data.nodeType === 'textInput' ? (
          <textarea
            value={data.inputText ?? ''}
            onChange={(e) => updateNode({ inputText: e.target.value })}
            placeholder="Enter starting text..."
            rows={3}
            className="nodrag nowheel w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-1.5 text-[14px] text-white/70 outline-none resize-none placeholder:text-white/20"
          />
        ) : (
          <>
            <ModelSelect nodeType={data.nodeType} value={data.model} onChange={(model) => updateNode({ model })} />
            <textarea
              value={data.prompt}
              onChange={(e) => updateNode({ prompt: e.target.value })}
              placeholder="Instructions for this step..."
              rows={2}
              className="nodrag nowheel w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-1.5 text-[14px] text-white/70 outline-none resize-none placeholder:text-white/20"
            />

            {data.nodeType === 'chat' && (
              <div className="flex flex-wrap gap-1.5">
                <select value={data.webSearch ?? 'off'} onChange={(e) => updateNode({ webSearch: e.target.value as 'off' | 'on' | 'auto' })} className={selectCls} title="Web search">
                  <option value="off">Search off</option>
                  <option value="on">Search on</option>
                  <option value="auto">Search auto</option>
                </select>
                <input
                  type="number"
                  value={data.temperature ?? 0.7}
                  onChange={(e) => updateNode({ temperature: parseFiniteNumber(e.target.value, 0.7) })}
                  step={0.1}
                  min={0}
                  max={2}
                  className={cn(selectCls, 'w-14')}
                  title="Temperature"
                />
                <input
                  type="number"
                  value={data.maxTokens ?? DEFAULT_CHAT_MAX_TOKENS}
                  onChange={(e) => updateNode({ maxTokens: Math.round(parseFiniteNumber(e.target.value, DEFAULT_CHAT_MAX_TOKENS)) })}
                  step={128}
                  min={64}
                  max={32768}
                  className={cn(selectCls, 'w-[78px]')}
                  title="Max tokens"
                />
              </div>
            )}

            {data.nodeType === 'imageGen' && (
              <>
                <input value={data.negativePrompt ?? ''} onChange={(e) => updateNode({ negativePrompt: e.target.value })} placeholder="Negative prompt..." className={inputCls} />
                <div className="flex gap-1.5">
                  <div className="flex-1">
                    <label className="text-[11px] text-white/30 mb-0.5 block">Steps</label>
                    <input
                      type="number"
                      value={data.steps ?? 20}
                      onChange={(e) => updateNode({ steps: Math.round(parseFiniteNumber(e.target.value, 20)) })}
                      min={1}
                      max={50}
                      className={selectCls + ' w-full'}
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[11px] text-white/30 mb-0.5 block">Size</label>
                    <select
                      value={`${data.width ?? 1024}x${data.height ?? 1024}`}
                      onChange={(e) => {
                        const [width, height] = e.target.value.split('x').map(Number)
                        updateNode({ width, height })
                      }}
                      className={selectCls + ' w-full'}
                    >
                      <option value="768x768">768 × 768</option>
                      <option value="1024x1024">1024 × 1024</option>
                      <option value="832x1216">832 × 1216 portrait</option>
                      <option value="1216x832">1216 × 832 landscape</option>
                      <option value="1024x1280">1024 × 1280 portrait</option>
                      <option value="1280x1024">1280 × 1024 landscape</option>
                    </select>
                  </div>
                </div>
                <label className="nodrag flex items-center gap-1.5 text-[12px] text-white/40 cursor-pointer self-start">
                  <input type="checkbox" checked={data.hideWatermark ?? true} onChange={(e) => updateNode({ hideWatermark: e.target.checked })} className="nodrag w-3 h-3 accent-white/60" />
                  Hide watermark
                </label>
              </>
            )}
          </>
        )}

        {data.nodeType !== 'output' && result?.status === 'done' && result.output && (
          <div className="mt-1 p-2 rounded-lg bg-green-500/[0.04] border border-green-500/[0.08] cursor-pointer" onClick={() => setOutputExpanded(!outputExpanded)}>
            <div className="flex items-center gap-1 mb-1">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-green-400/50"><polyline points={outputExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} /></svg>
              <span className="text-[11px] text-green-400/50 uppercase tracking-wider font-medium">Output</span>
            </div>
            {result.output.startsWith('[image:') ? (
              <img src={result.output.slice(7, -1)} alt="Generated" className="w-full rounded border border-white/[0.06]" />
            ) : (
              <p className={cn('text-[13px] text-white/55 leading-relaxed whitespace-pre-wrap', !outputExpanded && 'line-clamp-3')}>{result.output}</p>
            )}
          </div>
        )}

        {data.nodeType !== 'output' && result?.status === 'error' && (
          <div className="mt-1 p-2 rounded-lg bg-red-500/[0.04] border border-red-500/[0.08]">
            <span className="text-[11px] text-red-400/50 uppercase tracking-wider font-medium">Error</span>
            <p className="text-[13px] text-red-400/70 mt-0.5">{result.error}</p>
          </div>
        )}
      </div>

      {config.hasOutput && <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-white/30 !border-2 !border-[#111]" />}
    </div>
  )
}

export const WorkflowNode = memo(WorkflowNodeComponent)
