import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkflowStore, type VeniceNodeData, type VeniceNodeType } from '../../stores/workflow-store'
import { WorkflowNode } from './workflow-node'
import { executeWorkflow } from '../../lib/workflow-engine'
import {
  DEFAULT_CHAT_MAX_TOKENS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
} from '../../lib/allowed-models'
import { generateId } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { toast } from '../../stores/toast-store'

const nodeTypes = { venice: WorkflowNode }

function PaletteInputIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 9 8 12 2 12" /></svg>
}
function PaletteChatIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
}
function PaletteImageIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
}
function PaletteOutputIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 12h8M12 8v8" /></svg>
}

const NODE_PALETTE: Array<{ type: VeniceNodeType; label: string; Icon: () => React.JSX.Element; color: string }> = [
  { type: 'textInput', label: 'Input', Icon: PaletteInputIcon, color: 'text-blue-400/50' },
  { type: 'chat', label: 'LLM', Icon: PaletteChatIcon, color: 'text-purple-400/50' },
  { type: 'imageGen', label: 'Image Gen', Icon: PaletteImageIcon, color: 'text-pink-400/50' },
  { type: 'output', label: 'Output', Icon: PaletteOutputIcon, color: 'text-white/40' },
]

function defaultData(nodeType: VeniceNodeType): VeniceNodeData {
  if (nodeType === 'chat') {
    return {
      label: 'LLM',
      nodeType,
      model: DEFAULT_CHAT_MODEL_ID,
      prompt: '',
      temperature: 0.7,
      maxTokens: DEFAULT_CHAT_MAX_TOKENS,
      webSearch: 'off',
    }
  }
  if (nodeType === 'imageGen') {
    return {
      label: 'Image Gen',
      nodeType,
      model: DEFAULT_IMAGE_MODEL_ID,
      prompt: '',
      negativePrompt: '',
      steps: 20,
      width: 1024,
      height: 1024,
      hideWatermark: true,
    }
  }
  if (nodeType === 'textInput') {
    return { label: 'Input', nodeType, model: '', prompt: '', inputText: '' }
  }
  return { label: 'Output', nodeType: 'output', model: '', prompt: '' }
}

type VNode = Node<VeniceNodeData>
type TemplateGraph = { nodes: VNode[]; edges: Edge[] }

const mkIds = (n: number) => Array.from({ length: n }, () => generateId())
const mkEdge = (source: string, target: string): Edge => ({ id: `e-${source}-${target}`, source, target, animated: true })

