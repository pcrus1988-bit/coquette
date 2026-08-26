import { mkdir, writeFile } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import { BrowserTransport, type BrowserTextResponse } from "./browser-transport"
import { checksum, extractPageEvidence, textContent } from "./html-evidence"

export type CaptureOptions = {
  baseUrl: string
  outputDir: string
  captureId: string
  maxPages: number
  delayMs: number
  downloadMedia: boolean
  mediaConcurrency: number
  respectRobots: boolean
  browser: boolean
}

type PageRecord = {
  sourceUrl: string
  finalUrl?: string
  status: "captured" | "skipped" | "error"
  httpStatus?: number
  contentType?: string
  capturedAt: string
  pageFile?: string
  checksum?: string
  pageType?: string
  title?: string
  canonicalUrl?: string
  discoveredLinks: number
  discoveredMedia: number
  error?: string
}

type MediaRecord = {
  sourceUrl: string
  status: "captured" | "skipped" | "error"
  httpStatus?: number
  contentType?: string
  bytes?: number
  checksum?: string
  mediaFile?: string
  capturedAt: string
  error?: string
}

type RobotsPolicy = {
  raw?: string
  disallow: string[]
  sitemaps: string[]
}

type TextFetcher = (url: string) => Promise<BrowserTextResponse>

const SKIP_PATH_PREFIXES = [
  "/customer/",
  "/checkout/",
  "/wishlist/",
  "/sales/",
  "/newsletter/",
  "/captcha/",
  "/rest/",
  "/graphql",
  "/search/",
  "/catalogsearch/",
]

const PAGE_EXTENSIONS = new Set(["", ".html", ".htm", ".php"])
const MEDIA_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".webp",
])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asPositiveInteger(value: string | null) {
  if (!value) return undefined
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? String(number) : undefined
}

export function normalizeCrawlUrl(value: string, baseUrl: string) {
  let url: URL
  try {
    url = new URL(value, baseUrl)
  } catch {
    return undefined
  }

  const base = new URL(baseUrl)
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
  if (url.hostname !== base.hostname) return undefined

  url.protocol = base.protocol
  url.hash = ""

  const page = asPositiveInteger(url.searchParams.get("p"))
  url.search = ""
  if (page && page !== "1") url.searchParams.set("p", page)

  if (
    SKIP_PATH_PREFIXES.some((prefix) =>
      url.pathname.toLowerCase().startsWith(prefix)
    )
  ) {
    return undefined
  }

  const extension = extname(url.pathname).toLowerCase()
  if (MEDIA_EXTENSIONS.has(extension)) return undefined
  if (!PAGE_EXTENSIONS.has(extension)) return undefined

  return url.toString()
}

function normalizeMediaUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value, baseUrl)
    const base = new URL(baseUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    if (url.hostname !== base.hostname) return undefined
    url.hash = ""
    return url.toString()
  } catch {
    return undefined
  }
}

function parseRobots(raw: string, baseUrl: string): RobotsPolicy {
  const disallow: string[] = []
  const sitemaps: string[] = []
  let appliesToUs = false
  const plain = /<html\b/i.test(raw) ? textContent(raw) : raw

  for (const rawLine of plain.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim()
    if (!line) continue
    const separator = line.indexOf(":")
    if (separator === -1) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (key === "user-agent") {
      appliesToUs = value === "*" || value.toLowerCase().includes("coquette")
    } else if (key === "disallow" && appliesToUs && value) {
      disallow.push(value)
    } else if (key === "sitemap" && value) {
      try {
        sitemaps.push(new URL(value, baseUrl).toString())
      } catch {
        // Ignore malformed sitemap hints; standard locations are still attempted.
      }
    }
  }

  return { raw, disallow, sitemaps }
}

function robotsAllows(url: string, policy: RobotsPolicy) {
  const path = new URL(url).pathname
  return !policy.disallow.some(
    (rule) => rule === "/" || (rule.startsWith("/") && path.startsWith(rule))
  )
}

