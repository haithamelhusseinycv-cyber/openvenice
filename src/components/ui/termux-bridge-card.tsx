import { useState } from 'react'
import { cn } from '../../lib/utils'

export function TermuxBridgeCard({ className }: { className?: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className={cn('chilli-bridge-card', className)} aria-label="Termux and Shizuku setup">
      <div className="chilli-bridge-card__header">
        <div className="chilli-bridge-card__title">
          <span className="chilli-bridge-card__mark">N</span>
          <span>Termux + Shizuku</span>
        </div>
        <span className="chilli-bridge-card__pill">Ready</span>
      </div>

      <div className="chilli-bridge-card__grid">
        <div className="chilli-bridge-card__item">
          <strong>1. Termux</strong>
          <span>Install Termux, then enable local command access for Chilli workflows.</span>
        </div>
        <div className="chilli-bridge-card__item">
          <strong>2. Shizuku</strong>
          <span>Start Shizuku with wireless debugging and keep the service running.</span>
        </div>
        <div className="chilli-bridge-card__item">
          <strong>3. rish shell</strong>
          <span>Use Shizuku rish for ADB-level commands without root.</span>
        </div>
      </div>

      <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)}>
        <summary>Setup command reference</summary>
        <code>
          pkg update &amp;&amp; pkg install android-tools<br />
          sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh<br />
          rish -c &quot;id &amp;&amp; settings list global | head&quot;
        </code>
      </details>
    </section>
  )
}
