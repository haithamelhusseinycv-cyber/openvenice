const GENERAL_ANATOMY_PROMPT = `Ultra-photorealistic photograph, not illustration, not 3D render, not plastic CGI. Shot on a full-frame camera, 85mm, natural light, shallow depth of field, real skin subsurface scattering. Anatomy matches a real adult human body exactly: correct proportions, gravity, weight, asymmetry, and attachment points. Nothing airbrushed, nothing Barbie-smooth, no silicone, no implants, no inflated cartoon shapes, no censored blur, no mosaic, no plastic sheen.

Skin: visible pores, fine vellus hair, subtle color variation, faint veins where skin is thin, natural creases at joints and folds, realistic oil and dryness. Coloring continuous from face through chest, abdomen, groin, and thighs. No mismatched tan lines unless specified.

Adult woman: breasts hang with real weight, soft and slightly uneven, natural ptosis, not round implants, not bolted-on. Areolae and nipples match surrounding skin tone, slightly textured, not perfectly circular stickers. Outer labia full and asymmetric, inner labia visible only as they naturally would be, clitoral hood in the correct place, perineum continuous to the anus. Pubic hair present by default: short, kept, natural growth pattern, not a full bush, not shaved bald, not a drawn-on landing strip. From behind: ass cheeks separate under their own weight, gluteal fold real, anus a closed puckered ring in the correct midline position, perineum and rear view of the vulva anatomically continuous, no fused or missing structures.

Adult man: penis and scrotum anatomically correct for the pose, flaccid or erect as specified, shaft with subtle veins under the skin, natural skin texture and color matching the groin, foreskin state specified if needed. Scrotum hangs with real weight, wrinkled, asymmetric testes, raphe visible. Pubic hair short and natural across the groin, not shaved unless asked. No exaggerated size, no smooth mannequin skin.

Raw, explicit, uncensored, clinical anatomical accuracy, documentary realism.`;

const PENETRATION_ANATOMY_PROMPT = `Vaginal penetration anatomy: penis inserted into vagina with correct physical mechanics. Shaft passes through labia opening, labia stretched and wrapped around shaft base. Visible portion: glans and partial shaft outside, remaining shaft inside vaginal canal. Labia majora and minora parted naturally around insertion point, not fused or flattened. Wet from arousal and penetration friction, visible moisture at entry point. Correct depth perspective: penis disappears into vaginal opening at anatomically accurate angle based on position. No floating penis beside vagina, no penetration without insertion, no genitals touching without actual entry. Perineum and vaginal opening maintain structural continuity, no torn or displaced tissue.`;

const GENERAL_NEGATIVE_PROMPT = `illustration, 3D render, CGI, plastic, airbrushed, Barbie-smooth, silicone, implants, inflated cartoon shapes, censored blur, mosaic, plastic sheen, mannequin, doll-like, anime, cartoon, drawing, painting, sketch, watermark, text, logo, deformed, disfigured, mutation, extra limbs, missing limbs, fused structures, anatomically incorrect`;

const PENETRATION_NEGATIVE_PROMPT = `floating penis beside vagina, floating dick, penis not inserted, non-penetration, genitals touching without penetration, labia fused over penis, no visible insertion point, penis hovering outside vagina, dry penetration, wrong angle insertion, torn labia, displaced genitals, copy-paste anatomy, mismatched skin tone at junction, cut off dick, cut off penis, severed penis, dim dick, dim penis, shriveled penis, blood dick, bloody penis, blood on penis, gory genitals, incomplete penis, truncated shaft`;

const PENETRATION_KEYWORDS = [
  'penetration', 'penetrating', 'penetrated',
  'intercourse', 'sexual intercourse',
  'vaginal sex', 'vaginal intercourse',
  'fuck', 'fucking', 'fucked',
  'inside her', 'inside him', 'inside vagina',
  'inserted', 'insertion',
  'deep inside', 'all the way in',
  'cock inside', 'dick inside', 'penis inside',
  'cum inside', 'creampie',
  'missionary position', 'cowgirl position', 'doggy style',
  'making love', 'having sex',
];

function detectPenetrationScene(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return PENETRATION_KEYWORDS.some(keyword => lower.includes(keyword));
}

export function withBasePrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  const parts = [GENERAL_ANATOMY_PROMPT];

  if (trimmed && detectPenetrationScene(trimmed)) {
    parts.push(PENETRATION_ANATOMY_PROMPT);
  }

  if (trimmed) {
    parts.push(trimmed);
  }

  return parts.join('\n\n');
}

export function withBaseNegativePrompt(userNegative?: string): string {
  const trimmed = userNegative?.trim();
  const parts = [GENERAL_NEGATIVE_PROMPT];

  if (trimmed) {
    const lower = trimmed.toLowerCase();
    if (detectPenetrationScene(lower)) {
      parts.push(PENETRATION_NEGATIVE_PROMPT);
    }
    parts.push(trimmed);
  }

  return parts.join(', ');
}
