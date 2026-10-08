import { useState } from 'react'
import { listenForVoice, isNativeAndroid, cancelVoiceListening } from '../../lib/voice-chat'
import { haptic } from '../../lib/haptics'
interface VoiceInputProps { onTranscript: (text: string) => void; disabled?: boolean }
export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const supported = isNativeAndroid() || !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  const start = async () => {
    if (listening) { await cancelVoiceListening(); return }
    if (disabled) return
    setListening(true); setError('')
    try { const result = await listenForVoice('en-US'); if (!result.cancelled && result.text) { onTranscript(result.text); haptic('success') } }
    catch (err) { setError(err instanceof Error ? err.message : 'Voice input failed'); haptic('error') }
    finally { setListening(false) }
  }
  if (!supported) return null
  return <span><button type="button" onClick={() => { void start() }} disabled={disabled}
    aria-label={listening ? 'Stop listening' : 'Voice input'}
    className="min-h-11 min-w-11 rounded-lg bg-white/10 text-white">{listening ? 'Stop' : 'Mic'}</button>
    {error && <span role="alert" className="text-xs text-red-300">{error}</span>}</span>
}
