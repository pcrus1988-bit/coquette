import assert from "node:assert/strict"
import {
  configurableChildSkuGraphqlQuery,
  parseConfigurableChildSkuGraphqlResponse,
} from "../reconstruction/configurable-child-sku-evidence"

const query = configurableChildSkuGraphqlQuery()
assert.match(query, /ConfigurableProduct/)
assert.match(query, /product\s*\{[\s\S]*id[\s\S]*sku/)
assert.doesNotMatch(query, /mutation/i)

const valid = parseConfigurableChildSkuGraphqlResponse({
  parentSku: "PARENT-1",
  expectedSourceProductIds: ["101", "102"],
  response: {
    data: {
      products: {
        items: [
          {
            sku: "PARENT-1",
            __typename: "ConfigurableProduct",
            variants: [
              { product: { id: 101, sku: "CHILD-S" } },
              { product: { id: 102, sku: "CHILD-M" } },
            ],
          },
        ],
      },
    },
  },
})
assert.equal(valid.complete, true)
assert.deepEqual(valid.resolved, [
  { sourceProductId: "101", sku: "CHILD-S" },
  { sourceProductId: "102", sku: "CHILD-M" },
])
assert.deepEqual(valid.unresolvedSourceProductIds, [])
assert.deepEqual(valid.issues, [])

const missingChild = parseConfigurableChildSkuGraphqlResponse({
  parentSku: "PARENT-1",
  expectedSourceProductIds: ["101", "102"],
  response: {
    data: {
      products: {
        items: [
          {
            sku: "PARENT-1",
            __typename: "ConfigurableProduct",
            variants: [{ product: { id: 101, sku: "CHILD-S" } }],
          },
        ],
      },
    },
  },
})
assert.equal(missingChild.complete, false)
assert.deepEqual(missingChild.unresolvedSourceProductIds, ["102"])
assert.ok(missingChild.issues.includes("child_sku_match_count:102:0"))

const duplicateSku = parseConfigurableChildSkuGraphqlResponse({
  parentSku: "PARENT-1",
  expectedSourceProductIds: ["101", "102"],
  response: {
    data: {
      products: {
        items: [
          {
            sku: "PARENT-1",
            __typename: "ConfigurableProduct",
            variants: [
              { product: { id: 101, sku: "CHILD-X" } },
              { product: { id: 102, sku: "CHILD-X" } },
            ],
          },
        ],
      },
    },
  },
})
assert.equal(duplicateSku.complete, false)
assert.ok(duplicateSku.issues.includes("duplicate_child_sku:CHILD-X"))
assert.ok(duplicateSku.unresolvedSourceProductIds.includes("102"))

const wrongParent = parseConfigurableChildSkuGraphqlResponse({
  parentSku: "PARENT-1",
  expectedSourceProductIds: ["101"],
  response: {
    data: {
      products: {
        items: [
          {
            sku: "OTHER",
            __typename: "ConfigurableProduct",
            variants: [{ product: { id: 101, sku: "CHILD-S" } }],
          },
        ],
      },
    },
  },
})
assert.equal(wrongParent.complete, false)
assert.ok(wrongParent.issues.includes("parent_product_match_count:0"))

const graphqlError = parseConfigurableChildSkuGraphqlResponse({
  parentSku: "PARENT-1",
  expectedSourceProductIds: ["101"],
  response: {
    errors: [{ message: "Cannot query field id" }],
    data: { products: { items: [] } },
  },
})
assert.equal(graphqlError.complete, false)
assert.ok(graphqlError.issues.includes("graphql_response_contains_errors"))
assert.ok(graphqlError.issues.includes("parent_product_match_count:0"))

const unexpectedChild = parseConfigurableChildSkuGraphqlResponse({
  parentSku: "PARENT-1",
  expectedSourceProductIds: ["101"],
  response: {
    data: {
      products: {
        items: [
          {
            sku: "PARENT-1",
            __typename: "ConfigurableProduct",
            variants: [
              { product: { id: 101, sku: "CHILD-S" } },
              { product: { id: 999, sku: "UNEXPECTED" } },
            ],
          },
        ],
      },
    },
  },
})
assert.equal(unexpectedChild.complete, false)
assert.ok(unexpectedChild.issues.includes("unexpected_child_id:999"))

console.log(
  "COQUETTE configurable child SKU evidence contract passed with exact parent/child ID binding and fail-closed GraphQL handling"
)
