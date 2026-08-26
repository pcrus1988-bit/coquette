import type { CapturePageRecord } from "./capture-ingestion"
import type { IndexedRecoveryBaseline } from "./indexed-recovery"

export const reconstructionUrlStatuses = [
  "captured",
  "skipped",
  "error",
  "indexed_only",
  "unavailable",
] as const

export type ReconstructionUrlStatus =
  (typeof reconstructionUrlStatuses)[number]

export type ReconstructionUrlEvidence = {
  source: "direct_capture" | "public_search_index" | "manual_classification"
  observedAt?: string
  captureStatus?: string
  httpStatus?: number
  pageType?: string
  checksum?: string
  error?: string
  note?: string
}

export type ReconstructionUrlEntry = {
  url: string
  status: ReconstructionUrlStatus
  canonicalUrl?: string
  evidence: ReconstructionUrlEvidence[]
}

export type ReconstructionUrlUniverse = {
  entries: ReconstructionUrlEntry[]
  totals: Record<ReconstructionUrlStatus, number>
  unresolved: number
  isFullyClassified: boolean
}

function normalize(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    url.hash = ""
    return url.toString()
  } catch {
    return undefined
  }
}

function indexedUrls(baseline: IndexedRecoveryBaseline) {
  const values = new Set<string>()

  for (const signal of baseline.catalogSignals ?? []) {
    if (signal.url) {
      const normalized = normalize(signal.url)
      if (normalized) values.add(normalized)
    }
  }

  for (const product of baseline.recentProductSpotChecks ?? []) {
    if (product.sourceUrl) {
      const normalized = normalize(product.sourceUrl)
      if (normalized) values.add(normalized)
    }
  }

  return values
}

function directStatus(record: CapturePageRecord): ReconstructionUrlStatus {
  if (record.status === "captured") return "captured"
  if (record.status === "skipped") return "skipped"
  return "error"
}

function statusRank(status: ReconstructionUrlStatus) {
  const rank: Record<ReconstructionUrlStatus, number> = {
    captured: 5,
    skipped: 4,
    error: 3,
    unavailable: 2,
    indexed_only: 1,
  }
  return rank[status]
}

export function buildReconstructionUrlUniverse(
  pages: CapturePageRecord[],
  baseline: IndexedRecoveryBaseline,
  manualUnavailable: Array<{ url: string; note: string }> = []
): ReconstructionUrlUniverse {
  const byUrl = new Map<string, ReconstructionUrlEntry>()

  function upsert(
    url: string,
    status: ReconstructionUrlStatus,
    evidence: ReconstructionUrlEvidence,
    canonicalUrl?: string
  ) {
    const normalized = normalize(url)
    if (!normalized) return
    const existing = byUrl.get(normalized)
    if (!existing) {
      byUrl.set(normalized, {
        url: normalized,
        status,
        canonicalUrl: canonicalUrl ? normalize(canonicalUrl) : undefined,
        evidence: [evidence],
      })
      return
    }

    existing.evidence.push(evidence)
    if (statusRank(status) > statusRank(existing.status)) existing.status = status
    if (!existing.canonicalUrl && canonicalUrl) {
      existing.canonicalUrl = normalize(canonicalUrl)
    }
  }

  for (const record of pages) {
    if (!record.sourceUrl) continue
    upsert(
      record.sourceUrl,
      directStatus(record),
      {
        source: "direct_capture",
        observedAt: record.capturedAt,
        captureStatus: record.status,
        httpStatus: record.httpStatus,
        pageType: record.pageType,
        checksum: record.checksum,
        error: record.error,
      },
      record.canonicalUrl
    )

    if (record.finalUrl && record.finalUrl !== record.sourceUrl) {
      upsert(
        record.finalUrl,
        directStatus(record),
        {
          source: "direct_capture",
          observedAt: record.capturedAt,
          captureStatus: record.status,
          httpStatus: record.httpStatus,
          pageType: record.pageType,
          checksum: record.checksum,
          error: record.error,
          note: `Final URL reached from ${record.sourceUrl}`,
        },
        record.canonicalUrl
      )
    }
  }

  for (const url of indexedUrls(baseline)) {
    upsert(url, "indexed_only", {
      source: "public_search_index",
      observedAt: baseline.observedAt,
      note: baseline.provenance?.freshnessWarning,
    })
  }

  for (const item of manualUnavailable) {
    const normalized = normalize(item.url)
    if (!normalized) continue
    const existing = byUrl.get(normalized)
    const evidence: ReconstructionUrlEvidence = {
      source: "manual_classification",
      note: item.note,
    }

    if (!existing) {
      byUrl.set(normalized, {
        url: normalized,
        status: "unavailable",
        evidence: [evidence],
      })
      continue
    }

    existing.evidence.push(evidence)
    if (existing.status !== "captured" && existing.status !== "skipped") {
      existing.status = "unavailable"
    }
  }

  const entries = [...byUrl.values()].sort((left, right) =>
    left.url.localeCompare(right.url)
  )

  const totals = Object.fromEntries(
    reconstructionUrlStatuses.map((status) => [
      status,
      entries.filter((entry) => entry.status === status).length,
    ])
  ) as Record<ReconstructionUrlStatus, number>

  const unresolved = totals.indexed_only + totals.error

  return {
    entries,
    totals,
    unresolved,
    isFullyClassified: unresolved === 0,
  }
}
