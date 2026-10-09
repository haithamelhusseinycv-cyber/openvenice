import { useEffect } from 'react'

export function useKeyboardDetection() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const update = () => {
      const keyboardOpen = viewport.height < window.innerHeight - 140
      document.body.classList.toggle('chilli-keyboard-open', keyboardOpen)
    }

    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    update()

    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
}
