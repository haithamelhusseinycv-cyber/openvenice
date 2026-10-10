import { IntelligentImageStudio } from './intelligent-image-studio'
import { LocalDreamCloudPanel } from './localdream-cloud-panel'
import { LocalDreamPhonePanel } from './localdream-phone-panel'
import { FaceFusionPanel } from './facefusion-panel'

export function LocalDreamPanel({ fullPage = false }: { fullPage?: boolean }) {
  return <><IntelligentImageStudio fullPage={fullPage} /><details className="mx-3 mt-2 shrink-0 text-[15px] text-white/70"><summary className="min-h-11 cursor-pointer py-2">Advanced · individual engines</summary><LocalDreamPhonePanel /><LocalDreamCloudPanel /><FaceFusionPanel /></details></>
}
