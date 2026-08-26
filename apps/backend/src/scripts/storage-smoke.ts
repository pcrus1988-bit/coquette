import type { ExecArgs } from "@medusajs/framework/types"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"

const SMOKE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl4sAAAAASUVORK5CYII="

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export default async function storageSmoke({ container }: ExecArgs) {
  const required = [
    "S3_FILE_URL",
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ] as const

  const missing = required.filter((name) => !process.env[name])
  if (missing.length) {
    throw new Error(`Storage smoke cannot run; missing ${missing.join(", ")}`)
  }

  const filename = `coquette-storage-smoke-${Date.now()}.png`
  const { result } = await uploadFilesWorkflow(container).run({
    input: {
      files: [
        {
          filename,
          mimeType: "image/png",
          content: SMOKE_PNG_BASE64,
          access: "public",
        },
      ],
    },
  })

  const uploaded = result?.[0]
  if (!uploaded?.url) {
    throw new Error("Storage smoke upload completed without a public file URL")
  }

  const expectedBaseUrl = process.env.S3_FILE_URL!.replace(/\/$/, "")
  if (!uploaded.url.startsWith(`${expectedBaseUrl}/`)) {
    throw new Error(
      "Storage smoke returned a URL outside S3_FILE_URL; the S3 provider may not be active"
    )
  }

  const response = await fetch(uploaded.url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(
      `Storage smoke public read failed with HTTP ${response.status}`
    )
  }

  const content = Buffer.from(await response.arrayBuffer())
  if (
    content.length < PNG_SIGNATURE.length ||
    !content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error("Storage smoke public read did not return the uploaded PNG")
  }

  console.log(
    `COQUETTE storage smoke passed: Medusa S3 upload + public read (${uploaded.url})`
  )
}
