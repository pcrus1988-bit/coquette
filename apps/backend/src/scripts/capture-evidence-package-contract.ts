import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  CAPTURE_EVIDENCE_PACKAGE_FILE,
  createCaptureEvidencePackage,
  verifyCaptureEvidencePackage,
} from "../migration/capture-evidence-package"

const capturedAt = "2026-08-27T07:30:00.000Z"
const productUrl = "https://coquetteconcept.gr/default/operator-package-contract.html"
const mediaUrl =
  "https://coquetteconcept.gr/media/catalog/product/operator-package-contract.jpg"

async function writeFixture(root: string, complete = true) {
  await mkdir(join(root, "pages"), { recursive: true })
  await mkdir(join(root, "media"), { recursive: true })
  const html = `<html><head><link rel="canonical" href="${productUrl}"></head><body><img src="${mediaUrl}"></body></html>`
  const media = Buffer.from("coquette-operator-package-media-fixture")

  await writeFile(
    join(root, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 2,
      captureId: "operator-package-contract",
      source: "https://coquetteconcept.gr",
      evidenceMode: "public_storefront",
      transport: "browser",
      startedAt: capturedAt,
      completedAt: capturedAt,
      complete,
      remainingQueue: 0,
      pages: { captured: 1, skipped: 0, errors: 0, products: 1 },
      media: { discovered: 1, captured: 1, skipped: 0, errors: 0 },
    }, null, 2)}\n`,
    "utf8"
  )
  await writeFile(join(root, "robots.txt"), "User-agent: *\nDisallow:\n", "utf8")
  await writeFile(join(root, "pages", "fixture.html"), html, "utf8")
  await writeFile(join(root, "media", "fixture.jpg"), media)
  await writeFile(
    join(root, "pages.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      finalUrl: productUrl,
      status: "captured",
      httpStatus: 200,
      capturedAt,
      pageFile: "pages/fixture.html",
      pageType: "product",
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "products.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      canonicalUrl: productUrl,
      name: "Operator package fixture",
      sku: "OPERATOR-PACKAGE-1",
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "media.jsonl"),
    `${JSON.stringify({
      sourceUrl: mediaUrl,
      status: "captured",
      httpStatus: 200,
      contentType: "image/jpeg",
      mediaFile: "media/fixture.jpg",
      capturedAt,
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "url-inventory.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      finalUrl: productUrl,
      status: "captured",
      httpStatus: 200,
      pageType: "product",
    })}\n`,
    "utf8"
  )
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-operator-package-contract-"))
  try {
    await writeFixture(root)
    const first = await createCaptureEvidencePackage({
      captureDir: root,
      browserMode: "headed",
      codeRevision: "phase-4p-contract-revision",
      operatorLabel: "ci-operator-fixture",
      packagedAt: "2026-08-27T07:31:00.000Z",
    })
    assert.equal(first.provenance.mode, "operator_local_browser")
    assert.equal(first.provenance.transport, "browser")
    assert.equal(first.provenance.browserMode, "headed")
    assert.match(first.packageChecksum, /^[a-f0-9]{64}$/)
    assert.ok(first.files.some((entry) => entry.path === "manifest.json"))
    assert.ok(first.files.some((entry) => entry.path === "pages/fixture.html"))
    assert.ok(first.files.some((entry) => entry.path === "media/fixture.jpg"))
    assert.ok(
      !first.files.some((entry) => entry.path === CAPTURE_EVIDENCE_PACKAGE_FILE)
    )

    const firstVerification = await verifyCaptureEvidencePackage(root)
    assert.equal(firstVerification.isValid, true)
    assert.equal(firstVerification.critical, 0)
    assert.equal(
      firstVerification.recomputedPackageChecksum,
      first.packageChecksum
    )

    const packageRaw = await readFile(
      join(root, CAPTURE_EVIDENCE_PACKAGE_FILE),
      "utf8"
    )
    assert.equal(/cookie/i.test(packageRaw), false)
    assert.equal(/ipAddress|ip_address/i.test(packageRaw), false)

    const regenerated = await createCaptureEvidencePackage({
      captureDir: root,
      browserMode: "headed",
      codeRevision: "phase-4p-contract-revision",
      operatorLabel: "ci-operator-fixture",
      packagedAt: "2026-08-27T09:00:00.000Z",
    })
    assert.equal(
      regenerated.packageChecksum,
      first.packageChecksum,
      "packagedAt must not change evidence identity"
    )

    await writeFile(
      join(root, "pages", "fixture.html"),
      "<html><body>TAMPERED</body></html>",
      "utf8"
    )
    const tampered = await verifyCaptureEvidencePackage(root)
    assert.equal(tampered.isValid, false)
    assert.ok(
      tampered.issues.some(
        (issue) => issue.code === "capture_evidence_package_file_checksum_mismatch"
      )
    )

    await writeFixture(root)
    await createCaptureEvidencePackage({
      captureDir: root,
      browserMode: "headed",
      codeRevision: "phase-4p-contract-revision",
      packagedAt: "2026-08-27T09:05:00.000Z",
    })
    await writeFile(join(root, "unlisted-after-package.txt"), "unexpected", "utf8")
    const unlisted = await verifyCaptureEvidencePackage(root)
    assert.equal(unlisted.isValid, false)
    assert.ok(
      unlisted.issues.some(
        (issue) => issue.code === "capture_evidence_package_unlisted_file"
      )
    )

    await rm(join(root, "unlisted-after-package.txt"), { force: true })
    await writeFixture(root, false)
    await createCaptureEvidencePackage({
      captureDir: root,
      browserMode: "headed",
      packagedAt: "2026-08-27T09:10:00.000Z",
    })
    const incomplete = await verifyCaptureEvidencePackage(root)
    assert.equal(incomplete.isValid, false)
    assert.ok(
      incomplete.issues.some(
        (issue) => issue.code === "capture_evidence_package_capture_not_complete"
      )
    )

    console.log(
      "COQUETTE operator direct-capture evidence package integrity contract passed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
