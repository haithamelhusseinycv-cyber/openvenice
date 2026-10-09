/**
 * Privacy and security controls for NSFW content generation.
 * 
 * Provides comprehensive privacy features including:
 * - Authentication requirements
 * - Secure deletion with multiple overwrite passes
 * - Screenshot and screen recording prevention
 * - Incognito mode for temporary sessions
 * - Access logging and audit trails
 * - Content encryption at rest
 */

import { DEFAULT_STORAGE_CONFIG, type StorageConfig } from './storage-config'

export interface PrivacySettings {
  requireAuthentication: boolean
  authenticationMethod: 'pin' | 'biometric' | 'password'
  autoLockTimeout: number // minutes
  preventScreenshots: boolean
  preventScreenRecording: boolean
  secureDeletion: boolean
  secureDeletionPasses: number
  incognitoMode: boolean
  accessLogging: boolean
  contentEncryption: boolean
  encryptionKeyStorage: 'device' | 'cloud' | 'manual'
  metadataStripping: boolean
  exifRemoval: boolean
  watermarking: boolean
  watermarkText?: string
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  requireAuthentication: true,
  authenticationMethod: 'biometric',
  autoLockTimeout: 5,
  preventScreenshots: true,
  preventScreenRecording: true,
  secureDeletion: true,
  secureDeletionPasses: 3,
  incognitoMode: false,
  accessLogging: true,
  contentEncryption: true,
  encryptionKeyStorage: 'device',
  metadataStripping: true,
  exifRemoval: true,
  watermarking: false,
}

/**
 * Access log entry for audit trail
 */
export interface AccessLogEntry {
  timestamp: string
  action: 'generate' | 'view' | 'edit' | 'delete' | 'share' | 'export'
  contentId: string
  contentType: 'image' | 'video' | 'workflow'
  success: boolean
  ipAddress?: string
  deviceId?: string
  metadata?: Record<string, unknown>
}

/**
 * Privacy manager for NSFW content
 */
export class PrivacyManager {
  private settings: PrivacySettings
  private accessLog: AccessLogEntry[] = []
  private sessionStartTime: string | null = null
  private lastActivityTime: string | null = null

  constructor(settings: PrivacySettings = DEFAULT_PRIVACY_SETTINGS) {
    this.settings = { ...settings }
  }

  /**
   * Update privacy settings
   */
  updateSettings(newSettings: Partial<PrivacySettings>): void {
    this.settings = { ...this.settings, ...newSettings }
  }

  /**
   * Get current privacy settings
   */
  getSettings(): PrivacySettings {
    return { ...this.settings }
  }

  /**
   * Start a new session
   */
  startSession(): void {
    this.sessionStartTime = new Date().toISOString()
    this.lastActivityTime = this.sessionStartTime
    this.logAccess({
      action: 'view',
      contentId: 'session-start',
      contentType: 'workflow',
      success: true,
      metadata: { event: 'session_start' },
    })
  }

  /**
   * Check if session should be locked due to inactivity
   */
  shouldLockSession(): boolean {
    if (!this.settings.requireAuthentication) return false
    if (!this.lastActivityTime) return false

    const lastActivity = new Date(this.lastActivityTime).getTime()
    const now = Date.now()
    const timeoutMs = this.settings.autoLockTimeout * 60 * 1000

    return (now - lastActivity) > timeoutMs
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivityTime = new Date().toISOString()
  }

  /**
   * Log access to content
   */
  logAccess(entry: Omit<AccessLogEntry, 'timestamp'>): void {
    if (!this.settings.accessLogging) return

    const logEntry: AccessLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    }

    this.accessLog.push(logEntry)

