import { FaceFusionConnector } from './facefusion-connector'
import { CapacitorFaceFusionBridge, isNativeOpenVeniceAndroid } from './capacitor-facefusion-bridge'
import { CloudFaceFusionBridge } from './cloud-facefusion-bridge'

export function defaultFaceFusionConnector() {
  return new FaceFusionConnector(isNativeOpenVeniceAndroid()
    ? new CapacitorFaceFusionBridge()
    : new CloudFaceFusionBridge())
}
