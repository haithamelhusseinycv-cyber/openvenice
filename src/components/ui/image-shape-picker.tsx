import { shapeLabel, shapeRatio } from '../../lib/image-shapes'

export function ImageShapePicker({ values, value, onChange }: {
  values: string[]; value: string; onChange: (value: string) => void
}) {
  return (
    <div role="group" aria-label="Image shape" className="flex flex-wrap gap-1">
      {values.map((shape) => {
        const ratio = shapeRatio(shape)
        const width = ratio >= 1 ? 26 : 26 * ratio
        const height = ratio >= 1 ? 26 / ratio : 26
        const selected = shape === value
        return (
          <button key={shape} type="button" aria-label={shapeLabel(shape)} title={shapeLabel(shape)} aria-pressed={selected}
            onClick={() => onChange(shape)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected ? 'border-white/70 bg-white/15' : 'border-transparent hover:bg-white/[0.06]'}`}>
            <span aria-hidden="true" style={{ width, height }}
              className={`block rounded-[2px] border border-white ${selected ? 'opacity-100' : 'opacity-55'} ${shape === 'auto' ? 'border-dashed' : ''}`} />
          </button>
        )
      })}
    </div>
  )
}
