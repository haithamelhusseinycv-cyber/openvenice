export function decodeRawRgb(image: string, width: number, height: number) {
  const binary = atob(image.startsWith('data:') ? image.slice(image.indexOf(',') + 1) : image)
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || binary.length !== width * height * 3) {
    throw new Error('Local Dream returned invalid raw RGB dimensions or data')
  }
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel++) {
    for (let channel = 0; channel < 3; channel++) rgba[pixel * 4 + channel] = binary.charCodeAt(pixel * 3 + channel)
    rgba[pixel * 4 + 3] = 255
  }
  return rgba
}

export function rawRgbPreview(value: { image: string; width: number; height: number }) {
  const canvas = document.createElement('canvas')
  canvas.width = value.width; canvas.height = value.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image preview canvas is unavailable')
  context.putImageData(new ImageData(decodeRawRgb(value.image, value.width, value.height), value.width, value.height), 0, 0)
  return canvas.toDataURL('image/png')
}
