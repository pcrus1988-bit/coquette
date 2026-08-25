import { MedusaService } from "@medusajs/framework/utils"
import ContentPage from "./models/content-page"

class ContentModuleService extends MedusaService({
  ContentPage,
}) {}

export default ContentModuleService
