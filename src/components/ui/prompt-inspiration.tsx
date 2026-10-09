import { useState } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

interface PromptInspiration {
  category: string
  prompts: Array<{ label: string; prompt: string; negative?: string }>
}

const INSPIRATION_LIBRARY: PromptInspiration[] = [
  {
    category: 'Portrait',
    prompts: [
      {
        label: 'Natural Beauty',
        prompt: 'Photorealistic portrait, natural skin texture with subtle imperfections, soft natural lighting, sharp focus on eyes, realistic anatomy, professional photography',
        negative: 'airbrushed, plastic, CGI, unrealistic, deformed',
      },
      {
        label: 'Studio Lighting',
        prompt: 'Professional studio portrait, dramatic Rembrandt lighting, sharp details, skin pores visible, accurate anatomy, high-end fashion photography',
        negative: 'flat lighting, blurry, cartoon, anime',
      },
      {
        label: 'Golden Hour',
        prompt: 'Warm golden hour portrait, soft backlighting, lens flare, natural skin tones, relaxed pose, candid moment, photorealistic',
        negative: 'harsh shadows, overexposed, artificial',
      },
    ],
  },
  {
    category: 'Couple',
    prompts: [
      {
        label: 'Intimate Connection',
        prompt: 'Photorealistic adult couple, natural interaction, genuine emotion, both faces clearly visible, realistic skin texture, intimate but tasteful, professional photography',
        negative: 'stiff, unnatural, deformed hands, extra limbs',
      },
      {
        label: 'Romantic Evening',
        prompt: 'Couple in romantic setting, soft ambient lighting, natural chemistry, realistic anatomy, both identities distinct, high quality photography',
        negative: 'cartoon, anime, unrealistic proportions',
      },
    ],
  },
  {
    category: 'Artistic',
    prompts: [
      {
        label: 'Fine Art Nude',
        prompt: 'Artistic nude photography, classical composition, dramatic chiaroscuro lighting, museum quality, tasteful and elegant, professional art photography',
        negative: 'vulgar, explicit, low quality',
      },
      {
        label: 'Black & White',
        prompt: 'Monochrome artistic portrait, high contrast, film grain, timeless elegance, professional photography, museum quality',
        negative: 'color, digital look, plastic skin',
      },
    ],
  },
  {
    category: 'Repair & Enhance',
    prompts: [
      {
        label: 'Fix Anatomy',
        prompt: 'Repair anatomy and artifacts while preserving identity, pose, composition, lighting, clothing and background. Fix hands, fingers, and proportions',
        negative: 'deformed, extra limbs, unrealistic',
      },
      {
        label: 'Enhance Quality',
        prompt: 'Enhance image quality, sharpen details, improve lighting, maintain original composition and identity, professional retouching',
        negative: 'change identity, alter pose, unrealistic',
      },
    ],
  },
]

interface PromptInspirationProps {
  onSelect: (prompt: string, negative?: string) => void
}

export function PromptInspiration({ onSelect }: PromptInspirationProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-white/70">Prompt Inspiration</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {INSPIRATION_LIBRARY.map((category) => (
          <div key={category.category} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                haptic('tap')
                setExpandedCategory(expandedCategory === category.category ? null : category.category)
              }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[14px] font-medium text-white/80 hover:bg-white/[0.03] transition-colors min-h-11"
            >
              <span>{category.category}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  'transition-transform',
                  expandedCategory === category.category && 'rotate-180'
                )}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expandedCategory === category.category && (
              <div className="flex flex-col gap-1 px-2 pb-2 animate-fade-in">
                {category.prompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      haptic('select')
                      onSelect(item.prompt, item.negative)
                    }}
                    className="rounded-lg bg-white/[0.04] px-3 py-2 text-left text-[13px] text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors min-h-9"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
