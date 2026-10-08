import { ImageShapePicker } from '../ui/image-shape-picker';
import { DEFAULT_IMAGE_SHAPES, shapePixels } from '../../lib/image-shapes';
import { FullscreenButton } from '../ui/fullscreen-button';
import { useState, useMemo, useEffect, useRef } from 'react';
import type { ImageToolId } from '../../stores/image-workspace-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useModels } from '../../hooks/use-models';
import { useImageGenerate } from '../../hooks/use-image';
import { useAuthStore } from '../../stores/auth-store';
import { useImageWorkspace } from '../../stores/image-workspace-store';
import { useContentStore } from '../../stores/content-store';
import { useAnalyticsStore } from '../../stores/analytics-store';
import { DEFAULT_IMAGE_MODEL_ID, isAllowedImageModel } from '../../lib/allowed-models';
import { LOCKED_IMAGE_SIZE_IDX, LOCKED_IMAGE_STEPS, LOCKED_IMAGE_VARIANTS, loadImageNegative, loadImagePrompt, pickAspectFromPrompt } from '../../lib/defaults';
import { formatVeniceError } from '../../lib/venice-client';
import { saveImage, shareImage, defaultImageFileName } from '../../lib/native-media';
import { haptic } from '../../lib/haptics';
import { toast } from '../../stores/toast-store';
import { Label, TextArea, PrimaryButton, PillGroup, ErrorText } from '../ui/shared';
import { GenerationView } from '../ui/generation-view';
import { BottomSheet } from '../ui/bottom-sheet';
import { TaskProgress } from '../ui/task-progress';
import { QualityPresetPicker } from '../ui/quality-preset-picker';
import { BatchProgress } from '../ui/batch-progress';
import { ContentGallery } from '../ui/content-gallery';
import { PromptEnhancer } from '../ui/prompt-enhancer';
import { PromptInspiration } from '../ui/prompt-inspiration';
import { VoiceInput } from '../ui/voice-input';
import { usePromptHistory, PromptHistoryList } from '../ui/prompt-history';
import { SmartVariations } from '../ui/smart-variations';
import { MetadataOverlay, useMetadataToggle } from '../ui/image-metadata-overlay';
import { QuickActionsMenu, useLongPress } from '../ui/quick-actions-menu';
import { AccentColorPicker, useAccentColor } from '../ui/accent-color-picker';
import { GenerationStats } from '../ui/generation-stats';
import { ImageDropZone } from '../ui/image-drop-zone';

import { PromptTemplates } from '../ui/prompt-templates';
import { SmartNegativeSuggester } from '../ui/smart-negative-suggester';
import { ComparisonGrid } from '../ui/comparison-grid';

import { PromptTranslator } from '../ui/prompt-translator';
import { PromptCardExport } from '../ui/prompt-card-export';
import { ImageToPrompt } from '../ui/image-to-prompt';
import { PromptScorer } from '../ui/prompt-scorer';
import { useSeedTracker, SeedTrackerDisplay } from '../ui/seed-tracker';
import { useAutoQueue } from '../ui/auto-queue-variations';
import { PromptChainBuilder } from '../ui/prompt-chains';
import { ABTestPanel } from '../ui/ab-testing';
import { usePromptVersions, PromptVersionHistory } from '../ui/prompt-versioning';
import { useKeyboardShortcuts, ShortcutHelpModal } from '../ui/keyboard-shortcuts';
import { ShareableRecipe, useRecipeFromUrl } from '../ui/shareable-recipe';
import { CommunityPromptBrowser } from '../ui/community-prompts';
import { RecipeImport } from '../ui/recipe-export';
import { useSessionRestore, SessionRestorePrompt } from '../ui/session-restore';
import { useImageFavorites, FavoritesGallery } from '../ui/image-favorites';
import { PromptWeightEditor } from '../ui/prompt-weighting';
import { useOfflineQueue, OfflineQueueIndicator, OfflineQueueList } from '../ui/offline-queue';
import { SwipeableTabs } from '../ui/swipeable-tabs';
import { TabTransition } from '../ui/tab-transitions';
import { useFeatureTracker } from '../ui/feature-tracker';
import { FeatureSearch } from '../ui/feature-search';
import { FeatureOrdering } from '../ui/feature-ordering';
import { ContextualSuggestions } from '../ui/contextual-suggestions';
import { SmartGrouping } from '../ui/smart-grouping';
import { usePredictiveLoader } from '../ui/predictive-loader';
import { PresetSharing } from '../ui/preset-sharing';
import { enhancePromptWithPreset, buildPresetNegativePrompt, type NSFWPreset } from '../../lib/nsfw-quality-presets';
import { classifyContent } from '../../lib/nsfw-content-classifier';
import type { ImageConstraints } from '../../types/venice';

function loadSaved(key: string, fallback: string) {
  try {
    const saved = localStorage.getItem(key)
    return saved ?? fallback
  } catch {
    return fallback
  }
}

function toImageSrc(b64: string): string {
  if (/^(data:|https?:|blob:)/.test(b64)) return b64
  if (b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`
  if (b64.startsWith('iVBOR')) return `data:image/png;base64,${b64}`
  if (b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`
  return `data:image/png;base64,${b64}`
}

const DEFAULT_SIZES = [
  { value: '0', label: '512' },
  { value: '1', label: '768' },
  { value: '2', label: '1024' },
  { value: '3', label: '1280' },
]

type TabId = 'generate' | 'tools' | 'library' | 'advanced'

interface ExpandableSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function ExpandableSection({ title, defaultOpen = false, children }: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => { haptic('tap'); setOpen(!open) }}
        className="flex w-full items-center justify-between px-3.5 py-3 text-[14px] text-white/75 hover:text-white"
      >
        <span className="font-medium">{title}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-3.5 pb-3 pt-1 border-t border-white/[0.06]">{children}</div>}
    </div>
  )
}

interface FeatureMenuProps {
  title: string
  icon: React.ReactNode
  items: { label: string; onClick: () => void; disabled?: boolean; badge?: string }[]
}

