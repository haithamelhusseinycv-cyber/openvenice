import { useState, type ReactNode } from 'react'
import type { ChatArtifact } from '../../types/venice'
import { copyImage, defaultImageFileName, saveImage, shareImage } from '../../lib/native-media'
import { toast } from '../../stores/toast-store'

export type ImageRetryMode = 'repeat' | 'new-seed' | 'improve' | 'settings'

interface ArtifactActionsProps {
  artifact: ChatArtifact
  onRetry?: (mode: ImageRetryMode) => void
  onEdit?: () => void
  onSendLocalDream?: () => void
  onSendFaceFusion?: () => void
  onDiscard?: () => void
}

export function ArtifactActions({
  artifact,
  onRetry,
  onEdit,
  onSendLocalDream,
  onSendFaceFusion,
  onDiscard,
}: ArtifactActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [retryOpen, setRetryOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [busy, setBusy] = useState<'save' | 'share' | 'copy' | null>(null)
  const fileName = defaultImageFileName(artifact.id, artifact.mimeType)

  const handleSave = async () => {
    if (busy) return
    setBusy('save')
    try {
      const result = await saveImage(artifact.url, artifact.mimeType, fileName)
      toast.success('Image saved', result.fileName || fileName)
    } catch (error) {
      toast.fromError(error, 'Could not save image')
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    if (busy) return
    setBusy('share')
    try {
      const result = await shareImage(artifact.url, artifact.mimeType, fileName)
      if (result === 'saved') toast.info('Sharing is unavailable', 'The image was saved instead.')
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.fromError(error, 'Could not share image')
      }
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    if (busy) return
    setBusy('copy')
    try {
      const result = await copyImage(artifact.url, artifact.mimeType)
      toast.success(result === 'image' ? 'Image copied' : 'Image reference copied')
    } catch (error) {
      toast.fromError(error, 'Could not copy image')
    } finally {
      setBusy(null)
      setMenuOpen(false)
    }
  }

  const chooseRetry = (mode: ImageRetryMode) => {
    setRetryOpen(false)
    onRetry?.(mode)
  }

  return (
    <div className="border-t border-white/[0.06] bg-[#0c0c10]/95 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain">
        <ImageAction label={busy === 'save' ? 'Saving' : 'Save'} onClick={() => { void handleSave() }} disabled={Boolean(busy)}>
          <PathIcon path="M12 3v12m0 0l4-4m-4 4l-4-4M5 19h14" />
        </ImageAction>
        <ImageAction label={busy === 'share' ? 'Sharing' : 'Share'} onClick={() => { void handleShare() }} disabled={Boolean(busy)}>
          <PathIcon path="M12 16V4m0 0L8 8m4-4l4 4M5 12v7h14v-7" />
        </ImageAction>
        {onRetry && (
          <div
            className="relative shrink-0"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRetryOpen(false)
            }}
          >
            <ImageAction
              label="Retry"
              onClick={() => {
                setRetryOpen((value) => !value)
                setMenuOpen(false)
              }}
              disabled={Boolean(busy)}
            >
              <PathIcon path="M4 4v6h6M5.5 15a8 8 0 101.8-8.3L4 10" />
            </ImageAction>
            {retryOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-1 w-48 overflow-hidden rounded-xl border border-white/[0.12] bg-[#17171c] p-1 shadow-2xl shadow-black/60">
                <MenuButton label="Repeat task" onClick={() => chooseRetry('repeat')} />
                <MenuButton label="New seed" onClick={() => chooseRetry('new-seed')} />
                <MenuButton label="Improve result" onClick={() => chooseRetry('improve')} />
                <MenuButton label="Change settings" onClick={() => chooseRetry('settings')} />
              </div>
            )}
          </div>
        )}
        {onEdit && (
          <ImageAction label="Edit" onClick={onEdit} disabled={Boolean(busy)}>
            <PathIcon path="M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4" />
          </ImageAction>
        )}

        <div
          className="relative ml-auto shrink-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenuOpen(false)
          }}
        >
          <ImageAction
            label="More"
            onClick={() => {
              setMenuOpen((value) => !value)
              setRetryOpen(false)
            }}
            disabled={Boolean(busy)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </ImageAction>
          {menuOpen && (
            <div className="absolute bottom-full right-0 z-30 mb-1 w-52 overflow-hidden rounded-xl border border-white/[0.12] bg-[#17171c] p-1 shadow-2xl shadow-black/60">
              {onSendLocalDream && <MenuButton label="Send to Local Dream" onClick={() => { setMenuOpen(false); onSendLocalDream() }} />}
              {onSendFaceFusion && <MenuButton label="Send to FaceFusion" onClick={() => { setMenuOpen(false); onSendFaceFusion() }} />}
              <MenuButton label={busy === 'copy' ? 'Copying image…' : 'Copy image'} onClick={() => { void handleCopy() }} />
              <MenuButton label={detailsOpen ? 'Hide details' : 'View details'} onClick={() => { setDetailsOpen((value) => !value); setMenuOpen(false) }} />
              {onDiscard && <MenuButton label="Discard" danger onClick={() => { setMenuOpen(false); onDiscard() }} />}
            </div>
          )}
        </div>
      </div>

      {detailsOpen && (
        <div className="mx-1 mb-1 mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-[11px] leading-relaxed">
          <span className="text-white/30">Tool</span><span className="break-all text-white/55">{artifact.sourceTool || 'Agent image tool'}</span>
          <span className="text-white/30">Size</span><span className="text-white/55">{artifact.width && artifact.height ? `${artifact.width}×${artifact.height}` : 'Unknown'}</span>
          <span className="text-white/30">Format</span><span className="text-white/55">{artifact.format?.toUpperCase() || artifact.mimeType}</span>
          <span className="text-white/30">ID</span><span className="break-all text-white/45">{artifact.id}</span>
        </div>
      )}
    </div>
  )
}

function ImageAction({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/85 disabled:opacity-35"
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

function MenuButton({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[12px] transition-colors ${
        danger
          ? 'text-rose-200/75 hover:bg-rose-500/10 hover:text-rose-100'
          : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

function PathIcon({ path }: { path: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}
