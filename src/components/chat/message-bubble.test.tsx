import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MessageBubble } from './message-bubble'

describe('message prompt boxes', () => {
  it('renders an always-available Copy all control for the complete box content', () => {
    const prompt = 'positive prompt, camera details, long anatomical description'
    const html = renderToStaticMarkup(
      <MessageBubble
        message={{ role: 'assistant', content: `\`\`\`text\n${prompt}\n\`\`\`` }}
        index={0}
        onCopy={() => undefined}
        onDelete={() => undefined}
      />,
    )

    expect(html).toContain('Copy all')
    expect(html).toContain('aria-label="Copy everything in this box"')
    expect(html).toContain('prompt-code-scroll')
    expect(html).toContain(prompt)
  })
})
