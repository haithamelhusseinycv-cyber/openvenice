import { shapeLabel, shapeRatio } from '../../lib/image-shapes'

export function ImageShapePicker({ values, value, onChange }: {
  values: string[]; value: string; onChange: (value: string) => void
}) {
  return (
    <div role="group" aria-label="Image shape" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {values.map((shape) => {
        const ratio = shapeRatio(shape)
        const width = ratio >= 1 ? 48 : 48 * ratio
        const height = ratio >= 1 ? 48 / ratio : 48
        const selected = shape === value
        return (
          <button key={shape} type="button" aria-label={shapeLabel(shape)} aria-pressed={selected}
            onClick={() => onChange(shape)}
            className={`relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-white focus-visible:outline-2 focus-visible:outline-white ${selected ? 'border-white bg-white/15' : 'border-white/15 bg-white/[0.03]'}`}>
            <span className="flex h-12 w-14 items-center justify-center" aria-hidden="true">
              <span style={{ width, height }} className={`block rounded-[2px] border border-white ${shape === 'auto' ? 'border-dashed' : ''}`} />
            </span>
            <span className="text-center text-xs leading-tight">{shapeLabel(shape)}</span>
            {selected && <span aria-hidden="true" className="absolute right-2 top-1 text-sm">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
