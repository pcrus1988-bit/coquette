import { sourceChecksum } from "./checksum"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductCandidate,
  type RecoveryProductFields,
} from "./recovery-candidates"

export type IndexedRecoveryCatalogSignal = {
  url?: string
  observedCount?: number
  unit?: string
  indexFreshness?: string
  notes?: string
}

export type IndexedRecoveryProductSpotCheck = {
  name?: string
  priceEur?: number
  regularPriceEur?: number
  salePriceEur?: number
  status?: string
  sourceUrl?: string
  indexFreshness?: string
}

export type IndexedRecoveryBaseline = {
  schemaVersion?: number
  observedAt?: string
  provenance?: {
    kind?: string
    sourceHost?: string
    confidence?: string
    freshnessWarning?: string
  }
  catalogSignals?: IndexedRecoveryCatalogSignal[]
  currentDesignerSeeds?: string[]
  categorySeeds?: Record<string, string[]>
  recentProductSpotChecks?: IndexedRecoveryProductSpotCheck[]
  rules?: string[]
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function indexedCandidateKey(product: IndexedRecoveryProductSpotCheck) {
  return `indexed:${sourceChecksum({
    sourceUrl: product.sourceUrl ?? "",
    name: product.name ?? "",
  }).slice(0, 20)}`
}

function productFields(product: IndexedRecoveryProductSpotCheck) {
  const fields: RecoveryProductFields = {}

  if (nonEmptyString(product.name)) fields.name = product.name.trim()

  if (positiveNumber(product.regularPriceEur)) {
    fields.regularPrice = product.regularPriceEur
  } else if (positiveNumber(product.priceEur)) {
    fields.regularPrice = product.priceEur
  }

  if (positiveNumber(product.salePriceEur)) {
    fields.salePrice = product.salePriceEur
  }

  if (fields.regularPrice !== undefined || fields.salePrice !== undefined) {
    fields.currencyCode = "EUR"
  }

  return fields
}

export function buildIndexedRecoveryProductCandidates(
  baseline: IndexedRecoveryBaseline
): RecoveryProductCandidate[] {
  const spotChecks = Array.isArray(baseline.recentProductSpotChecks)
    ? baseline.recentProductSpotChecks
    : []

  return spotChecks.map((product) => {
    const sourceUrl = nonEmptyString(product.sourceUrl)
      ? product.sourceUrl
      : "https://coquetteconcept.gr/"

    return buildRecoveryProductCandidate(indexedCandidateKey(product), [
      {
        authority: "public_search_index",
        sourceUrl,
        freshnessLabel: product.indexFreshness,
        note: nonEmptyString(product.status)
          ? `Indexed merchandising label=${product.status}`
          : "Indexed product recovery observation",
        fields: productFields(product),
      },
    ])
  })
}
