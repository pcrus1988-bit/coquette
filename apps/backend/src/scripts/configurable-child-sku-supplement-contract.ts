import assert from "node:assert/strict"
import { sourceChecksum } from "../migration/checksum"
import {
  applyConfigurableChildSkuSupplement,
  verifyConfigurableChildSkuSupplement,
  type ConfigurableChildSkuSupplement,
} from "../migration/configurable-child-sku-supplement"
import { buildRecoveryProductCandidate } from "../migration/recovery-candidates"
import {
  configurableChildSkuGraphqlQuery,
  parseConfigurableChildSkuGraphqlResponse,
} from "../reconstruction/configurable-child-sku-evidence"

const parentSku = "PARENT-1"
const parentSourceUrl = "https://coquetteconcept.gr/default/parent-1.html"
const expectedChildIds = ["101", "102"]
const response = {
  data: {
    products: {
      items: [
        {
          sku: parentSku,
          __typename: "ConfigurableProduct",
          variants: [
            { product: { id: 101, sku: "CHILD-S" } },
            { product: { id: 102, sku: "CHILD-M" } },
          ],
        },
      ],
    },
  },
}
const parsed = parseConfigurableChildSkuGraphqlResponse({
  parentSku,
  expectedSourceProductIds: expectedChildIds,
  response,
})
assert.equal(parsed.complete, true)

const candidate = buildRecoveryProductCandidate("direct:sku:PARENT-1", [
  {
    authority: "direct_storefront",
    sourceUrl: parentSourceUrl,
    observedAt: "2026-08-29T10:00:00.000Z",
    fields: {
      sourceId: parentSourceUrl,
      sku: parentSku,
      name: "Parent",
      type: "configurable",
      categorySourceIds: ["https://coquetteconcept.gr/default/clothing.html"],
      mediaSourceIds: [
        "https://coquetteconcept.gr/media/catalog/product/parent.jpg",
      ],
      configurableVariantMatrixComplete: true,
      configurableVariants: [
        {
          sourceProductId: "101",
          optionValues: { size: "S" },
          regularPrice: 80,
          salePrice: 16,
        },
        {
          sourceProductId: "102",
          optionValues: { size: "M" },
          regularPrice: 80,
          salePrice: 16,
        },
      ],
    },
  },
])

const payload = {
  schemaVersion: 1 as const,
  generatedAt: "2026-08-29T12:00:00.000Z",
  captureId: "capture-contract",
  captureEvidencePackageChecksum: "capture-package-checksum",
  provenance: {
    mode: "operator_local_browser" as const,
    transport: "browser_graphql_get" as const,
    browserMode: "headed" as const,
    codeRevision: "abc123",
    source: "https://coquetteconcept.gr/graphql",
  },
  queryChecksum: sourceChecksum(configurableChildSkuGraphqlQuery()),
  parentsSelected: 1,
  records: [
    {
      candidateKey: candidate.candidateKey,
      parentSku,
      parentSourceUrl,
      expectedChildIds,
      parentPage: {
        ok: true,
        status: 200,
        finalUrl: parentSourceUrl,
        contentType: "text/html",
      },
      graphql: {
        requestUrl: "https://coquetteconcept.gr/graphql",
        method: "GET",
        status: 200,
        ok: true,
        contentType: "application/json",
        responseChecksum: sourceChecksum(response),
        response,
      },
      parsed,
    },
  ],
  totals: {
    completeParents: 1,
    incompleteParents: 0,
    resolvedChildren: 2,
    unresolvedChildren: 0,
  },
}
const evidence: ConfigurableChildSkuSupplement = {
  ...payload,
  evidenceChecksum: sourceChecksum(payload),
}

const verification = verifyConfigurableChildSkuSupplement({
  evidence,
  expectedCaptureId: "capture-contract",
  expectedEvidencePackageChecksum: "capture-package-checksum",
})
assert.equal(verification.valid, true)

const application = applyConfigurableChildSkuSupplement({
  candidates: [candidate],
  evidence,
  expectedCaptureId: "capture-contract",
  expectedEvidencePackageChecksum: "capture-package-checksum",
})
assert.equal(application.appliedParents, 1)
assert.equal(application.appliedChildren, 2)
assert.equal(application.unresolvedRecords.length, 0)
assert.deepEqual(
  application.candidates[0].selected.configurableVariants?.map((variant) => ({
    id: variant.sourceProductId,
    sku: variant.sku,
  })),
  [
    { id: "101", sku: "CHILD-S" },
    { id: "102", sku: "CHILD-M" },
  ]
)
assert.equal(
  application.candidates[0].evidence.at(-1)?.sourceUrl,
  "https://coquetteconcept.gr/graphql"
)

const tampered: ConfigurableChildSkuSupplement = {
  ...evidence,
  records: [
    {
      ...evidence.records[0],
      graphql: {
        ...evidence.records[0].graphql,
        responseChecksum: "0".repeat(64),
      },
    },
  ],
}
tampered.evidenceChecksum = sourceChecksum({
  ...tampered,
  evidenceChecksum: undefined,
})
const invalid = verifyConfigurableChildSkuSupplement({
  evidence: tampered,
  expectedCaptureId: "capture-contract",
  expectedEvidencePackageChecksum: "capture-package-checksum",
})
assert.equal(invalid.valid, false)
assert.ok(
  invalid.errors.includes(
    `child_sku_record_response_checksum_mismatch:${candidate.candidateKey}`
  )
)

console.log(
  "COQUETTE configurable child SKU supplement contract passed: raw GraphQL evidence binds exact child IDs to SKUs and tampering fails closed"
)