function FeatureMenu({ title, icon, items }: FeatureMenuProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => { haptic('tap'); setOpen(!open) }}
        className="flex w-full items-center justify-between px-3.5 py-3 text-[14px] text-white/75 hover:text-white"
      >
        <span className="flex items-center gap-2 font-medium">{icon}{title}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-white/[0.06] space-y-1">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { item.onClick(); setOpen(false) }}
              disabled={item.disabled}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{item.label}</span>
              {item.badge && <span className="text-[11px] text-white/40">{item.badge}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const FEATURE_LIST_BASE = [
  { id: 'image-to-prompt', label: 'Image to Prompt', category: 'Prompt Tools', keywords: ['reverse', 'extract', 'vision'] },
  { id: 'prompt-scorer', label: 'Prompt Scorer', category: 'Prompt Tools', keywords: ['quality', 'rate', 'score'] },
  { id: 'prompt-weights', label: 'Prompt Weights', category: 'Prompt Tools', keywords: ['weight', 'emphasis', 'boost'] },
  { id: 'prompt-templates', label: 'Prompt Templates', category: 'Prompt Tools', keywords: ['template', 'preset', 'variable'] },
  { id: 'smart-variations', label: 'Smart Variations', category: 'Variations', keywords: ['vary', 'different', 'alternative'] },
  { id: 'ab-testing', label: 'A/B Testing', category: 'Variations', keywords: ['compare', 'test', 'experiment'] },
  { id: 'prompt-chains', label: 'Prompt Chains', category: 'Variations', keywords: ['chain', 'pipeline', 'sequence'] },
  { id: 'import-image', label: 'Import Image', category: 'Import/Export', keywords: ['upload', 'photo', 'file'] },
  { id: 'import-recipe', label: 'Import Recipe', category: 'Import/Export', keywords: ['json', 'settings', 'load'] },
  { id: 'batch-export', label: 'Batch Export', category: 'Import/Export', keywords: ['zip', 'download', 'bulk'] },
  { id: 'prompt-history', label: 'Prompt History', category: 'Library', keywords: ['history', 'recent', 'past'] },
  { id: 'favorites', label: 'Favorites', category: 'Library', keywords: ['star', 'bookmark', 'saved'] },
  { id: 'seed-tracker', label: 'Seed Tracker', category: 'Library', keywords: ['seed', 'track', 'best'] },
  { id: 'community-prompts', label: 'Community Prompts', category: 'Library', keywords: ['community', 'shared', 'browse'] },
  { id: 'compare-grid', label: 'Compare Grid', category: 'Review', keywords: ['compare', 'grid', 'side-by-side'] },
  { id: 'generation-stats', label: 'Generation Stats', category: 'Review', keywords: ['stats', 'analytics', 'dashboard'] },
  { id: 'prompt-versions', label: 'Prompt Versions', category: 'Advanced', keywords: ['version', 'history', 'diff'] },
  { id: 'session-restore', label: 'Session Restore', category: 'Advanced', keywords: ['session', 'restore', 'recover'] },
  { id: 'accent-color', label: 'Accent Color', category: 'Customization', keywords: ['color', 'theme', 'accent'] },
  { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', category: 'Customization', keywords: ['keyboard', 'shortcut', 'hotkey'] },
  { id: 'offline-queue', label: 'Offline Queue', category: 'Queue', keywords: ['offline', 'queue', 'pending'] },
]

export function ImageView() {
  const apiKey = useAuthStore((s) => s.apiKey)
  const selectedModel = useSettingsStore((s) => s.selectedModels.image)
  const { data: models } = useModels('image')
  const allowedImageModels = models?.filter((m) => isAllowedImageModel(m.id, m.model_spec?.uncensored))
  const addContentItem = useContentStore((s) => s.addItem)
  const trackGeneration = useAnalyticsStore((s) => s.trackGeneration)

  const [nsfwPreset, setNsfwPreset] = useState<NSFWPreset>('neutral')
  const [presetPickerOpen, setPresetPickerOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('generate')
  const [featureSearchOpen, setFeatureSearchOpen] = useState(false)
  const [featureOrderingOpen, setFeatureOrderingOpen] = useState(false)
  const [presetSharingOpen, setPresetSharingOpen] = useState(false)
  const [smartGroupingEnabled, setSmartGroupingEnabled] = useState(false)
  const [suggestionsDismissed] = useState(() => loadSaved('chilli-suggestions-dismissed', '') === 'true')

  const featureTracker = useFeatureTracker()
  void usePredictiveLoader(['generate', 'tools', 'library', 'advanced']);

  const trackFeature = (featureId: string) => {
    featureTracker.trackFeature(featureId)
  }

  const model =
    selectedModel &&
    allowedImageModels?.some((m) => m.id === selectedModel)
      ? selectedModel
      : allowedImageModels?.[0]?.id || DEFAULT_IMAGE_MODEL_ID

  const modelData = models?.find((m) => m.id === model)
  const constraints = modelData?.model_spec?.constraints as ImageConstraints | undefined
  const hasAspectRatios = constraints?.aspectRatios && constraints.aspectRatios.length > 0
  const hasResolutions = constraints?.resolutions && constraints.resolutions.length > 0
  const maxSteps = constraints?.steps?.max || 50
  const defaultSteps = constraints?.steps?.default || LOCKED_IMAGE_STEPS
  const promptLimit = constraints?.promptCharacterLimit || 4096

  const [prompt, setPrompt] = useState(() =>
    loadImagePrompt(loadSaved('venice-image-prompt', ''))
  )
  const [negativePrompt, setNegativePrompt] = useState(() =>
    loadImageNegative(loadSaved('venice-image-negative', ''))
  )
  const [sizeIdx, setSizeIdx] = useState(() => loadSaved('venice-image-size', LOCKED_IMAGE_SIZE_IDX))
  const [aspectRatio, setAspectRatio] = useState(() => loadSaved('venice-image-aspect', pickAspectFromPrompt(loadImagePrompt(loadSaved('venice-image-prompt', '')))))
  const [resolution, setResolution] = useState(() => loadSaved('venice-image-resolution', ''))
  const [steps, setSteps] = useState(() => {
    const saved = loadSaved('venice-image-steps', '')
    const n = Number(saved)
    return Number.isFinite(n) && n > 0 ? n : defaultSteps
  })
  const [seed, setSeed] = useState(() => loadSaved('venice-image-seed', ''))
  const [variants, setVariants] = useState(LOCKED_IMAGE_VARIANTS)
  const images = useImageWorkspace((s) => s.generatedImages)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try { sessionStorage.removeItem('venice-image-gallery') } catch { /* private mode */ }
  }, [])

  const effectiveAspectRatio = useMemo(() => {
    const suggested = pickAspectFromPrompt(prompt)
    if (!hasAspectRatios) return DEFAULT_IMAGE_SHAPES.includes(aspectRatio) ? aspectRatio : suggested
    const supported = constraints?.aspectRatios || []
    if (supported.includes(aspectRatio)) return aspectRatio
    if (supported.includes(suggested)) return suggested
    if (constraints?.defaultAspectRatio && supported.includes(constraints.defaultAspectRatio)) {
      return constraints.defaultAspectRatio
    }
    return supported[0] || suggested
  }, [aspectRatio, constraints, hasAspectRatios, prompt])

  const effectiveResolution = useMemo(() => {
    if (!hasResolutions) return ''
    const supported = constraints?.resolutions || []
    if (supported.includes(resolution)) return resolution
    if (constraints?.defaultResolution && supported.includes(constraints.defaultResolution)) {
      return constraints.defaultResolution
    }
    return supported[0] || ''
  }, [constraints, hasResolutions, resolution])

  const effectiveSteps = Math.max(1, Math.min(steps, maxSteps))

  const updatePrompt = (value: string) => {
    setPrompt(value)
  }

  useEffect(() => {
    try {
      localStorage.setItem('venice-image-prompt', prompt)
      localStorage.setItem('venice-image-negative', negativePrompt)
      localStorage.setItem('venice-image-size', sizeIdx)
      localStorage.setItem('venice-image-aspect', effectiveAspectRatio)
      localStorage.setItem('venice-image-resolution', effectiveResolution)
      localStorage.setItem('venice-image-steps', String(effectiveSteps))
      localStorage.setItem('venice-image-seed', seed)
    } catch {
      // Ignore quota / private-mode storage errors
    }
  }, [prompt, negativePrompt, sizeIdx, effectiveAspectRatio, effectiveResolution, effectiveSteps, seed])

  const sendToTool = useImageWorkspace((s) => s.sendToTool)
  const [undressTarget, setOutfitTarget] = useState<{ src: string; name: string } | null>(null)
  const viewerTouch = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onBack = (e: Event) => {
      if (undressTarget) {
        e.preventDefault()
        setOutfitTarget(null)
        return
      }
      if (selectedIndex !== null) {
        e.preventDefault()
        setSelectedIndex(null)
      }
    }
    window.addEventListener('venice-back', onBack)
    return () => window.removeEventListener('venice-back', onBack)
  }, [selectedIndex, undressTarget])

  const aspectValues = hasAspectRatios ? constraints!.aspectRatios! : DEFAULT_IMAGE_SHAPES

  const resolutionOptions = useMemo(() => {
    if (!hasResolutions) return []
    return constraints!.resolutions!.map((r) => ({ value: r, label: r }))
  }, [constraints, hasResolutions])

  const fileName = (index?: number) =>
    `generated${index !== undefined ? `-${index + 1}` : ''}.png`

  const sendGenerated = (tool: ImageToolId, b64: string, index?: number) => {
    sendToTool(tool, toImageSrc(b64), fileName(index))
  }

  const confirmOutfit = () => {
    if (!undressTarget) return
    sendToTool('undress', undressTarget.src, undressTarget.name)
    setOutfitTarget(null)
    setSelectedIndex(null)
  }

  const [mediaBusy, setMediaBusy] = useState<'save' | 'share' | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [variationsOpen, setVariationsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [accentOpen, setAccentOpen] = useState(false)
  const [dropZoneOpen, setDropZoneOpen] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [imageToPromptOpen, setImageToPromptOpen] = useState(false)
  const [scorerOpen, setScorerOpen] = useState(false)
  const [seedTrackerOpen, setSeedTrackerOpen] = useState(false)
  const [abTestOpen, setAbTestOpen] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)
  const [versioningOpen, setVersioningOpen] = useState(false)
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)
  const [recipeImportOpen, setRecipeImportOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [weightingOpen, setWeightingOpen] = useState(false)
  const [offlineQueueOpen, setOfflineQueueOpen] = useState(false)
  const [promptScore, setPromptScore] = useState<{ score: number; feedback: string } | null>(null)

  const metadataToggle = useMetadataToggle()
  const { accentColor, setAccentColor } = useAccentColor()
  const longPress = useLongPress()
  const { history, saveToHistory, toggleFavorite, clearHistory } = usePromptHistory()
  const seedTracker = useSeedTracker()
  void useAutoQueue();
  const promptVersions = usePromptVersions()
  const imageFavorites = useImageFavorites()
  const offlineQueue = useOfflineQueue()
  const sessionRestore = useSessionRestore()
  const recipeFromUrl = useRecipeFromUrl()

  useKeyboardShortcuts((action: string) => {
    switch (action) {
      case 'generate': handleGenerate(); break
      case 'clear': setPrompt(''); setNegativePrompt(''); mutation.reset(); break
      case 'history': setHistoryOpen(true); break
      case 'favorites': setFavoritesOpen(true); break
      case 'community': setCommunityOpen(true); break
      case 'shortcuts': setShortcutHelpOpen(true); break
      case 'versioning': setVersioningOpen(true); break
    }
  })

  useEffect(() => {
    if (recipeFromUrl) {
      updatePrompt(recipeFromUrl.prompt)
      if (recipeFromUrl.negative) setNegativePrompt(recipeFromUrl.negative)
      if (recipeFromUrl.model) useSettingsStore.getState().setSelectedModel('image', recipeFromUrl.model)
      if (recipeFromUrl.steps) setSteps(recipeFromUrl.steps)
      if (recipeFromUrl.seed !== undefined) setSeed(String(recipeFromUrl.seed))
      if (recipeFromUrl.aspectRatio) setAspectRatio(recipeFromUrl.aspectRatio)
      toast.success('Recipe loaded', 'Settings imported from shared URL')
    }
  }, [recipeFromUrl])

  const saveGenerated = async (b64: string, index?: number) => {
    if (mediaBusy) return
    setMediaBusy('save')
    try {
      const src = toImageSrc(b64)
      const name = defaultImageFileName(`gen-${index ?? 0}-${Date.now()}`, 'image/jpeg')
      const result = await saveImage(src, 'image/jpeg', name)
      haptic('success')
      toast.success(result.destination === 'gallery' ? 'Saved to gallery' : 'Download started', result.fileName || name)
    } catch (error) {
      toast.fromError(error, 'Could not save image')
    } finally {
      setMediaBusy(null)
    }
  }

  const shareGenerated = async (b64: string, index?: number) => {
    if (mediaBusy) return
    setMediaBusy('share')
    try {
      const src = toImageSrc(b64)
      const name = defaultImageFileName(`gen-${index ?? 0}-${Date.now()}`, 'image/jpeg')
      const result = await shareImage(src, 'image/jpeg', name)
      haptic('success')
      if (result === 'saved') toast.info('Sharing unavailable', 'Image saved to gallery instead.')
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.fromError(error, 'Could not share image')
      }
    } finally {
      setMediaBusy(null)
    }
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const mutation = useImageGenerate()
  const generateAsync = mutation.mutateAsync
  const registerProcessor = offlineQueue.setProcessor
  useEffect(() => {
    registerProcessor(async item => {
      await generateAsync(item.request as unknown as Parameters<typeof generateAsync>[0] || { prompt: item.prompt, negative_prompt: item.negativePrompt, model: item.model, steps: item.steps, seed: item.seed, aspect_ratio: item.aspectRatio })
    })
  }, [registerProcessor, generateAsync])
  const promptTooLong = prompt.length > promptLimit

  const handleGenerate = () => {
    if (!prompt.trim() || promptTooLong) return
    mutation.reset()
    const seedNum = seed.trim() === '' ? undefined : Number(seed)
    const validSeed = seedNum !== undefined && Number.isFinite(seedNum) ? Math.trunc(seedNum) : undefined
    const size = shapePixels(effectiveAspectRatio, Number(DEFAULT_SIZES.find((option) => option.value === sizeIdx)?.label || 1024), constraints?.widthHeightDivisor)

    const enhancedPrompt = enhancePromptWithPreset(prompt.trim(), nsfwPreset)
    const enhancedNegative = buildPresetNegativePrompt(nsfwPreset, negativePrompt.trim())

    const req: Record<string, unknown> = {
      prompt: enhancedPrompt,
      negative_prompt: enhancedNegative || undefined,
      model,
      variants,
      hide_watermark: true,
      format: 'jpeg',
      safe_mode: false,
      enhance_prompt: false,
      steps: effectiveSteps,
    }
    if (validSeed !== undefined) req.seed = validSeed

    if (hasAspectRatios) {
      req.aspect_ratio = effectiveAspectRatio
    } else {
      req.width = size.w
      req.height = size.h
    }

    if (hasResolutions && effectiveResolution) {
      req.resolution = effectiveResolution
    }

    if (!navigator.onLine) {
      offlineQueue.addToQueue({ prompt: enhancedPrompt, negativePrompt: enhancedNegative, model, steps: effectiveSteps, seed: validSeed, aspectRatio: effectiveAspectRatio, request: req })
      toast.info('Saved offline', 'This request will run when connected.')
      return
    }
    const startTime = Date.now()
    mutation.mutate(
      req as unknown as Parameters<typeof mutation.mutate>[0],
      {
        onSuccess: (data) => {
          const duration = Date.now() - startTime
          const tags = classifyContent(enhancedPrompt)
          saveToHistory(enhancedPrompt, enhancedNegative || undefined)
          promptVersions.saveVersion(prompt.trim(), negativePrompt.trim() || undefined)
          sessionRestore.save({ prompt, negativePrompt, model, steps: effectiveSteps, seed, aspectRatio: effectiveAspectRatio, preset: nsfwPreset, lastImages: [] })
          data.images.forEach((image) => {
            const b64 = typeof image === 'string' ? image : image.b64_json
            addContentItem({
              imageUrl: toImageSrc(b64),
              prompt: enhancedPrompt,
              model,
              provider: 'venice',
              metadata: {
                negativePrompt: enhancedNegative,
                steps: effectiveSteps,
                seed: validSeed,
                aspectRatio: effectiveAspectRatio,
                preset: nsfwPreset,
              },
            })
          })
          trackGeneration({
            model,
            provider: 'venice',
            promptLength: enhancedPrompt.length,
            explicitLevel: tags.explicitLevel,
            contentType: tags.contentType,
            duration,
            success: true,
          })
        },
        onError: () => {
          const duration = Date.now() - startTime
          trackGeneration({
            model,
            provider: 'venice',
            promptLength: enhancedPrompt.length,
            explicitLevel: 'none',
            contentType: 'unknown',
            duration,
            success: false,
          })
        },
      },
    )
  }

  // Fix #4: Track feature order from localStorage
  const [featureOrder, setFeatureOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chilli-feature-order')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Fix #3: Track which features are currently active/open
  const activeFeatures = useMemo(() => {
    const active: string[] = []
    if (historyOpen) active.push('prompt-history')
    if (variationsOpen) active.push('smart-variations')
    if (templatesOpen) active.push('prompt-templates')
    if (statsOpen) active.push('generation-stats')
    if (comparisonOpen) active.push('compare-grid')
    if (imageToPromptOpen) active.push('image-to-prompt')
    if (scorerOpen) active.push('prompt-scorer')
    if (seedTrackerOpen) active.push('seed-tracker')
    if (weightingOpen) active.push('prompt-weights')
    if (abTestOpen) active.push('ab-testing')
    if (chainOpen) active.push('prompt-chains')
    if (versioningOpen) active.push('prompt-versions')
    if (communityOpen) active.push('community-prompts')
    if (favoritesOpen) active.push('favorites')
    if (offlineQueueOpen) active.push('offline-queue')
    if (dropZoneOpen) active.push('import-image')
    if (recipeImportOpen) active.push('import-recipe')
    return active
  }, [historyOpen, variationsOpen, templatesOpen, statsOpen, comparisonOpen, imageToPromptOpen, scorerOpen, seedTrackerOpen, weightingOpen, abTestOpen, chainOpen, versioningOpen, communityOpen, favoritesOpen, offlineQueueOpen, dropZoneOpen, recipeImportOpen])

  // Fix #7: Compute tab badges once
  const favCount = history.filter(h => h.favorite).length
  const pendingQueueCount = offlineQueue.queue.filter(q => q.status === 'pending').length
  const recentFeatureCount = featureTracker.getRecentFeatures().length

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'generate', label: 'Generate' },
    { id: 'tools', label: 'Tools', badge: recentFeatureCount > 0 ? recentFeatureCount : undefined },
    { id: 'library', label: 'Library', badge: favCount > 0 ? favCount : undefined },
    { id: 'advanced', label: 'Advanced', badge: pendingQueueCount > 0 ? pendingQueueCount : undefined },
  ]

  // Fix #4: Apply saved feature order to featureList
  const featureList = useMemo(() => {
    if (featureOrder.length === 0) return FEATURE_LIST_BASE
    const ordered = featureOrder
      .map((id) => FEATURE_LIST_BASE.find((f) => f.id === id))
      .filter(Boolean) as typeof FEATURE_LIST_BASE
    const remaining = FEATURE_LIST_BASE.filter((f) => !featureOrder.includes(f.id))
    return [...ordered, ...remaining]
  }, [featureOrder])

  // Fix #5: Batch export handler
  const handleBatchExport = async () => {
    if (images.length === 0) return
    haptic('tap')
    try {
      for (let i = 0; i < images.length; i++) {
        const src = toImageSrc(images[i])
        const name = defaultImageFileName(`batch-${i + 1}-${Date.now()}`, 'image/jpeg')
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          try {
            const blob = await (await fetch(src)).blob()
            const file = new File([blob], name, { type: 'image/jpeg' })
            await navigator.share({ files: [file], title: `Image ${i + 1}` })
          } catch {
            // Fall back to save if share fails
            await saveImage(src, 'image/jpeg', name)
          }
        } else {
          await saveImage(src, 'image/jpeg', name)
        }
      }
      haptic('success')
      toast.success('Batch export complete', `${images.length} image${images.length > 1 ? 's' : ''} exported`)
    } catch (error) {
      toast.fromError(error, 'Batch export failed')
    }
  }

  // Fix #6: Session restore handler
  const handleSessionRestore = () => {
    haptic('tap')
    try {
      const savedPrompt = localStorage.getItem('venice-image-prompt')
      const savedNegative = localStorage.getItem('venice-image-negative')
      const savedSteps = localStorage.getItem('venice-image-steps')
      const savedSeed = localStorage.getItem('venice-image-seed')
      const savedAspect = localStorage.getItem('venice-image-aspect')
      const savedModel = localStorage.getItem('venice-image-model')

      if (savedPrompt) updatePrompt(savedPrompt)
      if (savedNegative) setNegativePrompt(savedNegative)
      if (savedSteps) {
        const n = Number(savedSteps)
        if (Number.isFinite(n) && n > 0) setSteps(n)
      }
      if (savedSeed) setSeed(savedSeed)
      if (savedAspect) setAspectRatio(savedAspect)
      if (savedModel) {
        try { useSettingsStore.getState().setSelectedModel('image', savedModel) } catch { /* ignore */ }
      }
      mutation.reset()
      toast.success('Session restored', 'Previous settings loaded')
    } catch {
      toast.info('No saved session found')
    }
  }

  const controls = (
    <>
      <div className="flex items-center justify-between px-1 pt-1 pb-0">
        <button
          type="button"
          onClick={() => { haptic('tap'); setFeatureSearchOpen(true); trackFeature('feature-search') }}
          className="min-h-9 px-3 rounded-lg bg-white/[0.06] text-[12px] text-white/50 hover:text-white/70 flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          Search features…
        </button>
        <button
          type="button"
          onClick={() => { haptic('tap'); setFeatureOrderingOpen(true); trackFeature('feature-ordering') }}
          className="min-h-9 px-3 rounded-lg bg-white/[0.06] text-[12px] text-white/50 hover:text-white/70"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5h10M11 9h7M11 13h4M3 17l4 4 4-4M7 3v18" /></svg>
        </button>
      </div>

      <SwipeableTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => { setActiveTab(id as TabId); trackFeature(`tab-${id}`) }}>
        <TabTransition activeTab={activeTab}>
          {activeTab === 'generate' && (
        <div className="space-y-3 pt-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label hint={`${prompt.length}/${promptLimit}`}>Prompt</Label>
              <div className="flex items-center gap-1">
                <VoiceInput onTranscript={(text) => { updatePrompt(text); mutation.reset() }} disabled={mutation.isPending} />
                <PromptTranslator prompt={prompt} onTranslate={(translated) => { updatePrompt(translated); mutation.reset() }} disabled={mutation.isPending} />
                <PromptCardExport prompt={prompt} negativePrompt={negativePrompt} model={model} />
                <PromptEnhancer currentPrompt={prompt} onEnhanced={(enhanced) => { updatePrompt(enhanced); mutation.reset() }} />
                <button type="button" onClick={() => { setPrompt(''); setNegativePrompt(''); mutation.reset() }} className="text-[13px] text-white/60 hover:text-white min-h-11 px-2">
                  Clear
                </button>
                <button type="button" onClick={copyPrompt} className="text-[13px] text-white/60 hover:text-white min-h-11 px-2">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <PromptInspiration onSelect={(p, n) => { updatePrompt(p); if (n) setNegativePrompt(n); mutation.reset() }} />
            <TextArea value={prompt} onChange={updatePrompt} placeholder="Describe the image you want to create…" rows={4} maxLength={promptLimit} />
          </div>

          <div>
            <Label>Image shape</Label>
            <ImageShapePicker values={aspectValues} value={effectiveAspectRatio} onChange={(value) => { haptic('select'); setAspectRatio(value) }} />
          </div>

          <button
            type="button"
            onClick={() => { haptic('tap'); setPresetPickerOpen(true) }}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-[14px] text-white/75 transition-colors hover:border-white/[0.16] hover:text-white"
          >
            <span className="font-medium">Quality: {nsfwPreset.charAt(0).toUpperCase() + nsfwPreset.slice(1)}</span>
            <span className="flex items-center gap-2 text-[12px] text-white/40">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </button>

          <button
            type="button"
            onClick={() => { haptic('tap'); setGalleryOpen(true) }}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-[14px] text-white/75 transition-colors hover:border-white/[0.16] hover:text-white"
          >
            <span className="font-medium">Content Library</span>
            <span className="flex items-center gap-2 text-[12px] text-white/40">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2M5 19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2M5 19V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>
            </span>
          </button>

          <ExpandableSection title="Advanced options" defaultOpen={false}>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Negative prompt</Label>
                  <SmartNegativeSuggester prompt={prompt} onSuggest={(neg) => setNegativePrompt(neg)} />
                </div>
                <TextArea value={negativePrompt} onChange={setNegativePrompt} placeholder="blurry, clothes, CGI…" rows={2} />
              </div>

              {!hasAspectRatios && (
                <div><Label>Image detail</Label><PillGroup options={DEFAULT_SIZES} value={sizeIdx} onChange={(v) => { haptic('select'); setSizeIdx(v) }} /></div>
              )}

              {hasResolutions && (
                <div><Label>Resolution</Label><PillGroup options={resolutionOptions} value={effectiveResolution} onChange={(v) => { haptic('select'); setResolution(v) }} /></div>
              )}

              <div>
                <Label hint={String(effectiveSteps)}>Steps</Label>
                <input type="range" min={1} max={maxSteps} value={effectiveSteps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full min-h-11" />
              </div>
              <div>
                <Label hint={String(variants)}>Variants</Label>
                <input type="range" min={1} max={2} value={variants} onChange={(e) => { haptic('select'); setVariants(Number(e.target.value)) }} className="w-full min-h-11" />
              </div>
              <div>
                <Label hint={seed.trim() === '' ? 'random' : seed}>Seed</Label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value.replace(/[^0-9-]/g, ''))}
                  placeholder="Leave empty for random"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2.5 text-[16px] text-white outline-none focus:border-white/[0.25] placeholder:text-white/35 min-h-11"
                />
              </div>
            </div>
          </ExpandableSection>

          <OfflineQueueIndicator
            isOnline={offlineQueue.isOnline}
            pendingCount={offlineQueue.queue.filter(q => q.status === 'pending').length}
            failedCount={offlineQueue.queue.filter(q => q.status === 'failed').length}
            processing={offlineQueue.processing}
            onShowQueue={() => setOfflineQueueOpen(true)}
          />

          {promptTooLong && <div className="text-[13px] text-red-300/95" role="alert">
            Prompt is {prompt.length - promptLimit} characters over this model's limit.
          </div>}

          <PrimaryButton onClick={handleGenerate} disabled={!prompt.trim() || promptTooLong || !apiKey} loading={mutation.isPending} size="lg">
            {mutation.isPending ? 'Generating…' : 'Generate'}
          </PrimaryButton>
          {mutation.isPending && (
            <TaskProgress label="Generating image" detail="Venice is rendering a compressed JPEG result" indeterminate showElapsed />
          )}
          {mutation.error && <ErrorText>{formatVeniceError(mutation.error)}</ErrorText>}
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-3 pt-3">
          {/* Fix #9: Feature favorites section */}
          {featureTracker.favorites.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-yellow-400/70"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Favorite Features</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {featureTracker.getFavoriteFeatures().map((fav) => {
                  const feat = featureList.find(f => f.id === fav.featureId)
                  return feat ? (
                    <button
                      key={fav.featureId}
                      type="button"
                      onClick={() => {
                        const handlers: Record<string, () => void> = {
                          'image-to-prompt': () => setImageToPromptOpen(true),
                          'prompt-scorer': () => setScorerOpen(true),
                          'prompt-weights': () => setWeightingOpen(true),
                          'prompt-templates': () => setTemplatesOpen(true),
                          'smart-variations': () => setVariationsOpen(true),
                          'ab-testing': () => setAbTestOpen(true),
                          'prompt-chains': () => setChainOpen(true),
                          'import-image': () => setDropZoneOpen(true),
                          'import-recipe': () => setRecipeImportOpen(true),
                          'batch-export': () => { void handleBatchExport() },
                          'prompt-history': () => setHistoryOpen(true),
                          'favorites': () => setFavoritesOpen(true),
                          'seed-tracker': () => setSeedTrackerOpen(true),
                          'community-prompts': () => setCommunityOpen(true),
                          'compare-grid': () => setComparisonOpen(true),
                          'generation-stats': () => setStatsOpen(true),
                          'prompt-versions': () => setVersioningOpen(true),
                          'session-restore': () => handleSessionRestore(),
                          'accent-color': () => setAccentOpen(true),
                          'keyboard-shortcuts': () => setShortcutHelpOpen(true),
                          'offline-queue': () => setOfflineQueueOpen(true),
                        }
                        handlers[fav.featureId]?.()
                        trackFeature(fav.featureId)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/[0.1] hover:text-white transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-yellow-400/60"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      {feat.label}
                    </button>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Fix #1: SmartGrouping toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
            <span className="text-[13px] text-white/60">Smart Grouping</span>
            <button
              type="button"
              onClick={() => { haptic('tap'); setSmartGroupingEnabled(!smartGroupingEnabled); trackFeature('smart-grouping') }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smartGroupingEnabled ? 'bg-white/25' : 'bg-white/[0.08]'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${smartGroupingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {smartGroupingEnabled && (
            <SmartGrouping
              features={featureList.map(f => ({
                id: f.id,
                label: f.label,
                category: f.category,
                usageCount: featureTracker.usage.find(u => u.featureId === f.id)?.count ?? 0,
              }))}
              onFeatureClick={(id) => {
                trackFeature(id)
                const handlers: Record<string, () => void> = {
                  'image-to-prompt': () => setImageToPromptOpen(true),
                  'prompt-scorer': () => setScorerOpen(true),
                  'prompt-weights': () => setWeightingOpen(true),
                  'prompt-templates': () => setTemplatesOpen(true),
                  'smart-variations': () => setVariationsOpen(true),
                  'ab-testing': () => setAbTestOpen(true),
                  'prompt-chains': () => setChainOpen(true),
                  'import-image': () => setDropZoneOpen(true),
                  'import-recipe': () => setRecipeImportOpen(true),
                  'batch-export': () => { void handleBatchExport() },
                  'prompt-history': () => setHistoryOpen(true),
                  'favorites': () => setFavoritesOpen(true),
                  'seed-tracker': () => setSeedTrackerOpen(true),
                  'community-prompts': () => setCommunityOpen(true),
                  'compare-grid': () => setComparisonOpen(true),
                  'generation-stats': () => setStatsOpen(true),
                  'prompt-versions': () => setVersioningOpen(true),
                  'session-restore': () => handleSessionRestore(),
                  'accent-color': () => setAccentOpen(true),
                  'keyboard-shortcuts': () => setShortcutHelpOpen(true),
                  'offline-queue': () => setOfflineQueueOpen(true),
                }
                handlers[id]?.()
              }}
            />
          )}

          <FeatureMenu
            title="Prompt Tools"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>}
            items={[
              { label: 'Image to Prompt', onClick: () => { setImageToPromptOpen(true); trackFeature('image-to-prompt') } },
              { label: 'Prompt Scorer', onClick: () => { setScorerOpen(true); trackFeature('prompt-scorer') }, disabled: !prompt.trim(), badge: promptScore ? `${promptScore.score}/10` : undefined },
              { label: 'Prompt Weights', onClick: () => { setWeightingOpen(true); trackFeature('prompt-weights') }, disabled: !prompt.trim() },
              { label: 'Prompt Templates', onClick: () => { setTemplatesOpen(true); trackFeature('prompt-templates') } },
              ...featureTracker.favorites.length > 0 ? [] : [],
            ]}
          />

          <FeatureMenu
            title="Variations & Testing"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>}
            items={[
              { label: 'Smart Variations', onClick: () => { setVariationsOpen(true); trackFeature('smart-variations') }, disabled: !prompt.trim() || !apiKey },
              { label: 'A/B Testing', onClick: () => { setAbTestOpen(true); trackFeature('ab-testing') }, disabled: !prompt.trim() },
              { label: 'Prompt Chains', onClick: () => { setChainOpen(true); trackFeature('prompt-chains') }, disabled: !prompt.trim() },
            ]}
          />

          <FeatureMenu
            title="Import & Export"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
            items={[
              { label: 'Import Image', onClick: () => { setDropZoneOpen(true); trackFeature('import-image') } },
              { label: 'Import Recipe', onClick: () => { setRecipeImportOpen(true); trackFeature('import-recipe') } },
              { label: 'Batch Export', onClick: () => { void handleBatchExport(); trackFeature('batch-export') }, disabled: images.length === 0 },
            ]}
          />

          {/* Fix #9: Favorite toggle buttons for features */}
          <ExpandableSection title="Manage Favorites" defaultOpen={false}>
            <div className="flex flex-wrap gap-1.5">
              {featureList.map((f) => {
                const isFav = featureTracker.favorites.includes(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { haptic('tap'); featureTracker.toggleFavorite(f.id) }}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors border ${isFav ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300/80' : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70'}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    {f.label}
                  </button>
                )
              })}
            </div>
          </ExpandableSection>
        </div>
      )}

      {activeTab === 'library' && (
        <div className="space-y-3 pt-3">
          <FeatureMenu
            title="History & Favorites"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
            items={[
              { label: 'Prompt History', onClick: () => { setHistoryOpen(true); trackFeature('prompt-history') }, badge: favCount > 0 ? `${favCount} ★` : undefined },
              { label: 'Favorites', onClick: () => { setFavoritesOpen(true); trackFeature('favorites') }, badge: imageFavorites.favorites.length > 0 ? `${imageFavorites.favorites.length}` : undefined },
              { label: 'Seed Tracker', onClick: () => { setSeedTrackerOpen(true); trackFeature('seed-tracker') } },
            ]}
          />

          <FeatureMenu
            title="Community"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            items={[
              { label: 'Community Prompts', onClick: () => { setCommunityOpen(true); trackFeature('community-prompts') } },
            ]}
          />

          <FeatureMenu
            title="Compare & Review"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>}
            items={[
              { label: 'Compare Grid', onClick: () => { setComparisonOpen(true); trackFeature('compare-grid') }, disabled: images.length === 0 },
              { label: 'Generation Stats', onClick: () => { setStatsOpen(true); trackFeature('generation-stats') } },
            ]}
          />
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="space-y-3 pt-3">
          <FeatureMenu
            title="Versioning & Sessions"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>}
            items={[
              { label: 'Prompt Versions', onClick: () => { setVersioningOpen(true); trackFeature('prompt-versions') } },
              { label: 'Session Restore', onClick: () => { handleSessionRestore(); trackFeature('session-restore') } },
              { label: 'Preset Sharing', onClick: () => { setPresetSharingOpen(true); trackFeature('preset-sharing') } },
            ]}
          />

          <FeatureMenu
            title="Customization"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
            items={[
              { label: 'Accent Color', onClick: () => { setAccentOpen(true); trackFeature('accent-color') } },
              { label: 'Keyboard Shortcuts', onClick: () => { setShortcutHelpOpen(true); trackFeature('keyboard-shortcuts') } },
            ]}
          />

          <FeatureMenu
            title="Offline & Queue"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>}
            items={[
              { label: 'Offline Queue', onClick: () => { setOfflineQueueOpen(true); trackFeature('offline-queue') }, badge: pendingQueueCount > 0 ? `${pendingQueueCount}` : undefined },
            ]}
          />

          {/* Fix #3: ContextualSuggestions with live data */}
          {!suggestionsDismissed && (
            <ContextualSuggestions
              currentPrompt={prompt}
              activeFeatures={activeFeatures}
              onSuggestionClick={(id) => { trackFeature(id) }}
              imageCount={images.length}
              hasSeed={!!seed}
            />
          )}
        </div>
      )}
        </TabTransition>
      </SwipeableTabs>

      <BottomSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Prompt History">
        <PromptHistoryList
          history={history}
          onSelect={(p, n) => { updatePrompt(p); if (n) setNegativePrompt(n); mutation.reset(); setHistoryOpen(false) }}
          onToggleFavorite={toggleFavorite}
          onClear={clearHistory}
        />
      </BottomSheet>

      <BottomSheet open={variationsOpen} onClose={() => setVariationsOpen(false)} title="Smart Variations">
        <SmartVariations
          prompt={prompt}
          negativePrompt={negativePrompt}
          aspectRatio={effectiveAspectRatio}
          model={model}
          onComplete={() => setVariationsOpen(false)}
        />
      </BottomSheet>

      <BottomSheet open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Prompt Templates">
        <PromptTemplates onSelect={(p) => { updatePrompt(p); mutation.reset(); setTemplatesOpen(false) }} />
      </BottomSheet>

      <BottomSheet open={statsOpen} onClose={() => setStatsOpen(false)} title="Generation Stats">
        <GenerationStats />
      </BottomSheet>

      <BottomSheet open={accentOpen} onClose={() => setAccentOpen(false)} title="Accent Color">
        <AccentColorPicker currentColor={accentColor} onChange={setAccentColor} />
      </BottomSheet>

      <BottomSheet open={dropZoneOpen} onClose={() => setDropZoneOpen(false)} title="Import Image">
        <ImageDropZone onImageDrop={(dataUrl) => { sendToTool('edit', dataUrl, 'imported.jpg'); setDropZoneOpen(false) }} />
      </BottomSheet>

      <BottomSheet open={comparisonOpen} onClose={() => setComparisonOpen(false)} title="Compare Images">
        <ComparisonGrid
          items={images.map((img, i) => ({ id: String(i), src: toImageSrc(img), label: `Image ${i + 1}` }))}
          columns={images.length > 4 ? 4 : images.length > 2 ? 3 : 2}
          onItemClick={(item) => { setSelectedIndex(Number(item.id)); setComparisonOpen(false) }}
        />
      </BottomSheet>

      <BottomSheet open={imageToPromptOpen} onClose={() => setImageToPromptOpen(false)} title="Image to Prompt">
        <ImageToPrompt onPromptExtracted={(p) => { updatePrompt(p); mutation.reset(); setImageToPromptOpen(false) }} />
      </BottomSheet>

      <BottomSheet open={scorerOpen} onClose={() => setScorerOpen(false)} title="Prompt Quality Score">
        <PromptScorer prompt={prompt} onScoreReady={(score, feedback) => setPromptScore({ score, feedback })} />
        {promptScore && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="text-[13px] text-white/60">Score: <span className={promptScore.score >= 7 ? 'text-green-400' : promptScore.score >= 5 ? 'text-yellow-400' : 'text-red-400'}>{promptScore.score}/10</span></div>
            <div className="mt-1 text-[12px] text-white/50">{promptScore.feedback}</div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={seedTrackerOpen} onClose={() => setSeedTrackerOpen(false)} title="Seed Tracker">
        <SeedTrackerDisplay records={seedTracker.records} onClear={seedTracker.clearRecords} />
      </BottomSheet>

      <BottomSheet open={weightingOpen} onClose={() => setWeightingOpen(false)} title="Prompt Weights">
        <PromptWeightEditor prompt={prompt} onChange={(p) => { updatePrompt(p); mutation.reset() }} />
      </BottomSheet>

      <BottomSheet open={communityOpen} onClose={() => setCommunityOpen(false)} title="Community Prompts">
        <CommunityPromptBrowser onSelect={(p, n) => { updatePrompt(p); if (n) setNegativePrompt(n); mutation.reset(); setCommunityOpen(false) }} />
      </BottomSheet>

      <BottomSheet open={versioningOpen} onClose={() => setVersioningOpen(false)} title="Prompt Versions">
        <PromptVersionHistory
          versions={promptVersions.versions}
          currentPrompt={prompt}
          onSelect={(p, n) => { updatePrompt(p); if (n) setNegativePrompt(n); mutation.reset(); setVersioningOpen(false) }}
          onDelete={promptVersions.deleteVersion}
          onClear={promptVersions.clearAll}
        />
      </BottomSheet>

      <BottomSheet open={abTestOpen} onClose={() => setAbTestOpen(false)} title="A/B Testing">
        <ABTestPanel
          prompt={prompt}
          negativePrompt={negativePrompt}
          aspectRatio={effectiveAspectRatio}
          configA={{ model, steps: effectiveSteps, seed: seed ? Number(seed) : undefined, label: 'Config A' }}
          configB={{ model, steps: Math.min(effectiveSteps + 5, maxSteps), seed: seed ? Number(seed) + 1 : undefined, label: 'Config B' }}
        />
      </BottomSheet>

      <BottomSheet open={chainOpen} onClose={() => setChainOpen(false)} title="Prompt Chains">
        <PromptChainBuilder
          prompt={prompt}
          negativePrompt={negativePrompt}
          model={model}
          aspectRatio={effectiveAspectRatio}
          steps={effectiveSteps}
          seed={seed ? Number(seed) : undefined}
        />
      </BottomSheet>

      <BottomSheet open={favoritesOpen} onClose={() => setFavoritesOpen(false)} title="Favorites">
        <FavoritesGallery
          favorites={imageFavorites.favorites}
          onRemove={imageFavorites.removeFavorite}
          onSelect={(fav) => { updatePrompt(fav.prompt || ''); mutation.reset(); setFavoritesOpen(false) }}
        />
      </BottomSheet>

      <BottomSheet open={recipeImportOpen} onClose={() => setRecipeImportOpen(false)} title="Import Recipe">
        <RecipeImport onImport={(recipe) => {
          if (recipe.prompt) updatePrompt(recipe.prompt)
          if (recipe.negativePrompt) setNegativePrompt(recipe.negativePrompt)
          if (recipe.steps) setSteps(recipe.steps)
          if (recipe.seed !== undefined) setSeed(String(recipe.seed))
          if (recipe.aspectRatio) setAspectRatio(recipe.aspectRatio)
          mutation.reset()
          setRecipeImportOpen(false)
          toast.success('Recipe imported', 'Settings loaded from file')
        }} />
      </BottomSheet>

      <BottomSheet open={offlineQueueOpen} onClose={() => setOfflineQueueOpen(false)} title="Offline Queue">
        <OfflineQueueList
          queue={offlineQueue.queue}
          onRemove={offlineQueue.removeFromQueue}
          onRetryFailed={offlineQueue.retryFailed}
          onClearCompleted={offlineQueue.clearCompleted}
        />
      </BottomSheet>

      <ShortcutHelpModal open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />

      <SessionRestorePrompt
        hasSavedSession={sessionRestore.hasSavedSession}
        savedSession={sessionRestore.savedSession}
        onRestore={() => {
          const s = sessionRestore.savedSession
          if (s) {
            if (typeof s.prompt === 'string') updatePrompt(s.prompt)
            if (typeof s.negativePrompt === 'string') setNegativePrompt(s.negativePrompt)
            if (s.model) useSettingsStore.getState().setSelectedModel('image', s.model)
            if (typeof s.steps === 'number') setSteps(s.steps)
            if (s.seed !== undefined) setSeed(String(s.seed))
            if (typeof s.aspectRatio === 'string') setAspectRatio(s.aspectRatio)
          }
          sessionRestore.restore()
          toast.success('Session restored')
        }}
        onDismiss={sessionRestore.dismiss}
      />

      <ShareableRecipe
        prompt={prompt}
        negativePrompt={negativePrompt}
        model={model}
        steps={effectiveSteps}
        seed={seed ? Number(seed) : undefined}
        aspectRatio={effectiveAspectRatio}
        preset={nsfwPreset}
      />

      <QuickActionsMenu
        open={longPress.open}
        onClose={longPress.close}
        position={longPress.position}
        actions={[
          { label: 'View metadata', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>, onClick: () => metadataToggle.toggle() },
          { label: 'Download', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>, onClick: () => { if (selectedIndex !== null) void saveGenerated(images[selectedIndex], selectedIndex) } },
          { label: 'Edit', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>, onClick: () => { if (selectedIndex !== null) sendGenerated('edit', images[selectedIndex], selectedIndex) }, variant: 'accent' },
        ]}
      />

      {featureSearchOpen && (
        <FeatureSearch
          features={featureList}
          onSelect={(id) => { trackFeature(id); setFeatureSearchOpen(false); switch (id) { case 'image-to-prompt': setImageToPromptOpen(true); break; case 'prompt-scorer': setScorerOpen(true); break; case 'prompt-weights': setWeightingOpen(true); break; case 'prompt-templates': setTemplatesOpen(true); break; case 'smart-variations': setVariationsOpen(true); break; case 'ab-testing': setAbTestOpen(true); break; case 'prompt-chains': setChainOpen(true); break; case 'import-image': setDropZoneOpen(true); break; case 'import-recipe': setRecipeImportOpen(true); break; case 'batch-export': void handleBatchExport(); break; case 'prompt-history': setHistoryOpen(true); break; case 'favorites': setFavoritesOpen(true); break; case 'seed-tracker': setSeedTrackerOpen(true); break; case 'community-prompts': setCommunityOpen(true); break; case 'compare-grid': setComparisonOpen(true); break; case 'generation-stats': setStatsOpen(true); break; case 'prompt-versions': setVersioningOpen(true); break; case 'session-restore': handleSessionRestore(); break; case 'accent-color': setAccentOpen(true); break; case 'keyboard-shortcuts': setShortcutHelpOpen(true); break; case 'offline-queue': setOfflineQueueOpen(true); break; } }}
          onClose={() => setFeatureSearchOpen(false)}
        />
      )}

      {featureOrderingOpen && (
        <FeatureOrdering
          items={featureList.map(f => ({ id: f.id, label: f.label }))}
          onReorder={(newOrder) => {
            setFeatureOrder(newOrder)
            try { localStorage.setItem('chilli-feature-order', JSON.stringify(newOrder)) } catch { /* ignore */ }
          }}
          onClose={() => setFeatureOrderingOpen(false)}
        />
      )}

      <BottomSheet open={presetSharingOpen} onClose={() => setPresetSharingOpen(false)} title="Preset Sharing">
        <PresetSharing
          preset={{
            name: 'Current Settings',
            features: featureTracker.favorites,
            settings: { prompt, negativePrompt, model, steps: effectiveSteps, seed: seed ? Number(seed) : undefined, aspectRatio: effectiveAspectRatio, preset: nsfwPreset },
          }}
          onImport={(imported) => {
            if (imported?.settings) {
              const s = imported.settings
              if (typeof s.prompt === 'string') updatePrompt(s.prompt)
              if (typeof s.negativePrompt === 'string') setNegativePrompt(s.negativePrompt)
              if (typeof s.model === 'string') { try { useSettingsStore.getState().setSelectedModel('image', s.model) } catch { /* ignore */ } }
              if (typeof s.steps === 'number') setSteps(s.steps)
              if (s.seed !== undefined) setSeed(String(s.seed))
              if (typeof s.aspectRatio === 'string') setAspectRatio(s.aspectRatio)
              mutation.reset()
            }
            setPresetSharingOpen(false)
            toast.success('Preset imported', 'Settings loaded from shared preset')
          }}
        />
      </BottomSheet>
    </>
  )

  const output = (
    <>
      {selectedIndex !== null && images[selectedIndex] !== undefined && (
        <div
          role="dialog" aria-modal="true" aria-label="Full image" className="fixed inset-0 z-[70] flex h-[100dvh] flex-col bg-black/95 animate-fade-in"
          onTouchStart={(e) => {
            const touch = e.touches[0]
            viewerTouch.current = { x: touch.clientX, y: touch.clientY }
          }}
          onTouchEnd={(e) => {
            const start = viewerTouch.current
            viewerTouch.current = null
            if (!start || images.length < 2) return
            const touch = e.changedTouches[0]
            const dx = touch.clientX - start.x
            const dy = touch.clientY - start.y
            if (Math.abs(dx) < 56 || Math.abs(dy) > Math.abs(dx)) return
            haptic('select')
            setSelectedIndex((current) => {
              if (current === null) return current
              const next = dx < 0 ? current + 1 : current - 1
              return (next + images.length) % images.length
            })
          }}
          onClick={() => setSelectedIndex(null)}
        >
          <div className="flex shrink-0 justify-end p-3 pt-[max(0.75rem,env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSelectedIndex(null)} className="min-h-14 min-w-28 rounded-xl bg-white/15 px-5 text-base font-semibold text-white">Close</button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
            <img src={toImageSrc(images[selectedIndex])} alt={`Generated ${selectedIndex + 1}`} className="w-full h-full min-h-0 object-contain rounded-xl" />
          </div>
          <div className="shrink-0 grid grid-cols-3 sm:grid-cols-5 gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/80" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => sendGenerated('edit', images[selectedIndex], selectedIndex)} className="min-h-12 rounded-lg bg-white text-black text-[15px] font-medium">Edit</button>
            <button type="button" onClick={() => sendGenerated('swap', images[selectedIndex], selectedIndex)} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium">Swap</button>
            <button type="button" onClick={() => setOutfitTarget({ src: toImageSrc(images[selectedIndex]), name: fileName(selectedIndex ?? undefined) })} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium">Outfit</button>
            <button type="button" disabled={mediaBusy === 'save'} onClick={() => { void saveGenerated(images[selectedIndex], selectedIndex) }} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium disabled:opacity-50">{mediaBusy === 'save' ? 'Downloading…' : 'Download'}</button>
            <button type="button" disabled={mediaBusy === 'share'} onClick={() => { void shareGenerated(images[selectedIndex], selectedIndex) }} className="min-h-12 rounded-lg bg-white/15 text-white text-[15px] font-medium disabled:opacity-50 sm:col-span-1 col-span-3">{mediaBusy === 'share' ? 'Sharing…' : 'Share'}</button>
          </div>
          {images.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[12px] text-white/70" aria-hidden="true">
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
      {images.length === 0 ? (
        <div className="flex items-center justify-center h-full min-h-[30vh]">
          {mutation.isPending ? (
            <TaskProgress className="max-w-sm" label="Generating image" detail="Keep this screen open while Venice finishes" indeterminate showElapsed />
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {mutation.isPending && Array.from({ length: variants }).map((_, i) => (
            <div key={`skel-${i}`} className="aspect-[3/2] rounded-xl skeleton" />
          ))}
          {images.map((img, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-white/[0.08] shadow-[var(--shadow-1)]">
              <div className="relative" {...longPress.handlers}>
                <img
                  src={toImageSrc(img)}
                  alt={`Generated ${i + 1}`}
                  className="w-full cursor-pointer"
                  onClick={() => { haptic('tap'); setSelectedIndex(i) }}
                />
                <MetadataOverlay
                  visible={metadataToggle.visible}
                  metadata={{ prompt, negativePrompt, seed: seed ? Number(seed) : undefined, model, steps: effectiveSteps, aspectRatio: effectiveAspectRatio, preset: nsfwPreset }}
                />
              </div>
              <div className="bg-[#0c0c10] p-2 pb-0"><FullscreenButton onClick={() => { haptic('tap'); setSelectedIndex(i) }} /></div>
              <div className="grid grid-cols-4 gap-1.5 bg-[#0c0c10] p-2">
                <button type="button" onClick={() => { haptic('tap'); sendGenerated('edit', img, i) }} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/[0.16]">Edit</button>
                <button type="button" onClick={() => { haptic('tap'); sendGenerated('swap', img, i) }} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/[0.16]">Swap</button>
                <button type="button" onClick={() => { void saveGenerated(img, i) }} disabled={mediaBusy === 'save'} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/[0.16] disabled:opacity-50">{mediaBusy === 'save' ? '…' : 'Download'}</button>
                <button type="button" onClick={() => { void shareGenerated(img, i) }} disabled={mediaBusy === 'share'} className="min-h-11 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/[0.16] disabled:opacity-50">{mediaBusy === 'share' ? '…' : 'Share'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {undressTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={() => setOutfitTarget(null)}>
          <div className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-[#121214] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-[17px] font-semibold text-white">Adult confirmation</div>
            <p className="mt-2 text-[15px] leading-relaxed text-white/70">
              Outfit is adult-only image editing. Confirm you are 18 or older and that you want to send this generated image to the Outfit tool.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOutfitTarget(null)} className="min-h-11 px-3 rounded-lg text-[15px] text-white/70">
                Cancel
              </button>
              <button type="button" onClick={confirmOutfit} className="min-h-11 px-3 rounded-lg bg-white text-black text-[15px] font-medium">
                I am 18+ / send to Outfit
              </button>
            </div>
          </div>
        </div>
      )}
      <GenerationView controls={controls} output={output} />
      <QualityPresetPicker
        open={presetPickerOpen}
        onClose={() => setPresetPickerOpen(false)}
        currentPreset={nsfwPreset}
        onSelect={setNsfwPreset}
        prompt={prompt}
      />
      <BatchProgress />
      {galleryOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#0a0a0c]">
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0c0c10] px-4 py-3">
            <div className="text-[17px] font-semibold text-white">Content Library</div>
            <button type="button" onClick={() => setGalleryOpen(false)} className="min-h-11 min-w-20 rounded-lg bg-white/10 px-4 text-[15px] font-medium text-white">
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ContentGallery onSelect={item => { useImageWorkspace.getState().addGeneratedImages([item.imageUrl]); setGalleryOpen(false); setSelectedIndex(0) }} />
          </div>
        </div>
      )}
    </>
  )
}
