import { useState } from 'react';

import { haptic } from '../../lib/haptics';

interface PromptTemplate {
  id: string
  name: string
  template: string
  variables: string[]
  category: string
}

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'portrait-basic',
    name: 'Portrait',
    template: 'Photorealistic portrait of {subject}, {lighting} lighting, {style} style, sharp details, natural skin texture',
    variables: ['subject', 'lighting', 'style'],
    category: 'Portrait',
  },
  {
    id: 'couple-scene',
    name: 'Couple Scene',
    template: 'Photorealistic couple, {setting}, {mood} mood, natural interaction, {lighting} lighting, both faces visible',
    variables: ['setting', 'mood', 'lighting'],
    category: 'Couple',
  },
  {
    id: 'artistic-study',
    name: 'Artistic Study',
    template: '{medium} of {subject}, {composition} composition, {color_palette} color palette, {style} style',
    variables: ['medium', 'subject', 'composition', 'color_palette', 'style'],
    category: 'Artistic',
  },
  {
    id: 'repair-enhance',
    name: 'Repair & Enhance',
    template: 'Repair anatomy and artifacts in {description}, preserve {preserve_aspects}, improve {improve_aspects}',
    variables: ['description', 'preserve_aspects', 'improve_aspects'],
    category: 'Repair',
  },
]

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void
}

export function PromptTemplates({ onSelect }: PromptTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  const handleTemplateSelect = (template: PromptTemplate) => {
    haptic('select')
    setSelectedTemplate(template)
    setValues({})
  }

  const handleValueChange = (variable: string, value: string) => {
    setValues(prev => ({ ...prev, [variable]: value }))
  }

  const handleApply = () => {
    if (!selectedTemplate) return
    let result = selectedTemplate.template
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(`{${key}}`, value || key)
    }
    haptic('success')
    onSelect(result)
    setSelectedTemplate(null)
    setValues({})
  }

  if (selectedTemplate) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-white">{selectedTemplate.name}</span>
          <button
            type="button"
            onClick={() => { setSelectedTemplate(null); setValues({}) }}
            className="text-[12px] text-white/50 hover:text-white/80 min-h-8 px-2"
          >
            Back
          </button>
        </div>
        <div className="text-[12px] text-white/50 italic">{selectedTemplate.template}</div>
        <div className="flex flex-col gap-2">
          {selectedTemplate.variables.map((variable) => (
            <div key={variable}>
              <label className="text-[12px] text-white/60 font-medium capitalize mb-1 block">
                {variable.replace(/_/g, ' ')}
              </label>
              <input
                type="text"
                value={values[variable] || ''}
                onChange={(e) => handleValueChange(variable, e.target.value)}
                placeholder={`Enter ${variable.replace(/_/g, ' ')}…`}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-white/[0.25] placeholder:text-white/30 min-h-10"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleApply}
          className="rounded-xl bg-[var(--color-accent)] text-black px-4 py-2.5 text-[14px] font-semibold min-h-11 hover:opacity-90 active:scale-95 transition-all"
        >
          Apply Template
        </button>
      </div>
    )
  }

  const categories = Array.from(new Set(DEFAULT_TEMPLATES.map(t => t.category)))

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-white/70">Prompt Templates</span>
      {categories.map(category => (
        <div key={category} className="flex flex-col gap-1">
          <span className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{category}</span>
          {DEFAULT_TEMPLATES.filter(t => t.category === category).map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateSelect(template)}
              className="rounded-lg bg-white/[0.04] px-3 py-2 text-left text-[13px] text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors min-h-9"
            >
              {template.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
