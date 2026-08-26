import type { StoreCart } from "../providers/cart"

export type KlarnaOrderLine = {
  type: "physical" | "shipping_fee"
  reference: string
  name: string
  quantity: number
  unit_price: number
  tax_rate: number
  total_amount: number
  total_discount_amount: number
  total_tax_amount: number
}

export class KlarnaCartPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KlarnaCartPayloadError"
  }
}

export function buildKlarnaPaymentSessionData(
  cart: StoreCart,
  language: "el" | "en"
) {
  const cartTotal = toMinorUnits(cart.total)
  const itemLines = (cart.items ?? []).map((item) => {
    if (item.total == null || item.tax_total == null) {
      throw new KlarnaCartPayloadError(
        "Klarna requires expanded authoritative item totals and tax totals."
      )
    }

    const totalAmount = toMinorUnits(item.total)
    const taxAmount = toMinorUnits(item.tax_total)
    const discountAmount = toMinorUnits(item.discount_total ?? 0)
    const originalTotal = toMinorUnits(
      item.original_total ?? Number(item.total) + Number(item.discount_total ?? 0)
    )

    return {
      type: "physical" as const,
      reference: item.variant_sku || item.variant_id || item.id,
      name: item.product_title || item.title || item.variant_title || "COQUETTE item",
      quantity: Number(item.quantity),
      unit_price: unitPriceFromOriginalTotal(originalTotal, Number(item.quantity)),
      tax_rate: taxRateFromInclusiveTotals(totalAmount, taxAmount),
      total_amount: totalAmount,
      total_discount_amount: discountAmount,
      total_tax_amount: taxAmount,
    }
  })

  const shippingLines = (cart.shipping_methods ?? []).map((method) => {
    if (method.total == null || method.tax_total == null) {
      throw new KlarnaCartPayloadError(
        "Klarna requires expanded authoritative shipping totals and tax totals."
      )
    }

    const totalAmount = toMinorUnits(method.total)
    const taxAmount = toMinorUnits(method.tax_total)
    const discountAmount = toMinorUnits(method.discount_total ?? 0)
    const originalTotal = toMinorUnits(
      method.original_total ?? Number(method.total) + Number(method.discount_total ?? 0)
    )

    return {
      type: "shipping_fee" as const,
      reference: method.shipping_option_id || method.id,
      name: method.name || "COQUETTE delivery",
      quantity: 1,
      unit_price: originalTotal,
      tax_rate: taxRateFromInclusiveTotals(totalAmount, taxAmount),
      total_amount: totalAmount,
      total_discount_amount: discountAmount,
      total_tax_amount: taxAmount,
    }
  })

  const orderLines: KlarnaOrderLine[] = [...itemLines, ...shippingLines]
  if (!orderLines.length) {
    throw new KlarnaCartPayloadError("Klarna cannot initialize an empty order.")
  }

  const lineTotal = orderLines.reduce((sum, line) => sum + line.total_amount, 0)
  if (lineTotal !== cartTotal) {
    throw new KlarnaCartPayloadError(
      `Klarna line total ${lineTotal} does not match the Medusa cart total ${cartTotal}. Checkout contains a total component that has not been mapped explicitly.`
    )
  }

  const orderTaxAmount = orderLines.reduce(
    (sum, line) => sum + line.total_tax_amount,
    0
  )
  const cartTaxAmount = toMinorUnits(cart.tax_total ?? 0)
  if (orderTaxAmount !== cartTaxAmount) {
    throw new KlarnaCartPayloadError(
      `Klarna line tax ${orderTaxAmount} does not match the Medusa cart tax total ${cartTaxAmount}.`
    )
  }

  const purchaseCountry = (
    cart.shipping_address?.country_code ||
    cart.billing_address?.country_code ||
    "gr"
  ).toUpperCase()

  return {
    order_lines: orderLines,
    order_tax_amount: orderTaxAmount,
    purchase_country: purchaseCountry,
    locale: language === "en" ? "en-GR" : "el-GR",
  }
}

function toMinorUnits(amount: number | null | undefined) {
  const value = Number(amount ?? 0)
  if (!Number.isFinite(value)) {
    throw new KlarnaCartPayloadError("Klarna checkout amount is not finite.")
  }
  return Math.round(value * 100)
}

function unitPriceFromOriginalTotal(originalTotal: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new KlarnaCartPayloadError("Klarna order line quantity must be positive.")
  }
  return Math.round(originalTotal / quantity)
}

function taxRateFromInclusiveTotals(totalAmount: number, totalTaxAmount: number) {
  if (totalTaxAmount <= 0) {
    return 0
  }

  const netAmount = totalAmount - totalTaxAmount
  if (netAmount <= 0) {
    throw new KlarnaCartPayloadError(
      "Klarna cannot derive a tax rate from a non-positive net line amount."
    )
  }

  // Klarna expresses tax rate in basis points, for example 2400 = 24%.
  return Math.round((10000 * totalTaxAmount) / netAmount)
}
