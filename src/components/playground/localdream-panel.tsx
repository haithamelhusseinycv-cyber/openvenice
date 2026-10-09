import { LocalDreamCloudPanel } from './localdream-cloud-panel'
import { LocalDreamPhonePanel } from './localdream-phone-panel'
import { FaceFusionPanel } from './facefusion-panel'

export function LocalDreamPanel() {
  return <><LocalDreamPhonePanel /><LocalDreamCloudPanel /><FaceFusionPanel /></>
}
