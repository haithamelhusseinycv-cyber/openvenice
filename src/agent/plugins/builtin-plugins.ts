import { LocalDreamConnector } from '../../connectors/localdream/localdream-connector'
import { FaceFusionConnector } from '../../connectors/facefusion/facefusion-connector'
import { createLocalDreamTools } from '../toolsets/localdream-tools'
import { createFaceFusionTools } from '../toolsets/facefusion-tools'
import type { AgentPluginDefinition } from './plugin-types'

export function createLocalDreamPlugin(connector = new LocalDreamConnector()): AgentPluginDefinition {
  return {
    manifest: {
      id: 'localdream',
      name: 'Local Dream',
      version: 'builtin',
      description: 'Local Snapdragon image generation, img2img, inpaint, model control, and upscale through the Local Dream localhost service.',
      capabilities: ['image-generation', 'image-edit', 'inpaint', 'upscale', 'local-model-control'],
      permissions: ['network', 'local-files', 'local-app-control'],
      entrypoint: 'builtin:localdream',
      builtIn: true,
      requiresNative: false,
    },
    createTools: () => createLocalDreamTools(connector),
    enabledByDefault: true,
  }
}

export function createFaceFusionPlugin(connector: FaceFusionConnector): AgentPluginDefinition {
  return {
    manifest: {
      id: 'facefusion',
      name: 'FaceFusion',
      version: 'builtin',
      description: 'Native Android face detection, swap, restoration, and enhancement through the signature-protected FaceFusion bridge.',
      capabilities: ['face-detection', 'face-swap', 'face-enhance', 'frame-enhance'],
      permissions: ['local-files', 'local-app-control'],
      entrypoint: 'builtin:facefusion',
      builtIn: true,
      requiresNative: true,
    },
    createTools: () => createFaceFusionTools(connector),
    enabledByDefault: true,
  }
}
