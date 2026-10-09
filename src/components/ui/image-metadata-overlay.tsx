import { useState } from 'react';


interface ImageMetadata {
  prompt?: string
  negativePrompt?: string
  seed?: number
  model?: string
  steps?: number
  aspectRatio?: string
  preset?: string
}

interface MetadataOverlayProps {
  metadata: ImageMetadata
  visible: boolean
}

export function MetadataOverlay({ metadata, visible }: MetadataOverlayProps) {
  if (!visible) return null

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-3 overflow-y-auto animate-fade-in">
      <div className="flex flex-col gap-2 text-[12px]">
        {metadata.prompt && (
          <div>
            <div className="text-white/50 font-medium mb-0.5">Prompt</div>
            <div className="text-white/90 leading-relaxed">{metadata.prompt}</div>
          </div>
        )}
        {metadata.negativePrompt && (
          <div>
            <div className="text-white/50 font-medium mb-0.5">Negative</div>
            <div className="text-white/70 leading-relaxed">{metadata.negativePrompt}</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-1">
          {metadata.seed !== undefined && (
            <div>
              <div className="text-white/50 font-medium">Seed</div>
              <div className="text-white/90 font-mono">{metadata.seed}</div>
            </div>
          )}
          {metadata.steps !== undefined && (
            <div>
              <div className="text-white/50 font-medium">Steps</div>
              <div className="text-white/90 font-mono">{metadata.steps}</div>
            </div>
          )}
          {metadata.model && (
            <div>
              <div className="text-white/50 font-medium">Model</div>
              <div className="text-white/90 text-[11px] truncate">{metadata.model}</div>
            </div>
          )}
          {metadata.aspectRatio && (
            <div>
              <div className="text-white/50 font-medium">Aspect</div>
              <div className="text-white/90 font-mono">{metadata.aspectRatio}</div>
            </div>
          )}
          {metadata.preset && (
            <div>
              <div className="text-white/50 font-medium">Quality</div>
              <div className="text-white/90 capitalize">{metadata.preset}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function useMetadataToggle() {
  const [visible, setVisible] = useState(false)
  return { visible, toggle: () => setVisible(v => !v), setVisible }
}
