import type { NormalizedMagentoProduct } from "./types"

export type ValidationIssue = {
  field: string
  message: string
}

export function validateNormalizedProduct(
  product: NormalizedMagentoProduct
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!product.sourceId.trim()) {
    issues.push({ field: "sourceId", message: "Magento source ID is required." })
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
      message: "Unknown Magento product type requires manual mapping.",
    })
  }

  if (product.type === "configurable" && Object.keys(product.optionValues).length > 0) {
    issues.push({
      field: "optionValues",
      message:
        "Configurable parent products must not be treated as purchasable variant option values.",
    })
  }

  return issues
}
