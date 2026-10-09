export interface PromptEnhancement {
  id: string;
  name: string;
  description: string;
  prefix?: string;
  suffix?: string;
  negativeSuffix?: string;
}

export const PROMPT_ENHANCEMENTS: Record<string, PromptEnhancement> = {
  cinematic: {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Dramatic lighting, film grain, anamorphic lens',
    prefix: 'cinematic still, ',
    suffix: ', dramatic lighting, film grain, anamorphic lens, depth of field, movie scene',
    negativeSuffix: 'cartoon, anime, illustration, painting, drawing',
  },
  photorealistic: {
    id: 'photorealistic',
    name: 'Photorealistic',
    description: 'Ultra-realistic photography style',
    prefix: 'photograph, ',
    suffix: ', ultra-realistic, 8k uhd, high detail, sharp focus, professional photography, DSLR',
    negativeSuffix: 'cartoon, anime, illustration, painting, drawing, cgi, render',
  },
  anime: {
    id: 'anime',
    name: 'Anime',
    description: 'Japanese animation style',
    prefix: 'anime style, ',
    suffix: ', anime artwork, vibrant colors, clean lines, studio ghibli inspired',
    negativeSuffix: 'photorealistic, photograph, 3d render',
  },
  'digital-art': {
    id: 'digital-art',
    name: 'Digital Art',
    description: 'Modern digital illustration',
    prefix: 'digital art, ',
    suffix: ', detailed digital painting, artstation, concept art, smooth, sharp focus',
    negativeSuffix: 'photo, photograph, realistic',
  },
  'oil-painting': {
    id: 'oil-painting',
    name: 'Oil Painting',
    description: 'Classical oil painting style',
    prefix: 'oil painting, ',
    suffix: ', classical art, brush strokes, canvas texture, renaissance style',
    negativeSuffix: 'photo, digital, modern',
  },
  'watercolor': {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft watercolor painting',
    prefix: 'watercolor painting, ',
    suffix: ', soft edges, paper texture, flowing colors, artistic, delicate',
    negativeSuffix: 'photo, digital, sharp edges',
  },
  '3d-render': {
    id: '3d-render',
    name: '3D Render',
    description: 'High-quality 3D rendering',
    prefix: '3d render, ',
    suffix: ', octane render, unreal engine, highly detailed, volumetric lighting, ray tracing',
    negativeSuffix: 'photo, painting, drawing, sketch',
  },
  pixel: {
    id: 'pixel',
    name: 'Pixel Art',
    description: 'Retro pixel art style',
    prefix: 'pixel art, ',
    suffix: ', 16-bit, retro game style, crisp pixels, nostalgic',
    negativeSuffix: 'realistic, photograph, smooth',
  },
  fantasy: {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Epic fantasy illustration',
    prefix: 'fantasy art, ',
    suffix: ', magical, ethereal, epic composition, mystical atmosphere, detailed illustration',
    negativeSuffix: 'modern, realistic, photograph',
  },
  'comic-book': {
    id: 'comic-book',
    name: 'Comic Book',
    description: 'American comic book style',
    prefix: 'comic book style, ',
    suffix: ', bold lines, vibrant colors, dynamic composition, graphic novel',
    negativeSuffix: 'realistic, photograph, anime',
  },
};

export function getEnhancement(id: string): PromptEnhancement | undefined {
  return PROMPT_ENHANCEMENTS[id];
}

export function listEnhANCEMENTS(): PromptEnhancement[] {
  return Object.values(PROMPT_ENHANCEMENTS);
}

export function enhancePrompt(prompt: string, enhancementId: string): string {
  const enhancement = getEnhancement(enhancementId);
  if (!enhancement) return prompt;

  let result = prompt;
  if (enhancement.prefix) result = enhancement.prefix + result;
  if (enhancement.suffix) result = result + enhancement.suffix;
  return result;
}

export function enhanceNegativePrompt(negativePrompt: string, enhancementId: string): string {
  const enhancement = getEnhancement(enhancementId);
  if (!enhancement?.negativeSuffix) return negativePrompt;
  return negativePrompt + enhancement.negativeSuffix;
}
