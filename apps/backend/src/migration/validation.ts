import type { NormalizedStorefrontProduct } from "./types"

export type ValidationIssue = {
  field: string
  message: string
}

export function validateNormalizedProduct(
  product: NormalizedStorefrontProduct
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!product.sourceId.trim()) {
    issues.push({ field: "sourceId", message: "Legacy source ID is required." })
  }

  if (!product.sku.trim()) {
    issues.push({ field: "sku", message: "SKU is required before product import." })
  }

  if (!product.name.trim()) {
    issues.push({ field: "name", message: "Product name is required." })
  }

  if (product.type === "unknown") {
    issues.push({
      field: "type",
      message: "Unknown legacy product type requires explicit review or mapping.",
    })
  }

  if (product.categorySourceIds.length === 0) {
    issues.push({
      field: "categorySourceIds",
      message:
        "At least one recovered category source relationship is required for automatic product import.",
    })
  }

  if (product.mediaSourceIds.length === 0) {
    issues.push({
      field: "mediaSourceIds",
      message:
        "At least one recovered COQUETTE-owned product media source is required for automatic product import.",
    })
  }

  if (product.type === "configurable" && Object.keys(product.optionValues).length > 0) {
    issues.push({
      field: "optionValues",
      message:
        "Configurable parent products must not be treated as purchasable variant option values.",
    })
  }

  if (
    product.regularPrice !== undefined &&
    product.salePrice !== undefined &&
    product.salePrice > product.regularPrice
  ) {
    issues.push({
      field: "salePrice",
      message: "Sale price cannot exceed regular price for automatic import.",
    })
  }

  return issues
}
