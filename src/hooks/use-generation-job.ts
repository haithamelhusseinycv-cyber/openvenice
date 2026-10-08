import { useState, useEffect } from 'react'
import { generationExecutor, type GenerationJob } from '../services/generation-executor'

export function useGenerationJob() {
  const [job, setJob] = useState<GenerationJob | null>(
    generationExecutor.getCurrentJob(),
  )

  useEffect(() => {
    const unsubscribe = generationExecutor.subscribe((updated) => {
      setJob(updated)
    })
    return unsubscribe
  }, [])

  return job
}
