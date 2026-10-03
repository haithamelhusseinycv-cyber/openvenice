export const DEFAULT_IMAGE_SHAPES = ['1:1', '2:3', '3:4', '4:5', '9:16', '4:3', '3:2', '16:9', '21:9']

export function shapeRatio(value: string): number {
  const [width, height] = value.split(':').map(Number)
  return width > 0 && height > 0 && Number.isFinite(width / height) ? width / height : 1
}

export function shapeLabel(value: string): string {
  const labels: Record<string, string> = {
    auto: 'Original shape', '1:1': 'Square', '2:3': 'Portrait',
    '3:4': 'Classic portrait', '4:5': 'Short portrait', '9:16': 'Tall portrait',
    '4:3': 'Classic landscape', '3:2': 'Landscape', '16:9': 'Wide landscape',
    '21:9': 'Panorama',
  }
  return labels[value] || (shapeRatio(value) < 1 ? 'Portrait' : shapeRatio(value) > 1 ? 'Landscape' : 'Square')
}

export function shapePixels(shape: string, longEdge: number, divisor = 8) {
  const ratio = shapeRatio(shape)
  const unit = Number.isFinite(divisor) && divisor > 0 ? divisor : 8
  const align = (value: number) => Math.max(unit, Math.round(value / unit) * unit)
  return ratio >= 1
    ? { w: align(longEdge), h: align(longEdge / ratio) }
    : { w: align(longEdge * ratio), h: align(longEdge) }
}
