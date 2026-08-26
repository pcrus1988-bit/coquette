import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

type CatalogSignal = {
  url?: unknown
  observedCount?: unknown
  unit?: unknown
  indexFreshness?: unknown
}

type ProductSpotCheck = {
  name?: unknown
  sourceUrl?: unknown
  indexFreshness?: unknown
  priceEur?: unknown
  regularPriceEur?: unknown
  salePriceEur?: unknown
}

type RecoveryBaseline = {
  schemaVersion?: unknown
  observedAt?: unknown
  purpose?: unknown
  provenance?: {
    kind?: unknown
    sourceHost?: unknown
    confidence?: unknown
    freshnessWarning?: unknown
  }
  catalogSignals?: unknown
  currentDesignerSeeds?: unknown
  categorySeeds?: unknown
  recentProductSpotChecks?: unknown
  rules?: unknown
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function sourceUrlIsValid(value: unknown, sourceHost: string) {
  if (!nonEmptyString(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === sourceHost
  } catch {
    return false
  }
}

async function main() {
  const path = resolve(
    process.cwd(),
    "../../docs/migration/indexed-recovery-baseline.json"
  )
  const raw = await readFile(path, "utf8")
  const baseline = JSON.parse(raw) as RecoveryBaseline
  const errors: string[] = []

  if (baseline.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1")
  }

  if (!nonEmptyString(baseline.observedAt) || Number.isNaN(Date.parse(baseline.observedAt))) {
    errors.push("observedAt must be an ISO-compatible timestamp")
  }

  if (!nonEmptyString(baseline.purpose)) {
    errors.push("purpose is required")
  }

  const sourceHost = baseline.provenance?.sourceHost
  if (baseline.provenance?.kind !== "public_search_index") {
    errors.push("provenance.kind must remain public_search_index")
  }
  if (baseline.provenance?.confidence !== "derived") {
    errors.push("indexed recovery confidence must remain derived")
  }
  if (!nonEmptyString(sourceHost)) {
    errors.push("provenance.sourceHost is required")
  }
  if (!nonEmptyString(baseline.provenance?.freshnessWarning)) {
    errors.push("provenance.freshnessWarning is required")
  }

  const signals = Array.isArray(baseline.catalogSignals)
    ? (baseline.catalogSignals as CatalogSignal[])
    : []
  if (signals.length === 0) {
    errors.push("catalogSignals must contain at least one reconciliation signal")
  }

  const seenUrls = new Set<string>()
  for (const [index, signal] of signals.entries()) {
    if (!sourceUrlIsValid(signal.url, nonEmptyString(sourceHost) ? sourceHost : "")) {
      errors.push(`catalogSignals[${index}].url must be HTTPS on the source host`)
    }
    if (nonEmptyString(signal.url)) {
      if (seenUrls.has(signal.url)) {
        errors.push(`catalogSignals contains duplicate URL ${signal.url}`)
      }
      seenUrls.add(signal.url)
    }
    if (!positiveNumber(signal.observedCount)) {
      errors.push(`catalogSignals[${index}].observedCount must be positive`)
    }
    if (signal.unit !== "items") {
      errors.push(`catalogSignals[${index}].unit must be items`)
    }
    if (!nonEmptyString(signal.indexFreshness)) {
      errors.push(`catalogSignals[${index}].indexFreshness is required`)
    }
  }

  const designers = Array.isArray(baseline.currentDesignerSeeds)
    ? baseline.currentDesignerSeeds
    : []
  const designerNames = designers.filter(nonEmptyString)
  if (designerNames.length !== designers.length || designerNames.length === 0) {
    errors.push("currentDesignerSeeds must be a non-empty string list")
  }
  if (new Set(designerNames).size !== designerNames.length) {
    errors.push("currentDesignerSeeds must not contain duplicates")
  }

  if (
    !baseline.categorySeeds ||
    typeof baseline.categorySeeds !== "object" ||
    Array.isArray(baseline.categorySeeds)
  ) {
    errors.push("categorySeeds must be an object of named string arrays")
  } else {
    for (const [group, values] of Object.entries(
      baseline.categorySeeds as Record<string, unknown>
    )) {
      if (!Array.isArray(values) || values.length === 0 || !values.every(nonEmptyString)) {
        errors.push(`categorySeeds.${group} must be a non-empty string list`)
      }
    }
  }

  const spotChecks = Array.isArray(baseline.recentProductSpotChecks)
    ? (baseline.recentProductSpotChecks as ProductSpotCheck[])
    : []
  for (const [index, product] of spotChecks.entries()) {
    if (!nonEmptyString(product.name)) {
      errors.push(`recentProductSpotChecks[${index}].name is required`)
    }
    if (!sourceUrlIsValid(product.sourceUrl, nonEmptyString(sourceHost) ? sourceHost : "")) {
      errors.push(
        `recentProductSpotChecks[${index}].sourceUrl must be HTTPS on the source host`
      )
    }
    if (!nonEmptyString(product.indexFreshness)) {
      errors.push(`recentProductSpotChecks[${index}].indexFreshness is required`)
    }
    for (const [field, value] of [
      ["priceEur", product.priceEur],
      ["regularPriceEur", product.regularPriceEur],
      ["salePriceEur", product.salePriceEur],
    ] as const) {
      if (value !== undefined && !positiveNumber(value)) {
        errors.push(`recentProductSpotChecks[${index}].${field} must be positive`)
      }
    }
  }

  const rules = Array.isArray(baseline.rules) ? baseline.rules : []
  if (rules.length < 4 || !rules.every(nonEmptyString)) {
    errors.push("rules must retain the provenance/reconciliation safeguards")
  }

  if (errors.length) {
    console.error("Indexed recovery contract failed:")
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceHost,
        catalogSignals: signals.length,
        designerSeeds: designerNames.length,
        productSpotChecks: spotChecks.length,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
