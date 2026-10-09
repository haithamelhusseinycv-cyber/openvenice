/**
 * Hybrid storage strategy for Chili NSFW content.
 *
 * Local-first architecture: all generated content stays on device by default.
 * Cloud is used only for GPU processing (ephemeral) and optional encrypted backup.
 *
 * Privacy guarantees:
 * - No NSFW content leaves the device without explicit user consent
 * - Cloud GPU processing deletes data immediately after generation
 * - Optional cloud backup uses AES-256-GCM end-to-end encryption
 * - User has complete control over what is stored where
 */

export type StorageLocation = 'local' | 'cloud' | 'hybrid'

export interface StorageConfig {
  /** Default storage location for new content */
  defaultLocation: StorageLocation

  /** Local storage settings */
  local: {
    /** Maximum local storage in MB (0 = unlimited) */
    maxStorageMB: number
    /** Auto-cleanup old content when storage is full */
    autoCleanup: boolean
    /** Keep content for X days before cleanup (0 = keep forever) */
    retentionDays: number
  }

  /** Cloud GPU processing settings (ephemeral) */
  cloudGPU: {
    /** Enable cloud GPU for heavy tasks */
    enabled: boolean
    /** Delete from cloud immediately after processing */
    ephemeral: boolean
    /** Only use cloud for these quality tiers */
    onlyForQuality: Array<'best' | 'high'>
    /** Maximum cost per generation in USD */
    maxCostUSD: number
  }

  /** Optional encrypted cloud backup */
  cloudBackup: {
    /** Enable cloud backup (user must explicitly opt in) */
    enabled: boolean
    /** Encryption algorithm */
    encryption: 'AES-256-GCM' | 'none'
    /** Backup provider */
    provider: 'r2' | 's3' | 'self-hosted' | null
    /** Auto-upload new content */
    autoUpload: boolean
    /** Delete from cloud after download */
    deleteAfterDownload: boolean
    /** Backup encryption key (stored in device keychain) */
    encryptionKey?: string
  }

  /** Privacy controls */
  privacy: {
    /** Require authentication to view gallery */
    requireAuth: boolean
    /** Hide app content from screenshots */
    preventScreenshots: boolean
    /** Secure deletion (overwrite before delete) */
    secureDeletion: boolean
    /** Incognito mode (no history, no cache) */
    incognitoMode: boolean
  }
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  defaultLocation: 'local',

  local: {
    maxStorageMB: 0, // unlimited
    autoCleanup: false,
    retentionDays: 0, // keep forever
  },

  cloudGPU: {
    enabled: true,
    ephemeral: true,
    onlyForQuality: ['best'],
    maxCostUSD: 5.00,
  },

  cloudBackup: {
    enabled: false,
    encryption: 'AES-256-GCM',
    provider: null,
    autoUpload: false,
    deleteAfterDownload: true,
  },

  privacy: {
    requireAuth: true,
    preventScreenshots: true,
    secureDeletion: true,
    incognitoMode: false,
  },
}

/**
 * Determine where to store a generated image based on config and context.
 */
export function getStorageLocation(
  config: StorageConfig,
  quality: 'fast' | 'balanced' | 'best',
  isNSFW: boolean,
): StorageLocation {
  // NSFW content always stays local by default
  if (isNSFW && config.defaultLocation === 'local') {
    return 'local'
  }

  // Cloud GPU is only for best quality if configured
  if (quality === 'best' && config.cloudGPU.enabled && config.cloudGPU.onlyForQuality.includes('best')) {
    return 'cloud'
  }

  return config.defaultLocation
}

/**
 * Determine if cloud GPU should be used for a generation task.
 */
export function shouldUseCloudGPU(
  config: StorageConfig,
  quality: 'fast' | 'balanced' | 'best',
  estimatedCostUSD: number,
): boolean {
  if (!config.cloudGPU.enabled) return false
  if (quality !== 'best' || !config.cloudGPU.onlyForQuality.includes('best')) return false
  if (estimatedCostUSD > config.cloudGPU.maxCostUSD) return false
  return true
}

/**
 * Get the appropriate model for a task based on storage strategy.
 * Local models for privacy, cloud models for quality.
 */
export function selectModelForStorage(
  config: StorageConfig,
  task: 'generate' | 'edit' | 'upscale' | 'face-detail' | 'inpaint',
  quality: 'fast' | 'balanced' | 'best',
): string {
  const useCloud = shouldUseCloudGPU(config, quality, 0)

  if (task === 'generate') {
    return useCloud ? 'lustify-v8' : 'realvisxl-v5'
  }
  if (task === 'edit') {
    return useCloud ? 'qwen-edit-uncensored' : 'nsfw-edit-realistic-v3'
  }
  if (task === 'upscale') {
    return useCloud ? '4x-upscaler-ultrasharp' : '4x-upscaler-anime'
  }
  if (task === 'face-detail') {
    return 'face-detailer-xl-v3'
  }
  if (task === 'inpaint') {
    return useCloud ? 'nsfw-inpainting-pro-v2' : 'inpainting-xl-v3'
  }

  return 'lustify-v8'
}
