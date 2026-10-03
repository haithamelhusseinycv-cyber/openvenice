import { beforeEach, expect, it } from 'vitest'
import { useImageWorkspace } from './image-workspace-store'

beforeEach(() => useImageWorkspace.setState({ generatedImages: [], imageSubTab: 'generate', pendingSource: null }))

it('retains generated images when handing off to a tool and returning', () => {
  useImageWorkspace.getState().addGeneratedImages(['first'])
  useImageWorkspace.getState().sendToTool('edit', 'data:image/png;base64,first')
  useImageWorkspace.getState().consumePendingSource()
  useImageWorkspace.getState().setImageSubTab('generate')
  expect(useImageWorkspace.getState().generatedImages).toEqual(['first'])
})

it('accepts a result after navigation and caps the gallery at two images', () => {
  useImageWorkspace.getState().addGeneratedImages(['old'])
  useImageWorkspace.getState().setImageSubTab('tools')
  useImageWorkspace.getState().addGeneratedImages(['newest', 'second'])
  expect(useImageWorkspace.getState().generatedImages).toEqual(['newest', 'second'])
})
