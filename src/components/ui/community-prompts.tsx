import { useState, useMemo } from 'react'
import { haptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'

type PromptCategory = 'Portrait' | 'Couple' | 'Artistic' | 'Fantasy' | 'Scene'

interface CommunityPrompt {
  id: string
  prompt: string
  negative: string
  description: string
  category: PromptCategory
}

const CATEGORIES: PromptCategory[] = ['Portrait', 'Couple', 'Artistic', 'Fantasy', 'Scene']

const CURATED_PROMPTS: CommunityPrompt[] = [
  {
    id: 'p1',
    prompt: 'beautiful woman, flowing auburn hair, soft natural lighting, shallow depth of field, warm tones, looking at camera, detailed skin texture, professional photography',
    negative: 'blurry, deformed, ugly, bad anatomy, watermark, text',
    description: 'Natural portrait with warm lighting',
    category: 'Portrait',
  },
  {
    id: 'p2',
    prompt: 'elegant man in tailored suit, dramatic side lighting, dark moody background, confident expression, cinematic color grading, sharp details, editorial style',
    negative: 'blurry, cartoon, anime, low quality, watermark',
    description: 'Moody editorial male portrait',
    category: 'Portrait',
  },
  {
    id: 'p3',
    prompt: 'young woman in golden hour sunlight, freckles, wind-blown hair, dreamy bokeh background, soft pastel colors, intimate close-up, film grain',
    negative: 'harsh shadows, overexposed, blurry, deformed',
    description: 'Golden hour dreamy portrait',
    category: 'Portrait',
  },
  {
    id: 'p4',
    prompt: 'athletic woman in yoga pose, studio lighting, form-fitting clothing, clean white background, fitness photography, sharp focus on form',
    negative: 'blurry, distorted body, bad proportions, watermark',
    description: 'Fitness studio portrait',
    category: 'Portrait',
  },
  {
    id: 'p5',
    prompt: 'romantic couple embracing, sunset beach, warm golden light, waves in background, candid moment, soft focus, cinematic wide shot',
    negative: 'ugly, deformed, blurry, bad anatomy, watermark',
    description: 'Romantic sunset beach embrace',
    category: 'Couple',
  },
  {
    id: 'p6',
    prompt: 'couple dancing in rain, city street at night, neon reflections, wet pavement, dramatic lighting, passionate pose, cinematic composition',
    negative: 'blurry, low quality, distorted faces, watermark',
    description: 'Rainy night city dance',
    category: 'Couple',
  },
  {
    id: 'p7',
    prompt: 'couple sitting on rooftop, city skyline at dusk, fairy lights, cozy atmosphere, intimate conversation, warm tones, lifestyle photography',
    negative: 'ugly, blurry, deformed, bad anatomy, text',
    description: 'Rooftop date at dusk',
    category: 'Couple',
  },
  {
    id: 'p8',
    prompt: 'abstract fluid art, swirling iridescent colors, metallic gold and deep blue, macro photography style, organic shapes, high contrast, 8K detail',
    negative: 'text, watermark, low quality, blurry',
    description: 'Abstract metallic fluid art',
    category: 'Artistic',
  },
  {
    id: 'p9',
    prompt: 'surreal double exposure, woman silhouette filled with starry night sky, mountains, dreamlike atmosphere, fine art photography, ethereal mood',
    negative: 'ugly, blurry, low quality, distorted',
    description: 'Surreal double exposure landscape',
    category: 'Artistic',
  },
  {
    id: 'p10',
    prompt: 'oil painting style, renaissance inspired, dramatic chiaroscuro lighting, rich warm palette, classical composition, textured brushstrokes visible',
    negative: 'modern, digital look, flat, blurry, watermark',
    description: 'Renaissance oil painting style',
    category: 'Artistic',
  },
  {
    id: 'p11',
    prompt: 'cyberpunk cityscape, neon signs in Japanese, rain-soaked streets, flying vehicles, holographic advertisements, blade runner atmosphere, ultra detailed',
    negative: 'daylight, clean, rural, blurry, low quality',
    description: 'Neon cyberpunk cityscape',
    category: 'Artistic',
  },
  {
    id: 'p12',
    prompt: 'ethereal elf queen, enchanted forest, bioluminescent flowers, flowing silver hair, ornate crown, mystical fog, fantasy art, intricate details, magical atmosphere',
    negative: 'ugly, blurry, modern clothing, low quality, watermark',
    description: 'Ethereal elf queen in enchanted forest',
    category: 'Fantasy',
  },
  {
    id: 'p13',
    prompt: 'dragon rider soaring above clouds, epic fantasy scene, dramatic sunset, armored warrior on dragon back, cinematic wide angle, volumetric clouds, golden light',
    negative: 'blurry, low quality, modern elements, watermark',
    description: 'Epic dragon rider scene',
    category: 'Fantasy',
  },
  {
    id: 'p14',
    prompt: 'underwater mermaid, coral reef kingdom, shafts of sunlight through water, tropical fish, flowing red hair, iridescent tail, magical underwater scene',
    negative: 'ugly, blurry, distorted, low quality, text',
    description: 'Underwater mermaid kingdom',
    category: 'Fantasy',
  },
  {
    id: 'p15',
    prompt: 'dark sorceress in gothic castle, candlelight, ancient spell book, swirling dark magic, ornate black dress, dramatic shadows, dark fantasy art',
    negative: 'bright, cheerful, modern, blurry, low quality',
    description: 'Dark sorceress in gothic castle',
    category: 'Fantasy',
  },
  {
    id: 'p16',
    prompt: 'luxury penthouse interior, floor to ceiling windows, city night view, modern minimalist design, ambient lighting, marble floors, high-end furniture',
    negative: 'messy, old, damaged, blurry, low quality, watermark',
    description: 'Luxury penthouse at night',
    category: 'Scene',
  },
  {
    id: 'p17',
    prompt: 'tropical beach paradise, crystal clear turquoise water, white sand, palm trees, overwater bungalow, perfect blue sky, travel photography, vibrant colors',
    negative: 'polluted, cloudy, dark, blurry, low quality',
    description: 'Tropical paradise beach',
    category: 'Scene',
  },
  {
    id: 'p18',
    prompt: 'cozy cabin in snowy mountains, warm light from windows, smoke from chimney, pine trees, starry night sky, northern lights, winter wonderland',
    negative: 'summer, green, blurry, low quality, watermark',
    description: 'Snowy mountain cabin with aurora',
    category: 'Scene',
  },
  {
    id: 'p19',
    prompt: 'japanese garden in autumn, red maple trees, koi pond, wooden bridge, stone lanterns, misty morning, serene atmosphere, traditional architecture',
    negative: 'modern, urban, blurry, low quality, people',
    description: 'Japanese autumn garden',
    category: 'Scene',
  },
  {
    id: 'p20',
    prompt: 'steampunk workshop, brass gears and cogs, vintage machinery, warm amber lighting, inventor workspace, detailed mechanical parts, victorian industrial',
    negative: 'modern, clean, digital, blurry, low quality',
    description: 'Steampunk inventor workshop',
    category: 'Scene',
  },
  {
    id: 'p21',
    prompt: 'warrior princess in ornate armor, battlefield at dawn, dramatic clouds, sword raised, epic composition, cinematic lighting, detailed armor engravings',
    negative: 'ugly, blurry, modern clothing, low quality, watermark',
    description: 'Epic warrior princess',
    category: 'Fantasy',
  },
  {
    id: 'p22',
    prompt: 'vintage cafe interior, afternoon sunlight through lace curtains, old wooden tables, coffee cups, bookshelves, nostalgic warm tones, film photography style',
    negative: 'modern, digital, harsh light, blurry, low quality',
    description: 'Vintage cafe afternoon light',
    category: 'Scene',
  },
  {
    id: 'p23',
    prompt: 'couple under cherry blossoms, spring park, pink petals falling, soft sunlight, romantic atmosphere, traditional japanese garden, gentle bokeh',
    negative: 'ugly, blurry, winter, dead trees, low quality',
    description: 'Cherry blossom romance',
    category: 'Couple',
  },
  {
    id: 'p24',
    prompt: 'watercolor painting of wildflowers, soft pastel colors, loose brushstrokes, white background, botanical illustration style, delicate and airy',
    negative: 'realistic, dark, heavy, digital art, blurry',
    description: 'Watercolor wildflower botanical',
    category: 'Artistic',
  },
]

const CATEGORY_ICONS: Record<PromptCategory, string> = {
  Portrait: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  Couple: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  Artistic: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  Fantasy: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  Scene: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
}

interface CommunityPromptBrowserProps {
  onSelect: (prompt: string, negative: string) => void
}

export function CommunityPromptBrowser({ onSelect }: CommunityPromptBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let results = CURATED_PROMPTS
    if (selectedCategory !== 'All') {
      results = results.filter((p) => p.category === selectedCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      results = results.filter(
        (p) =>
          p.prompt.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      )
    }
    return results
  }, [selectedCategory, searchQuery])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompts..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[14px] text-white outline-none focus:border-white/[0.25] placeholder:text-white/35 min-h-11"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => { haptic('select'); setSelectedCategory('All') }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors min-h-8',
            selectedCategory === 'All'
              ? 'bg-white/15 text-white'
              : 'bg-white/[0.04] text-white/50 hover:text-white/70',
          )}
        >
          All ({CURATED_PROMPTS.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = CURATED_PROMPTS.filter((p) => p.category === cat).length
          return (
            <button
              key={cat}
              type="button"
              onClick={() => { haptic('select'); setSelectedCategory(cat) }}
              className={cn(
                'flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors min-h-8',
                selectedCategory === cat
                  ? 'bg-white/15 text-white'
                  : 'bg-white/[0.04] text-white/50 hover:text-white/70',
              )}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={CATEGORY_ICONS[cat]} />
              </svg>
              {cat} ({count})
            </button>
          )
        })}
      </div>

      <div className="text-[12px] text-white/30">{filtered.length} prompts</div>

      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.id
          return (
            <div
              key={item.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => { haptic('tap'); setExpandedId(isExpanded ? null : item.id) }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left min-h-10"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 bg-white/[0.06] rounded px-1.5 py-0.5">
                      {item.category}
                    </span>
                    <span className="text-[13px] text-white/70 truncate">{item.description}</span>
                  </div>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" className={cn('text-white/30 transition-transform shrink-0 ml-2', isExpanded && 'rotate-180')}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
                  <p className="text-[12px] text-white/60 leading-relaxed break-words">
                    {item.prompt}
                  </p>
                  <p className="text-[11px] text-white/35 leading-relaxed break-words">
                    <span className="text-white/20">Negative: </span>{item.negative}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      haptic('select')
                      onSelect(item.prompt, item.negative)
                    }}
                    className="self-start rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/70 hover:bg-white/15 hover:text-white min-h-8"
                  >
                    Use this prompt
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-[13px] text-white/40">
            No prompts match your search.
          </div>
        )}
      </div>
    </div>
  )
}
