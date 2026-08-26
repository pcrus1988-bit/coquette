type PriceListTypeContainer = {
  price_list_type?: unknown
}

type CalculatedPriceContainer = {
  calculated_price?: PriceListTypeContainer | null
}

export function isMedusaSalePrice(price: unknown): boolean {
  if (!price || typeof price !== "object") {
    return false
  }

  const calculatedPrice = (price as CalculatedPriceContainer).calculated_price

  return calculatedPrice?.price_list_type === "sale"
}