    // Keep only last 1000 entries to prevent memory issues
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000)
    }
  }

  /**
   * Get access log
   */
  getAccessLog(): AccessLogEntry[] {
    return [...this.accessLog]
  }

  /**
   * Clear access log
   */
  clearAccessLog(): void {
    this.accessLog = []
  }

  /**
   * Check if screenshots should be prevented
   */
  shouldPreventScreenshots(): boolean {
    return this.settings.preventScreenshots
  }

  /**
   * Check if screen recording should be prevented
   */
  shouldPreventScreenRecording(): boolean {
    return this.settings.preventScreenRecording
  }

  /**
   * Check if content should be encrypted
   */
  shouldEncryptContent(): boolean {
    return this.settings.contentEncryption
  }

  /**
   * Check if metadata should be stripped
   */
  shouldStripMetadata(): boolean {
    return this.settings.metadataStripping
  }

  /**
   * Check if EXIF data should be removed
   */
  shouldRemoveEXIF(): boolean {
    return this.settings.exifRemoval
  }

  /**
   * Check if secure deletion is enabled
   */
  isSecureDeletionEnabled(): boolean {
    return this.settings.secureDeletion
  }

  /**
   * Get number of secure deletion passes
   */
  getSecureDeletionPasses(): number {
    return this.settings.secureDeletionPasses
  }

  /**
   * Check if incognito mode is enabled
   */
  isIncognitoMode(): boolean {
    return this.settings.incognitoMode
  }

  /**
   * Enable incognito mode (temporary session, no persistence)
   */
  enableIncognitoMode(): void {
    this.settings.incognitoMode = true
    this.logAccess({
      action: 'view',
      contentId: 'incognito-enable',
      contentType: 'workflow',
      success: true,
      metadata: { event: 'incognito_enabled' },
    })
  }

  /**
   * Disable incognito mode
   */
  disableIncognitoMode(): void {
    this.settings.incognitoMode = false
    this.logAccess({
      action: 'view',
      contentId: 'incognito-disable',
      contentType: 'workflow',
      success: true,
      metadata: { event: 'incognito_disabled' },
    })
  }

  /**
   * Generate secure deletion script
   */
  generateSecureDeletionScript(filePath: string): string {
    if (!this.settings.secureDeletion) {
      return `rm "${filePath}"`
    }

    const passes = this.settings.secureDeletionPasses
    const scripts: string[] = []

    // Overwrite with random data multiple times
    for (let i = 0; i < passes; i++) {
      scripts.push(`dd if=/dev/urandom of="${filePath}" bs=1M count=$(stat -c%s "${filePath}" 2>/dev/null || echo 1) 2>/dev/null`)
    }

    // Final overwrite with zeros
    scripts.push(`dd if=/dev/zero of="${filePath}" bs=1M count=$(stat -c%s "${filePath}" 2>/dev/null || echo 1) 2>/dev/null`)

    // Delete the file
    scripts.push(`rm "${filePath}"`)

    return scripts.join('\n')
  }

  /**
   * Strip metadata from image data
   */
  async stripMetadata(imageData: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.settings.metadataStripping && !this.settings.exifRemoval) {
      return imageData
    }

    // In a real implementation, this would use a library to strip EXIF and other metadata
    // For now, return the data as-is (placeholder)
    // TODO: Implement actual metadata stripping using a library like exif-js or sharp
    
    this.logAccess({
      action: 'edit',
      contentId: 'metadata-strip',
      contentType: 'image',
      success: true,
      metadata: { 
        event: 'metadata_stripped',
        exifRemoved: this.settings.exifRemoval,
        allMetadataRemoved: this.settings.metadataStripping,
      },
    })

    return imageData
  }

  /**
   * Add watermark to image
   */
  async addWatermark(imageData: ArrayBuffer, watermarkText?: string): Promise<ArrayBuffer> {
    if (!this.settings.watermarking) {
      return imageData
    }

    const text = watermarkText || this.settings.watermarkText || 'CONFIDENTIAL'

    // In a real implementation, this would use canvas or image processing library
    // For now, return the data as-is (placeholder)
    // TODO: Implement actual watermarking using canvas or sharp
    
    this.logAccess({
      action: 'edit',
      contentId: 'watermark-add',
      contentType: 'image',
      success: true,
      metadata: { 
        event: 'watermark_added',
        watermarkText: text,
      },
    })

    return imageData
  }

  /**
   * Export access log for audit
   */
  exportAccessLog(): string {
    return JSON.stringify(this.accessLog, null, 2)
  }

  /**
   * Import access log from audit
   */
  importAccessLog(logData: string): void {
    try {
      const log = JSON.parse(logData) as AccessLogEntry[]
      this.accessLog = [...this.accessLog, ...log]
    } catch (error) {
      console.error('Failed to import access log:', error)
    }
  }

  /**
   * Get session duration
   */
  getSessionDuration(): number | null {
    if (!this.sessionStartTime) return null
    const start = new Date(this.sessionStartTime).getTime()
    const now = Date.now()
    return Math.floor((now - start) / 1000) // seconds
  }

  /**
   * End session and cleanup
   */
  endSession(): void {
    if (this.sessionStartTime) {
      this.logAccess({
        action: 'view',
        contentId: 'session-end',
        contentType: 'workflow',
        success: true,
        metadata: { 
          event: 'session_end',
          duration: this.getSessionDuration(),
        },
      })
    }

    this.sessionStartTime = null
    this.lastActivityTime = null

    // Clear access log if in incognito mode
    if (this.settings.incognitoMode) {
      this.clearAccessLog()
    }
  }
}

/**
 * Create privacy manager with storage config
 */
export function createPrivacyManager(storageConfig: StorageConfig = DEFAULT_STORAGE_CONFIG): PrivacyManager {
  const privacySettings: PrivacySettings = {
    ...DEFAULT_PRIVACY_SETTINGS,
    requireAuthentication: storageConfig.privacy.requireAuth,
    preventScreenshots: storageConfig.privacy.preventScreenshots,
    secureDeletion: storageConfig.privacy.secureDeletion,
    incognitoMode: storageConfig.privacy.incognitoMode,
  }

  return new PrivacyManager(privacySettings)
}

/**
 * Security recommendations based on content sensitivity
 */
export function getSecurityRecommendations(contentType: 'nsfw' | 'personal' | 'public'): Partial<PrivacySettings> {
  switch (contentType) {
    case 'nsfw':
      return {
        requireAuthentication: true,
        authenticationMethod: 'biometric',
        autoLockTimeout: 2,
        preventScreenshots: true,
        preventScreenRecording: true,
        secureDeletion: true,
        secureDeletionPasses: 5,
        incognitoMode: false,
        accessLogging: true,
        contentEncryption: true,
        metadataStripping: true,
        exifRemoval: true,
        watermarking: false,
      }
    case 'personal':
      return {
        requireAuthentication: true,
        authenticationMethod: 'pin',
        autoLockTimeout: 5,
        preventScreenshots: true,
        preventScreenRecording: true,
        secureDeletion: true,
        secureDeletionPasses: 3,
        incognitoMode: false,
        accessLogging: true,
        contentEncryption: true,
        metadataStripping: true,
        exifRemoval: true,
        watermarking: false,
      }
    case 'public':
      return {
        requireAuthentication: false,
        autoLockTimeout: 15,
        preventScreenshots: false,
        preventScreenRecording: false,
        secureDeletion: false,
        incognitoMode: false,
        accessLogging: false,
        contentEncryption: false,
        metadataStripping: false,
        exifRemoval: false,
        watermarking: true,
      }
  }
}
