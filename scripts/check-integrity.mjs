import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

const allowedModels = await read('src/lib/allowed-models.ts')
const app = await read('src/app.tsx')
const sidebar = await read('src/components/layout/sidebar.tsx')
const workflowView = await read('src/components/workflows/workflows-view.tsx')
const workflowSchema = await read('src/lib/workflow-schema.ts')
const workflowEngine = await read('src/lib/workflow-engine.ts')
const playgroundTools = await read('src/lib/playground-agent-tools.ts')
const playgroundAgent = await read('src/lib/playground-agent.ts')
const imageView = await read('src/components/image/image-view.tsx')
const imageTools = await read('src/components/image/image-tools.tsx')
const imageToolHooks = await read('src/hooks/use-image-tools.ts')

const requiredChatModels = [
  'venice-uncensored-1-2',
  'venice-uncensored-role-play',
  'qwen-3-6-plus',
  'olafangensan-glm-4-7-flash-heretic',
]
const requiredImageModels = ['lustify-v8', 'lustify-v7', 'lustify-sdxl']
const requiredEditModels = ['qwen-edit-uncensored', 'firered-image-edit']

for (const id of [...requiredChatModels, ...requiredImageModels, ...requiredEditModels]) {
  expect(allowedModels.includes(`'${id}'`), `allowed-models.ts is missing ${id}`)
}

expect(allowedModels.includes("export const ENABLED_APP_TABS = ['chat', 'image', 'workflows', 'playground']"), 'Enabled app tabs changed unexpectedly')
expect(allowedModels.includes("export const ENABLED_WORKFLOW_NODE_TYPES = ['textInput', 'output', 'chat', 'imageGen']"), 'Enabled workflow node types changed unexpectedly')
expect(allowedModels.includes("export const DEFAULT_CHAT_MAX_TOKENS = 1024"), 'Chat max-token default is no longer 1024')
expect(allowedModels.includes("export const DEFAULT_AGENT_MAX_TOKENS = 1536"), 'Agent max-token default is no longer 1536')

const activeSurfaceText = [app, sidebar, workflowView, workflowSchema, workflowEngine, playgroundTools, playgroundAgent].join('\n')
const forbiddenLegacyModels = [
  'qwen3-next-80b',
  'llama-3.3-70b',
  'z-image-turbo',
  'tts-kokoro',
  'stable-audio',
  'wan-2.1',
]
for (const id of forbiddenLegacyModels) {
  expect(!activeSurfaceText.includes(id), `Legacy model leaked back into an active surface: ${id}`)
}

expect(imageToolHooks.includes("'/image/multi-edit'"), 'Image edit tools no longer route through /image/multi-edit')
expect(imageView.includes('safe_mode: false'), 'Image Generate lost safe_mode: false')
expect(imageView.includes('enhance_prompt: false'), 'Image Generate lost enhance_prompt: false')
expect(imageTools.includes('safe_mode: false'), 'Image Tools lost safe_mode: false')
expect(imageTools.includes('enhance_prompt: false'), 'Image Tools lost enhance_prompt: false')
expect(!imageView.includes('moderation:'), 'Unsupported moderation field was added to Image Generate')
expect(!imageTools.includes('moderation:'), 'Unsupported moderation field was added to Image Tools')

expect(imageTools.includes('swapConfirmed'), 'Swap permission confirmation is missing')
expect(imageTools.includes('undressConfirmed'), 'Undress adult/permission confirmation is missing')

if (failures.length > 0) {
  console.error('Customized build integrity check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Customized build integrity check passed.')
}
