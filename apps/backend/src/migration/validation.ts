import type { NormalizedStorefrontProduct } from "./types"

export type ValidationIssue = {
  field: string
  message: string
}

const LEGACY_HOST = "coquetteconcept.gr"

function validLegacyUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname === LEGACY_HOST
    )
  } catch {
    return false
  }
}

export function validateNormalizedProduct(
  product: NormalizedStorefrontProduct
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!product.sourceId.trim()) {
    issues.push({ field: "sourceId", message: "Legacy source ID is required." })
  } else if (!validLegacyUrl(product.sourceId)) {
    issues.push({
      field: "sourceId",
      message: `Legacy source ID must be an absolute public URL on ${LEGACY_HOST}.`,
    })
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

  if (product.type === "configurable") {
    issues.push({
      field: "type",
      message:
        "Configurable products cannot be imported automatically until child variant identity, option combinations, pricing and inventory are reconstructed explicitly.",
    })
  }

  if (product.categorySourceIds.length === 0) {
    issues.push({
      field: "categorySourceIds",
      message:
        "At least one recovered category source relationship is required for automatic product import.",
    })
  } else if (product.categorySourceIds.some((url) => !validLegacyUrl(url))) {
    issues.push({
      field: "categorySourceIds",
      message: `All category source relationships must remain on ${LEGACY_HOST}.`,
    })
  }

  if (product.mediaSourceIds.length === 0) {
    issues.push({
      field: "mediaSourceIds",
      message:
        "At least one recovered product media source with captured archive bytes is required for automatic product import.",
    })
  } else if (product.mediaSourceIds.some((url) => !validLegacyUrl(url))) {
    issues.push({
      field: "mediaSourceIds",
      message: `All product media source URLs must remain on ${LEGACY_HOST}.`,
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
