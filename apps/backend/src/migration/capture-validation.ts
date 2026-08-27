import {
  COQUETTE_LEGACY_HOST,
  type CaptureArtifactBundle,
} from "./capture-ingestion"

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

type ValidatedSourceRecord = {
  kind: "page" | "product" | "media"
  url?: string
  path?: string
  requiresPath: boolean
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

function isUrlOnHost(value: string | undefined, expectedHost: string) {
  const url = validHttpUrl(value)
  return Boolean(url && url.hostname === expectedHost)
}

function safeRelativePath(value?: string) {
  if (!value) return false
  const normalized = value.replace(/\\/g, "/")
  return (
    !normalized.startsWith("/") &&
    !normalized.split("/").includes("..") &&
    !/^[a-zA-Z]:\//.test(normalized)
  )
}

function validateOptionalLegacyUrl(
  issues: CaptureValidationIssue[],
  value: string | undefined,
  expectedHost: string,
  code: string,
  message: string,
  sourceUrl?: string
) {
  if (!value) return
  if (!isUrlOnHost(value, expectedHost)) {
    issues.push({
      severity: "critical",
      code,
      message,
      sourceUrl: sourceUrl ?? value,
    })
  }
}

export function validateCaptureArtifactBundle(
  bundle: CaptureArtifactBundle,
  expectedHost = COQUETTE_LEGACY_HOST
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
      message:
        "Only public_storefront capture artifacts may enter Phase 4 direct ingestion.",
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

  const sourceCollections: ValidatedSourceRecord[] = [
    ...bundle.pages.map((record) => ({
      kind: "page" as const,
      url: record.sourceUrl,
      path: record.pageFile,
      requiresPath: record.status === "captured",
    })),
    ...bundle.products.map((record) => ({
      kind: "product" as const,
      url: record.sourceUrl,
      path: undefined,
      requiresPath: false,
    })),
    ...bundle.media.map((record) => ({
      kind: "media" as const,
      url: record.sourceUrl,
      path: record.mediaFile,
      requiresPath: record.status === "captured",
    })),
  ]

  for (const record of sourceCollections) {
    if (!isUrlOnHost(record.url, expectedHost)) {
      issues.push({
        severity: "critical",
        code: `invalid_${record.kind}_source_url`,
        message: `${record.kind} source URL must be an absolute URL on ${expectedHost}.`,
        sourceUrl: record.url,
      })
    }

    if (record.path && !safeRelativePath(record.path)) {
      issues.push({
        severity: "critical",
        code: `unsafe_${record.kind}_archive_path`,
        message: `${record.kind} archive path must remain inside the capture directory.`,
        sourceUrl: record.url,
      })
    }

    if (record.requiresPath && !safeRelativePath(record.path)) {
      issues.push({
        severity: "critical",
        code: `missing_or_unsafe_captured_${record.kind}_archive_path`,
        message: `Captured ${record.kind} evidence requires a safe archive path.`,
        sourceUrl: record.url,
      })
    }
  }

  for (const page of bundle.pages) {
    validateOptionalLegacyUrl(
      issues,
      page.finalUrl,
      expectedHost,
      "invalid_page_final_url",
      `Page final URL must remain on ${expectedHost}.`,
      page.sourceUrl
    )
    validateOptionalLegacyUrl(
      issues,
      page.canonicalUrl,
      expectedHost,
      "invalid_page_canonical_url",
      `Page canonical URL must remain on ${expectedHost}.`,
      page.sourceUrl
    )
    if (page.capturedAt && !isValidTimestamp(page.capturedAt)) {
      issues.push({
        severity: "critical",
        code: "invalid_page_captured_at",
        message: "Page record capturedAt must be a valid timestamp when present.",
        sourceUrl: page.sourceUrl,
      })
    }
  }

  for (const product of bundle.products) {
    validateOptionalLegacyUrl(
      issues,
      product.canonicalUrl,
      expectedHost,
      "invalid_product_canonical_url",
      `Product canonical URL must remain on ${expectedHost}.`,
      product.sourceUrl
    )

    for (const alternate of product.hreflang ?? []) {
      validateOptionalLegacyUrl(
        issues,
        alternate.url,
        expectedHost,
        "invalid_product_hreflang_url",
        `Product hreflang URL must remain on ${expectedHost}.`,
        product.sourceUrl
      )
    }
  }

  for (const media of bundle.media) {
    if (media.capturedAt && !isValidTimestamp(media.capturedAt)) {
      issues.push({
        severity: "critical",
        code: "invalid_media_captured_at",
        message: "Media record capturedAt must be a valid timestamp when present.",
        sourceUrl: media.sourceUrl,
      })
    }
  }

  const capturedMedia = new Set(
    bundle.media
      .filter((record) => record.status === "captured")
      .map((record) => record.sourceUrl)
      .filter((value): value is string => Boolean(value))
  )

  for (const [pageUrl, mediaUrls] of Object.entries(bundle.pageMedia)) {
    if (!isUrlOnHost(pageUrl, expectedHost)) {
      issues.push({
        severity: "critical",
        code: "invalid_page_media_page_url",
        message: `Page-media relationship key must remain on ${expectedHost}.`,
        sourceUrl: pageUrl,
      })
    }

    for (const mediaUrl of mediaUrls) {
      if (!isUrlOnHost(mediaUrl, expectedHost)) {
        issues.push({
          severity: "critical",
          code: "invalid_page_media_asset_url",
          message: `Page-media relationship asset must remain on ${expectedHost}.`,
          sourceUrl: mediaUrl,
        })
      } else if (!capturedMedia.has(mediaUrl)) {
        issues.push({
          severity: "review",
          code: "page_media_asset_not_captured",
          message:
            "Page-media relationship references an asset that is not marked captured.",
          sourceUrl: mediaUrl,
        })
      }
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