const TEMPLATES: Array<{ name: string; desc: string; build: () => TemplateGraph }> = [
  {
    name: 'Album Cover',
    desc: 'Concept → art direction → cover artwork',
    build: () => {
      const [a, b, c, d] = mkIds(4)
      return {
        nodes: [
          { id: a, type: 'venice', position: { x: 280, y: 40 }, data: { ...defaultData('textInput'), inputText: 'A melancholic indie-folk album about leaving a small coastal town' } },
          { id: b, type: 'venice', position: { x: 280, y: 220 }, data: { ...defaultData('chat'), prompt: 'You are an art director. Turn this concept into one vivid image-generation prompt describing mood, composition, subject, environment, camera, lighting, and texture. Output only the prompt.', temperature: 0.8 } },
          { id: c, type: 'venice', position: { x: 280, y: 440 }, data: { ...defaultData('imageGen'), prompt: '{{input}}', steps: 30 } },
          { id: d, type: 'venice', position: { x: 280, y: 680 }, data: defaultData('output') },
        ],
        edges: [mkEdge(a, b), mkEdge(b, c), mkEdge(c, d)],
      }
    },
  },
  {
    name: 'Character Portrait',
    desc: 'Character concept → visual brief → portrait',
    build: () => {
      const [a, b, c, d] = mkIds(4)
      return {
        nodes: [
          { id: a, type: 'venice', position: { x: 280, y: 40 }, data: { ...defaultData('textInput'), inputText: 'A disillusioned space-station botanist in her 50s, caretaker of the last Earth plants' } },
          { id: b, type: 'venice', position: { x: 280, y: 220 }, data: { ...defaultData('chat'), prompt: 'Write one dense visual portrait brief: physical appearance, clothing, posture, expression, lens, lighting, background, and realistic surface detail. Output only the image prompt.', temperature: 0.8 } },
          { id: c, type: 'venice', position: { x: 280, y: 460 }, data: { ...defaultData('imageGen'), prompt: 'Portrait, realistic photography: {{input}}', steps: 30, width: 832, height: 1216 } },
          { id: d, type: 'venice', position: { x: 280, y: 700 }, data: defaultData('output') },
        ],
        edges: [mkEdge(a, b), mkEdge(b, c), mkEdge(c, d)],
      }
    },
  },
  {
    name: 'Story Scene',
    desc: 'Premise → cinematic visual prompt → image',
    build: () => {
      const [a, b, c, d] = mkIds(4)
      return {
        nodes: [
          { id: a, type: 'venice', position: { x: 280, y: 40 }, data: { ...defaultData('textInput'), inputText: 'A lighthouse keeper finds a message in a bottle from her younger self' } },
          { id: b, type: 'venice', position: { x: 280, y: 220 }, data: { ...defaultData('chat'), prompt: 'Turn this premise into a cinematic still-image prompt with setting, time of day, weather, subject pose, camera angle, lens, lighting, and mood. Avoid plot narration.', temperature: 0.85 } },
          { id: c, type: 'venice', position: { x: 280, y: 460 }, data: { ...defaultData('imageGen'), prompt: '{{input}}', steps: 30, width: 1216, height: 832 } },
          { id: d, type: 'venice', position: { x: 280, y: 700 }, data: defaultData('output') },
        ],
        edges: [mkEdge(a, b), mkEdge(b, c), mkEdge(c, d)],
      }
    },
  },
  {
    name: 'Prompt Refiner',
    desc: 'Rough idea → refined image prompt → image',
    build: () => {
      const [a, b, c, d] = mkIds(4)
      return {
        nodes: [
          { id: a, type: 'venice', position: { x: 280, y: 40 }, data: { ...defaultData('textInput'), inputText: 'A candid rainy-night street photo with strong reflections and natural motion blur' } },
          { id: b, type: 'venice', position: { x: 280, y: 220 }, data: { ...defaultData('chat'), prompt: 'Refine this into a precise photorealistic image prompt. Preserve the core idea and add concrete camera, composition, lighting, material, and texture details. Output only the prompt.', temperature: 0.6 } },
          { id: c, type: 'venice', position: { x: 280, y: 440 }, data: { ...defaultData('imageGen'), prompt: '{{input}}' } },
          { id: d, type: 'venice', position: { x: 280, y: 680 }, data: defaultData('output') },
        ],
        edges: [mkEdge(a, b), mkEdge(b, c), mkEdge(c, d)],
      }
    },
  },
]

