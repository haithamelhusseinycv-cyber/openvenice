import { useGenerationJob } from '../../hooks/use-generation-job'

const PROVIDER_CONFIG = {
  venice: {
    label: 'Cloud',
    color: 'bg-cyan-400',
    textColor: 'text-cyan-300',
    borderColor: 'border-cyan-400/30',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19c0-1.7-1.3-3-3-3h-11c-1.7 0-3-1.3-3-3s1.3-3 3-3c.3 0 .5 0 .8.1C4.7 7.4 7 5 10 5c3.3 0 6 2.7 6 6 0 .3 0 .5-.1.8 1.7.3 3 1.8 3 3.7 0 2-1.6 3.5-3.4 3.5" />
      </svg>
    ),
  },
  'local-dream': {
    label: 'Local',
    color: 'bg-emerald-400',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-400/30',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6v6H9z" />
      </svg>
    ),
  },
  atelier: {
    label: 'GPU',
    color: 'bg-violet-400',
    textColor: 'text-violet-300',
    borderColor: 'border-violet-400/30',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
} as const

export function BackendIndicator() {
  const job = useGenerationJob()

  if (!job || job.status === 'idle' || job.status === 'completed' || job.status === 'failed') {
    return null
  }

  const config = PROVIDER_CONFIG[job.provider]

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border ${config.borderColor} bg-white/[0.03] px-2 py-0.5`}
      title={`${config.label} backend active`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.color} animate-pulse`} aria-hidden="true" />
      <span className={`text-[10px] font-medium ${config.textColor} uppercase tracking-wider`}>
        {config.label}
      </span>
      <span className="text-white/40" aria-hidden="true">
        {config.icon}
      </span>
    </div>
  )
}
