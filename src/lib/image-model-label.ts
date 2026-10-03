import type { VeniceModel } from '../types/venice'

export function imageModelLabel(model: VeniceModel) {
  const name = model.model_spec?.name || model.id
  const uncensored = model.model_spec?.uncensored === true ||
    (model.model_spec?.uncensored !== false && model.model_spec?.traits?.includes('most_uncensored'))
  return `${name} · ${uncensored ? 'Uncensored' : 'Not marked uncensored'}`
}
