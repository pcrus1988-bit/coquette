import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BRAND_MODULE } from "../../../modules/brand"
import type BrandModuleService from "../../../modules/brand/service"

const parseBoundedInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)))
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const limit = parseBoundedInteger(req.query.limit, 200, 1, 200)
  const offset = parseBoundedInteger(req.query.offset, 0, 0, 100_000)
  const brandService = req.scope.resolve<BrandModuleService>(BRAND_MODULE)
  const [brands, count] = await brandService.listAndCountBrands(
    {},
    {
      skip: offset,
      take: limit,
    }
  )

  const publicBrands = brands
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      handle: brand.handle,
      description: brand.description,
      logo_url: brand.logo_url,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  res.json({
    brands: publicBrands,
    count,
    limit,
    offset,
  })
}
