import type { CaptureArtifactBundle } from "./capture-ingestion"

export type CaptureValidationIssue = {
  severity: "critical" | "review"
  code: string
  message: string
  sourceUrl?: string
}

export type CaptureValidationResult = {
  issues: CaptureValidationIssue[]
  critical: number
  review: number
  isValid: boolean
}

function isValidTimestamp(value?: string) {
  return Boolean(value) && !Number.isNaN(Date.parse(value!))
}

function validHttpUrl(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return url
  } catch {
    return undefined
  }
}

function safeRelativePath(value?: string) {
  if (!value) return true
  const normalized = value.replace(/\\/g, "/")
  return (
    !normalized.startsWith("/") &&
    !normalized.split("/").includes("..") &&
    !/^[a-zA-Z]:\//.test(normalized)
  )
}

export function validateCaptureArtifactBundle(
  bundle: CaptureArtifactBundle,
  expectedHost = "coquetteconcept.gr"
): CaptureValidationResult {
  const issues: CaptureValidationIssue[] = []
  const manifestSource = validHttpUrl(bundle.manifest.source)

  if (!manifestSource || manifestSource.hostname !== expectedHost) {
    issues.push({
      severity: "critical",
      code: "invalid_manifest_source",
      message: `Capture manifest must originate from ${expectedHost}.`,
      sourceUrl: bundle.manifest.source,
    })
  }

  if (bundle.manifest.evidenceMode !== "public_storefront") {
    issues.push({
      severity: "critical",
      code: "invalid_evidence_mode",
      message: "Only public_storefront capture artifacts may enter Phase 4 direct ingestion.",
    })
  }

  if (!isValidTimestamp(bundle.manifest.startedAt)) {
    issues.push({
      severity: "critical",
      code: "invalid_started_at",
      message: "Capture manifest requires a valid startedAt timestamp.",
    })
  }

  if (!isValidTimestamp(bundle.manifest.completedAt)) {
    issues.push({
      severity: "critical",
      code: "invalid_completed_at",
      message: "Capture manifest requires a valid completedAt timestamp.",
    })
  }

  const sourceCollections = [
    ...bundle.pages.map((record) => ({
      kind: "page",
      url: record.sourceUrl,
      path: record.pageFile,
    })),
    ...bundle.products.map((record) => ({ kind: "product", url: record.sourceUrl })),
    ...bundle.media.map((record) => ({
      kind: "media",
      url: record.sourceUrl,
      path: record.mediaFile,
    })),
  ]

  for (const record of sourceCollections) {
    const url = validHttpUrl(record.url)
    if (!url || url.hostname !== expectedHost) {
      issues.push({
        severity: "critical",
        code: `invalid_${record.kind}_source_url`,
        message: `${record.kind} source URL must be an absolute URL on ${expectedHost}.`,
        sourceUrl: record.url,
      })
    }

    if (!safeRelativePath(record.path)) {
      issues.push({
        severity: "critical",
        code: `unsafe_${record.kind}_archive_path`,
        message: `${record.kind} archive path must remain inside the capture directory.`,
        sourceUrl: record.url,
      })
    }
  }

  if (bundle.pages.length === 0) {
    issues.push({
      severity: "review",
      code: "empty_page_inventory",
      message: "Capture artifact contains no page inventory records.",
    })
  }

  if (!bundle.pages.some((record) => record.status === "captured")) {
    issues.push({
      severity: "review",
      code: "zero_captured_pages",
      message: "Capture artifact contains no successfully captured public HTML pages.",
    })
  }

  const critical = issues.filter((issue) => issue.severity === "critical").length
  const review = issues.filter((issue) => issue.severity === "review").length

  return {
    issues,
    critical,
    review,
    isValid: critical === 0,
  }
}
