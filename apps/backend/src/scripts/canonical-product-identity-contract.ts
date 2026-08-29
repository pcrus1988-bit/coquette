import assert from "node:assert/strict"
import { buildCanonicalCaptureProductCandidates } from "../migration/canonical-product-identity"
import type {
  CaptureArtifactBundle,
  RecoveredProductStructureEvidence,
} from "../migration/capture-ingestion"

const capturedAt = "2026-08-29T10:00:00.000Z"
const categoryA = "https://coquetteconcept.gr/default/dresses.html"
const categoryB = "https://coquetteconcept.gr/default/sale.html"
const mediaA = "https://coquetteconcept.gr/media/catalog/product/a.jpg"
const mediaB = "https://coquetteconcept.gr/media/catalog/product/b.jpg"

function structure(
  parentProductId: string,
  category: string,
  media: string
): RecoveredProductStructureEvidence {
  return {
    galleryMedia: [media],
    categoryReferences: [{ url: category }],
    optionGroups: [],
    typeHint: "simple",
    typeEvidence: "fixture simple product",
    parentProductId,
    configurableVariants: [],
    configurableVariantMatrixComplete: false,
    configurableVariantMatrixIssues: [],
  }
}

const exactGreek = "https://coquetteconcept.gr/default/exact-product.html"
const exactGreekAlias =
  "https://coquetteconcept.gr/default/catalog/product/view/id/500/s/exact-product/category/20/"
const exactEnglishAlias =
  "https://coquetteconcept.gr/en/catalog/product/view/id/500/s/exact-product/category/21/"
const ambiguousOne =
  "https://coquetteconcept.gr/default/catalog/product/view/id/600/s/ambiguous/category/20/"
const ambiguousTwo =
  "https://coquetteconcept.gr/default/catalog/product/view/id/601/s/ambiguous/category/21/"
const conflictOne =
  "https://coquetteconcept.gr/default/catalog/product/view/id/700/s/conflict/category/20/"
const conflictTwo =
  "https://coquetteconcept.gr/default/catalog/product/view/id/700/s/conflict/category/21/"

const bundle: CaptureArtifactBundle = {
  manifest: {
    captureId: "canonical-identity-fixture",
    source: "https://coquetteconcept.gr",
    evidenceMode: "operator_local_browser",
    startedAt: capturedAt,
    completedAt: capturedAt,
    complete: true,
  },
  products: [
    {
      sourceUrl: exactGreek,
      sku: "EXACT-1",
      name: "Exact Product",
      currency: "EUR",
      regularPrice: 80,
    },
    {
      sourceUrl: exactGreekAlias,
      sku: "EXACT-1",
      name: "Exact Product",
      currency: "EUR",
      regularPrice: 80,
    },
    {
      sourceUrl: exactEnglishAlias,
      sku: "EXACT-1",
      name: "Exact Product EN",
      currency: "EUR",
      regularPrice: 80,
    },
    {
      sourceUrl: ambiguousOne,
      sku: "AMBIG-1",
      name: "Ambiguous",
      currency: "EUR",
      regularPrice: 50,
    },
    {
      sourceUrl: ambiguousTwo,
      sku: "AMBIG-1",
      name: "Ambiguous",
      currency: "EUR",
      regularPrice: 50,
    },
    {
      sourceUrl: conflictOne,
      sku: "CONFLICT-1",
      name: "Conflict",
      currency: "EUR",
      regularPrice: 40,
    },
    {
      sourceUrl: conflictTwo,
      sku: "CONFLICT-1",
      name: "Conflict",
      currency: "EUR",
      regularPrice: 45,
    },
  ],
  pages: [],
  media: [],
  pageMedia: {},
  productStructures: {
    [exactGreek]: structure("500", categoryA, mediaA),
    [exactGreekAlias]: structure("500", categoryB, mediaA),
    [exactEnglishAlias]: structure("500", categoryB, mediaB),
    [ambiguousOne]: structure("600", categoryA, mediaA),
    [ambiguousTwo]: structure("601", categoryA, mediaA),
    [conflictOne]: structure("700", categoryA, mediaA),
    [conflictTwo]: structure("700", categoryA, mediaA),
  },
}

const candidates = buildCanonicalCaptureProductCandidates(bundle)

const exact = candidates.filter((candidate) => candidate.selected.sku === "EXACT-1")
assert.equal(exact.length, 1)
assert.equal(exact[0].selected.sourceId, exactGreek)
assert.equal(exact[0].selected.legacyProductId, "500")
assert.deepEqual(exact[0].selected.categorySourceIds, [categoryA, categoryB])
assert.deepEqual(exact[0].selected.mediaSourceIds, [mediaA, mediaB])
assert.equal(exact[0].selected.regularPrice, 80)
assert.equal(exact[0].evidence.length, 3)
assert.ok(exact[0].candidateKey.includes("magento:500"))

const ambiguous = candidates.filter(
  (candidate) => candidate.selected.sku === "AMBIG-1"
)
assert.equal(ambiguous.length, 2)
assert.deepEqual(
  ambiguous.map((candidate) => candidate.selected.sourceId).sort(),
  [ambiguousOne, ambiguousTwo].sort()
)
assert.ok(ambiguous.every((candidate) => candidate.selected.legacyProductId === undefined))

const conflicting = candidates.filter(
  (candidate) => candidate.selected.sku === "CONFLICT-1"
)
assert.equal(conflicting.length, 2)
assert.deepEqual(
  conflicting.map((candidate) => candidate.selected.regularPrice).sort(),
  [40, 45]
)

console.log("COQUETTE exact Magento alias identity contract checks passed")