async function httpFetchText(url: string): Promise<BrowserTextResponse> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "COQUETTE-Reconstruction/1.0 (+legacy storefront preservation)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    contentType: response.headers.get("content-type") ?? "",
    text: await response.text(),
  }
}

function xmlLocations(xml: string) {
  const normalized = xml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")

  return [...normalized.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => textContent(match[1]).replace(/<!\[CDATA\[|\]\]>/g, "").trim())
    .filter(Boolean)
}

async function discoverSitemapUrls(
  baseUrl: string,
  robots: RobotsPolicy,
  fetchText: TextFetcher
) {
  const base = new URL(baseUrl)
  const pending = [
    ...robots.sitemaps,
    new URL("/sitemap.xml", base).toString(),
    new URL("/sitemap_index.xml", base).toString(),
  ]
  const seenSitemaps = new Set<string>()
  const pageUrls = new Set<string>()

  while (pending.length && seenSitemaps.size < 50) {
    const sitemapUrl = pending.shift()!
    if (seenSitemaps.has(sitemapUrl)) continue
    seenSitemaps.add(sitemapUrl)

    try {
      const response = await fetchText(sitemapUrl)
      if (!response.ok) continue
      const locations = xmlLocations(response.text)
      if (!locations.length && !/xml/i.test(response.contentType)) continue

      for (const location of locations) {
        if (/\.xml(?:$|\?)/i.test(location)) {
          try {
            const nested = new URL(location, sitemapUrl)
            if (nested.hostname === base.hostname) pending.push(nested.toString())
          } catch {
            // Ignore malformed nested sitemap URL.
          }
          continue
        }
        const normalized = normalizeCrawlUrl(location, baseUrl)
        if (normalized) pageUrls.add(normalized)
      }
    } catch {
      // Sitemaps accelerate discovery. Link crawling remains the fallback.
    }
  }

  return [...pageUrls]
}

function jsonLine(value: unknown) {
  return `${JSON.stringify(value)}\n`
}

function safeMediaFilename(url: string, contentType?: string | null) {
  const parsed = new URL(url)
  const sourceName = basename(parsed.pathname).replace(/[^a-zA-Z0-9._-]+/g, "-")
  const sourceExtension = extname(sourceName).toLowerCase()
  const byMime: Record<string, string> = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
  }
  const extension =
    sourceExtension || byMime[(contentType ?? "").split(";")[0]] || ".bin"
  const stem =
    sourceName
      .slice(0, sourceName.length - sourceExtension.length)
      .slice(0, 80) || "media"
  return `${checksum(url).slice(0, 20)}-${stem}${extension}`
}

async function writeJsonl(path: string, values: unknown[]) {
  await writeFile(path, values.map(jsonLine).join(""), "utf8")
}

async function downloadOneMedia(
  url: string,
  mediaDir: string,
  browserHeaders: Record<string, string>
): Promise<MediaRecord> {
  const capturedAt = new Date().toISOString()
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          browserHeaders["user-agent"] ??
          "COQUETTE-Reconstruction/1.0 (+legacy storefront preservation)",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        ...(browserHeaders.cookie ? { cookie: browserHeaders.cookie } : {}),
      },
    })

    if (!response.ok) {
      return {
        sourceUrl: url,
        status: "error",
        httpStatus: response.status,
        capturedAt,
        error: `HTTP ${response.status}`,
      }
    }

    const contentType = response.headers.get("content-type")
    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      return {
        sourceUrl: url,
        status: "skipped",
        httpStatus: response.status,
        contentType,
        capturedAt,
        error: "Non-image response",
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const filename = safeMediaFilename(url, contentType)
    const relativePath = join("media", filename)
    await writeFile(join(mediaDir, filename), buffer)

    return {
      sourceUrl: url,
      status: "captured",
      httpStatus: response.status,
      contentType: contentType ?? undefined,
      bytes: buffer.length,
      checksum: checksum(buffer),
      mediaFile: relativePath,
      capturedAt,
    }
  } catch (error) {
    return {
      sourceUrl: url,
      status: "error",
      capturedAt,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function concurrentMap<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length)
  let cursor = 0

  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= values.length) return
      results[index] = await mapper(values[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  )
  return results
}

