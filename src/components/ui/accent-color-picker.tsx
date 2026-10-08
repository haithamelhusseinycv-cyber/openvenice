import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { haptic } from '../../lib/haptics'

const ACCENT_COLORS = [
  { name: 'Teal', value: '#6ee7d3', label: 'Default' },
  { name: 'Purple', value: '#a78bfa', label: 'Purple' },
  { name: 'Pink', value: '#f472b6', label: 'Pink' },
  { name: 'Blue', value: '#60a5fa', label: 'Blue' },
  { name: 'Green', value: '#34d399', label: 'Green' },
  { name: 'Orange', value: '#fb923c', label: 'Orange' },
]

const STORAGE_KEY = 'chilli-accent-color'

export function useAccentColor() {
  const [accentColor, setAccentColor] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '#6ee7d3'
    } catch {
      return '#6ee7d3'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-accent', accentColor)
    const rgb = hexToRgb(accentColor)
    if (rgb) {
      root.style.setProperty('--color-accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`)
    }
    try {
      localStorage.setItem(STORAGE_KEY, accentColor)
    } catch {
      // ignore
    }
  }, [accentColor])

  return { accentColor, setAccentColor }
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

interface AccentColorPickerProps {
  currentColor: string
  onChange: (color: string) => void
}

export function AccentColorPicker({ currentColor, onChange }: AccentColorPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] font-medium text-white/70">Accent Color</div>
      <div className="grid grid-cols-3 gap-2">
        {ACCENT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => {
              haptic('select')
              onChange(color.value)
            }}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all min-h-16',
              currentColor === color.value
                ? 'border-white/40 bg-white/[0.08]'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]'
            )}
          >
            <div
              className="w-8 h-8 rounded-full shadow-lg"
              style={{ backgroundColor: color.value }}
            />
            <span className="text-[11px] text-white/70 font-medium">{color.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
