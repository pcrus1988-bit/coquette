import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import KlarnaPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [KlarnaPaymentProviderService],
})
