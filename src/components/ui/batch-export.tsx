import { useState } from 'react';
import { haptic } from '../../lib/haptics';
import { toast } from '../../stores/toast-store';

interface BatchExportProps {
  images: string[]
  prompts?: string[]
}

export function BatchExport({ images, prompts }: BatchExportProps) {
void prompts;
  const [exporting, setExporting] = useState(false)

  const exportAsZip = async () => {
    if (images.length === 0 || exporting) return

    haptic('tap')
    setExporting(true)

    try {
      const blobs: Blob[] = []
      const names: string[] = []

      for (let i = 0; i < images.length; i++) {
        const src = images[i]
        const response = await fetch(src)
        const blob = await response.blob()
        blobs.push(blob)
        names.push(`chilli-${Date.now()}-${i + 1}.jpg`)
      }

      if (blobs.length === 1) {
        const url = URL.createObjectURL(blobs[0])
        const a = document.createElement('a')
        a.href = url
        a.download = names[0]
        a.click()
        URL.revokeObjectURL(url)
        haptic('success')
        toast.success('Exported', names[0])
        return
      }

      for (let i = 0; i < blobs.length; i++) {
        const url = URL.createObjectURL(blobs[i])
        const a = document.createElement('a')
        a.href = url
        a.download = names[i]
        a.click()
        URL.revokeObjectURL(url)
        await new Promise(r => setTimeout(r, 200))
      }

      haptic('success')
      toast.success('Exported', `${blobs.length} images downloaded`)
    } catch (error) {
      console.error('Export failed:', error)
      haptic('error')
      toast.info('Export failed', 'Try downloading images individually')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={exportAsZip}
      disabled={images.length === 0 || exporting}
      className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.08] px-4 py-3 text-[14px] font-medium text-white/80 hover:bg-white/[0.08] hover:text-white transition-all min-h-12 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {exporting ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span>Exporting…</span>
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export All{images.length > 0 ? ` (${images.length})` : ''}</span>
        </>
      )}
    </button>
  )
}
