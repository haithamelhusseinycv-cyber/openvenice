import { LocalDreamConnector } from '../../connectors/localdream/localdream-connector'
import { FaceFusionConnector } from '../../connectors/facefusion/facefusion-connector'
import { GithubConnector } from '../../connectors/github/github-connector'
import { GraphConnector } from '../../connectors/microsoft-graph/graph-connector'
import { ResearchConnector } from '../../connectors/research/research-connector'
import { createLocalDreamTools } from '../toolsets/localdream-tools'
import { createFaceFusionTools } from '../toolsets/facefusion-tools'
import { createGithubTools } from '../toolsets/github-tools'
import { createGraphTools } from '../toolsets/graph-tools'
import { createResearchTools } from '../toolsets/research-tools'
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

export function createGithubPlugin(connector = new GithubConnector()): AgentPluginDefinition {
  return {
    manifest: {
      id: 'github',
      name: 'GitHub',
      version: 'builtin',
      description: 'Read-only GitHub repository, issue, pull request, commit, and CI insight through the host-side GitHub connector. Requires GITHUB_TOKEN on the OpenVenice host. The token never enters the browser bundle or model context.',
      capabilities: ['repo-search', 'issue-insight', 'pull-insight', 'commit-insight', 'ci-status'],
      permissions: ['network', 'account-read'],
      entrypoint: 'builtin:github',
      builtIn: true,
      requiresNative: false,
    },
    createTools: () => createGithubTools(connector),
    enabledByDefault: true,
  }
}

export function createGraphPlugin(connector = new GraphConnector()): AgentPluginDefinition {
  return {
    manifest: {
      id: 'microsoft-graph',
      name: 'Microsoft Graph',
      version: 'builtin',
      description: 'Read-only Outlook mail, calendar, contacts, OneDrive, and SharePoint through the host-side Microsoft Graph connector. Requires MICROSOFT_GRAPH_TOKEN on the OpenVenice host. The token never enters the browser bundle or model context.',
      capabilities: ['outlook-mail', 'calendar', 'contacts', 'onedrive', 'sharepoint'],
      permissions: ['network', 'account-read'],
      entrypoint: 'builtin:microsoft-graph',
      builtIn: true,
      requiresNative: false,
    },
    createTools: () => createGraphTools(connector),
    enabledByDefault: true,
  }
}

export function createResearchPlugin(connector = new ResearchConnector()): AgentPluginDefinition {
  return {
    manifest: {
      id: 'research',
      name: 'Research',
      version: 'builtin',
      description: 'Web search and URL extraction with Exa as primary and Tavily as fallback. Requires EXA_API_KEY or TAVILY_API_KEY on the OpenVenice host. Keys never enter the browser bundle or model context.',
      capabilities: ['web-search', 'url-extract', 'citations'],
      permissions: ['network'],
      entrypoint: 'builtin:research',
      builtIn: true,
      requiresNative: false,
    },
    createTools: () => createResearchTools(connector),
    enabledByDefault: true,
  }
}