function WorkflowCanvas() {
  const { activeWorkflowId, workflows, updateWorkflow, updateNodeResult, setIsRunning, isRunning, clearResults } = useWorkflowStore()
  const workflow = workflows.find((w) => w.id === activeWorkflowId)

  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes ?? [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges ?? [])
  const { getNodes, getEdges } = useReactFlow()

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const debouncedSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (activeWorkflowId) {
        updateWorkflow(activeWorkflowId, { nodes: getNodes() as Node<VeniceNodeData>[], edges: getEdges() })
      }
    }, 200)
  }, [activeWorkflowId, updateWorkflow, getNodes, getEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge({ ...connection, animated: true }, current))
      debouncedSave()
    },
    [setEdges, debouncedSave],
  )

  const addNode = (nodeType: VeniceNodeType) => {
    if (!NODE_PALETTE.some((item) => item.type === nodeType)) return
    const newNode: Node<VeniceNodeData> = {
      id: generateId(),
      type: 'venice',
      position: { x: 250 + Math.random() * 100, y: 100 + nodes.length * 180 },
      data: defaultData(nodeType),
    }
    setNodes((current) => [...current, newNode])
    debouncedSave()
  }

  const handleRun = async () => {
    if (isRunning) return
    const currentNodes = getNodes() as Node<VeniceNodeData>[]
    const currentEdges = getEdges()
    if (currentNodes.length === 0) return

    if (activeWorkflowId) updateWorkflow(activeWorkflowId, { nodes: currentNodes, edges: currentEdges })

    clearResults()
    setIsRunning(true)
    const initial: Record<string, { nodeId: string; status: 'pending'; output: undefined; error: undefined }> = {}
    for (const node of currentNodes) {
      initial[node.id] = { nodeId: node.id, status: 'pending', output: undefined, error: undefined }
    }
    useWorkflowStore.getState().setRunResults(initial)

    try {
      await executeWorkflow(currentNodes, currentEdges, { onUpdate: updateNodeResult })
      toast.success('Workflow completed')
    } catch (err) {
      toast.fromError(err, 'Workflow failed')
    } finally {
      setIsRunning(false)
    }
  }

  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      debouncedSave()
    },
    [onNodesChange, debouncedSave],
  )

  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes)
      debouncedSave()
    },
    [onEdgesChange, debouncedSave],
  )

  const memoNodeTypes = useMemo(() => nodeTypes, [])

  if (!workflow) return null

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-white/[0.06] bg-[#0a0a0a] flex flex-col shrink-0">
        <div className="p-3 border-b border-white/[0.06]">
          <span className="text-[13px] font-medium text-white/35 uppercase tracking-[0.08em]">Add Node</span>
        </div>
        <div className="p-2 flex flex-col gap-1">
          {NODE_PALETTE.map((item) => (
            <button
              key={item.type}
              onClick={() => addNode(item.type)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[14px] text-white/55 hover:text-white/85 hover:bg-white/[0.04] transition-colors text-left"
            >
              <span className={item.color}><item.Icon /></span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[14px] font-medium transition-all',
              isRunning
                ? 'bg-white/[0.06] text-white/30 cursor-wait'
                : 'bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed',
            )}
          >
            {isRunning ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Run Workflow
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={memoNodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-[#080808]"
          defaultEdgeOptions={{ animated: true, style: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.03)" />
          <Controls className="!bg-[#111] !border-white/[0.06] !shadow-xl [&>button]:!bg-[#111] [&>button]:!border-white/[0.06] [&>button]:!text-white/30 [&>button:hover]:!bg-white/[0.06]" />
          <MiniMap
            nodeColor="rgba(255,255,255,0.1)"
            maskColor="rgba(0,0,0,0.8)"
            className="!bg-[#0a0a0a] !border-white/[0.06]"
          />
        </ReactFlow>
      </div>
    </div>
  )
}

export function WorkflowsView() {
  const { workflows, activeWorkflowId, createWorkflow, deleteWorkflow, setActiveWorkflow } = useWorkflowStore()
  const [newName, setNewName] = useState('')

  const handleCreate = (name?: string, template?: (typeof TEMPLATES)[number]) => {
    const workflowName = name?.trim() || 'Untitled Workflow'
    const id = createWorkflow(workflowName)
    if (template) {
      const { nodes, edges } = template.build()
      useWorkflowStore.getState().updateWorkflow(id, { nodes, edges })
    }
    setNewName('')
  }

  if (activeWorkflowId && workflows.find((w) => w.id === activeWorkflowId)) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2.5 px-3 py-1.5 border-b border-white/[0.06] bg-[#0a0a0a] shrink-0">
          <button onClick={() => setActiveWorkflow(null)} className="text-[13px] text-white/45 hover:text-white/75 transition-colors flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="w-px h-3.5 bg-white/[0.06]" />
          <span className="text-[14px] text-white/65 font-medium">{workflows.find((w) => w.id === activeWorkflowId)?.name}</span>
        </div>
        <div className="flex-1 min-h-0">
          <ReactFlowProvider>
            <WorkflowCanvas key={activeWorkflowId} />
          </ReactFlowProvider>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-[16px] text-white/75 font-medium mb-1">Workflows</h2>
        <p className="text-[13px] text-white/40 mb-6">Chain the configured Chat and Image models visually.</p>

        <div className="flex gap-2 mb-6">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate(newName)}
            placeholder="Workflow name..."
            className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[15px] text-white/70 outline-none placeholder:text-white/25 focus:border-white/[0.12]"
          />
          <button onClick={() => handleCreate(newName)} className="text-[14px] font-medium px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition-colors">
            New Workflow
          </button>
        </div>

        <h3 className="text-[13px] font-medium text-white/35 uppercase tracking-[0.08em] mb-3">Templates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {TEMPLATES.map((template) => (
            <button
              key={template.name}
              onClick={() => handleCreate(template.name, template)}
              className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all text-left"
            >
              <div className="text-[15px] text-white/70 font-medium mb-1">{template.name}</div>
              <div className="text-[13px] text-white/35">{template.desc}</div>
            </button>
          ))}
        </div>

        {workflows.length > 0 && (
          <>
            <h3 className="text-[13px] font-medium text-white/35 uppercase tracking-[0.08em] mb-3">Saved Workflows</h3>
            <div className="flex flex-col gap-2">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] transition-all cursor-pointer"
                  onClick={() => setActiveWorkflow(workflow.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] text-white/70 font-medium truncate">{workflow.name}</div>
                    <div className="text-[13px] text-white/30">{workflow.nodes.length} nodes</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWorkflow(workflow.id) }}
                    className="text-[13px] text-white/30 hover:text-red-400/70 transition-colors px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