export async function captureStorefront(options: CaptureOptions) {
  const startedAt = new Date().toISOString()
  const base = new URL(options.baseUrl)
  const pagesDir = join(options.outputDir, "pages")
  const mediaDir = join(options.outputDir, "media")
  await mkdir(pagesDir, { recursive: true })
  await mkdir(mediaDir, { recursive: true })

  const browser = options.browser ? await BrowserTransport.launch() : undefined
  const fetchText: TextFetcher = browser
    ? (url) => browser.fetchText(url)
    : httpFetchText

  try {
    let robots: RobotsPolicy = { disallow: [], sitemaps: [] }
    try {
      const robotsUrl = new URL("/robots.txt", base).toString()
      const response = await fetchText(robotsUrl)
      if (response.ok) robots = parseRobots(response.text, options.baseUrl)
      await writeFile(join(options.outputDir, "robots.txt"), response.text, "utf8")
    } catch {
      await writeFile(
        join(options.outputDir, "robots.txt"),
        "# unavailable during capture\n",
        "utf8"
      )
    }

    const sitemapUrls = await discoverSitemapUrls(
      options.baseUrl,
      robots,
      fetchText
    )
    const seeds = [
      normalizeCrawlUrl(base.toString(), options.baseUrl),
      normalizeCrawlUrl(new URL("/default/", base).toString(), options.baseUrl),
      normalizeCrawlUrl(new URL("/en/", base).toString(), options.baseUrl),
      ...sitemapUrls,
    ].filter((value): value is string => Boolean(value))

    const queue = [...new Set(seeds)]
    const queued = new Set(queue)
    const visited = new Set<string>()
    const pageRecords: PageRecord[] = []
    const productEvidence: unknown[] = []
    const mediaUrls = new Set<string>()

    while (queue.length && visited.size < options.maxPages) {
      const sourceUrl = queue.shift()!
      if (visited.has(sourceUrl)) continue
      visited.add(sourceUrl)

      if (options.respectRobots && !robotsAllows(sourceUrl, robots)) {
        pageRecords.push({
          sourceUrl,
          status: "skipped",
          capturedAt: new Date().toISOString(),
          discoveredLinks: 0,
          discoveredMedia: 0,
          error: "robots.txt disallow",
        })
        continue
      }

      if (options.delayMs > 0) await sleep(options.delayMs)

      try {
        const response = await fetchText(sourceUrl)
        const capturedAt = new Date().toISOString()
        const contentType = response.contentType || undefined
        const finalUrl =
          normalizeCrawlUrl(response.url, options.baseUrl) ?? sourceUrl

        if (!response.ok) {
          pageRecords.push({
            sourceUrl,
            finalUrl,
            status: "error",
            httpStatus: response.status,
            contentType,
            capturedAt,
            discoveredLinks: 0,
            discoveredMedia: 0,
            error: `HTTP ${response.status}`,
          })
          continue
        }

        if (!/html|xhtml/i.test(contentType ?? "text/html")) {
          pageRecords.push({
            sourceUrl,
            finalUrl,
            status: "skipped",
            httpStatus: response.status,
            contentType,
            capturedAt,
            discoveredLinks: 0,
            discoveredMedia: 0,
            error: "Non-HTML response",
          })
          continue
        }

        const evidence = extractPageEvidence(response.text, finalUrl)
        const pageFilename = `${checksum(finalUrl).slice(0, 24)}.html`
        const pageFile = join("pages", pageFilename)
        await writeFile(join(pagesDir, pageFilename), response.text, "utf8")

        for (const link of evidence.links) {
          const normalized = normalizeCrawlUrl(link, options.baseUrl)
          if (
            normalized &&
            !visited.has(normalized) &&
            !queued.has(normalized)
          ) {
            queue.push(normalized)
            queued.add(normalized)
          }
        }

        for (const media of evidence.media) {
          const normalized = normalizeMediaUrl(media, options.baseUrl)
          if (normalized) mediaUrls.add(normalized)
        }

        if (evidence.pageType === "product" && evidence.product) {
          productEvidence.push({
            sourceUrl: finalUrl,
            checksum: evidence.checksum,
            title: evidence.title,
            canonicalUrl: evidence.canonicalUrl,
            hreflang: evidence.hreflang,
            ...evidence.product,
          })
        }

        pageRecords.push({
          sourceUrl,
          finalUrl,
          status: "captured",
          httpStatus: response.status,
          contentType,
          capturedAt,
          pageFile,
          checksum: evidence.checksum,
          pageType: evidence.pageType,
          title: evidence.title,
          canonicalUrl: evidence.canonicalUrl,
          discoveredLinks: evidence.links.length,
          discoveredMedia: evidence.media.length,
        })
      } catch (error) {
        pageRecords.push({
          sourceUrl,
          status: "error",
          capturedAt: new Date().toISOString(),
          discoveredLinks: 0,
          discoveredMedia: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const allMedia = [...mediaUrls]
    const browserHeaders = browser ? await browser.requestHeaders() : {}
    const mediaRecords = options.downloadMedia
      ? await concurrentMap(allMedia, options.mediaConcurrency, (url) =>
          downloadOneMedia(url, mediaDir, browserHeaders)
        )
      : allMedia.map<MediaRecord>((sourceUrl) => ({
          sourceUrl,
          status: "skipped",
          capturedAt: new Date().toISOString(),
          error: "Media download disabled",
        }))

    await writeJsonl(join(options.outputDir, "pages.jsonl"), pageRecords)
    await writeJsonl(join(options.outputDir, "products.jsonl"), productEvidence)
    await writeJsonl(join(options.outputDir, "media.jsonl"), mediaRecords)
    await writeJsonl(
      join(options.outputDir, "url-inventory.jsonl"),
      pageRecords.map((record) => ({
        sourceUrl: record.sourceUrl,
        finalUrl: record.finalUrl,
        status: record.status,
        httpStatus: record.httpStatus,
        pageType: record.pageType,
        checksum: record.checksum,
        error: record.error,
      }))
    )

    const completedAt = new Date().toISOString()
    const manifest = {
      schemaVersion: 2,
      captureId: options.captureId,
      source: base.origin,
      evidenceMode: "public_storefront",
      transport: options.browser ? "browser" : "http",
      startedAt,
      completedAt,
      options: {
        maxPages: options.maxPages,
        delayMs: options.delayMs,
        downloadMedia: options.downloadMedia,
        mediaConcurrency: options.mediaConcurrency,
        respectRobots: options.respectRobots,
        browser: options.browser,
      },
      robots: {
        found: Boolean(robots.raw),
        disallowCount: robots.disallow.length,
        sitemapCount: robots.sitemaps.length,
      },
      discovery: {
        sitemapUrls: sitemapUrls.length,
        queuedUrls: queued.size,
        visitedUrls: visited.size,
      },
      pages: {
        captured: pageRecords.filter((record) => record.status === "captured")
          .length,
        skipped: pageRecords.filter((record) => record.status === "skipped")
          .length,
        errors: pageRecords.filter((record) => record.status === "error").length,
        products: productEvidence.length,
      },
      media: {
        discovered: mediaRecords.length,
        captured: mediaRecords.filter((record) => record.status === "captured")
          .length,
        skipped: mediaRecords.filter((record) => record.status === "skipped")
          .length,
        errors: mediaRecords.filter((record) => record.status === "error").length,
        bytes: mediaRecords.reduce(
          (sum, record) => sum + (record.bytes ?? 0),
          0
        ),
      },
      complete: queue.length === 0,
      remainingQueue: queue.length,
    }

    await writeFile(
      join(options.outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    )
    return manifest
  } finally {
    await browser?.close()
  }
}
