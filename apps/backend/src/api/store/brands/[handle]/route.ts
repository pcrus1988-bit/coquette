import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import ProductBrandLink from "../../../../links/product-brand"
import { BRAND_MODULE } from "../../../../modules/brand"
import type BrandModuleService from "../../../../modules/brand/service"

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
  const limit = parseBoundedInteger(req.query.limit, 24, 1, 100)
  const offset = parseBoundedInteger(req.query.offset, 0, 0, 100_000)
  const brandService = req.scope.resolve<BrandModuleService>(BRAND_MODULE)
  const [brands] = await brandService.listAndCountBrands(
    {
      handle: req.params.handle,
    },
    {
      take: 1,
    }
  )

  const brand = brands[0]

  if (!brand) {
    res.status(404).json({
      message: `Brand '${req.params.handle}' was not found`,
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await query.graph({
    entity: ProductBrandLink.entryPoint,
    fields: ["product_id"],
    filters: {
      brand_id: brand.id,
    },
    pagination: {
      skip: offset,
      take: limit,
    },
  })

  const links = data as Array<{ product_id?: string | null }>
  const productIds = links
    .map((link) => link.product_id)
    .filter((productId): productId is string => Boolean(productId))

  res.json({
    brand: {
      id: brand.id,
      name: brand.name,
      handle: brand.handle,
      description: brand.description,
      logo_url: brand.logo_url,
    },
    product_ids: productIds,
    count: metadata?.count ?? productIds.length,
    limit,
    offset,
  })
}
