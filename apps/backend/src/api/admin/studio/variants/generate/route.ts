import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  STUDIO_VARIANT_GRAPH_VERSION,
  buildStudioVariantPlan,
  cleanStudioVariantProductId,
  loadStudioVariantProduct,
  studioVariantDraftIsStale,
  studioVariantDraftProblem,
  studioVariantGraphExists,
} from "../../../../../lib/studio-variants"
import generateStudioProductVariantsWorkflow from "../../../../../workflows/generate-studio-product-variants"

const GeneratePayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    blueprint_hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

type RouteResult = {
  status: number
  body: Record<string, unknown>
}

function mapGeneratedProduct(product: NonNullable<Awaited<ReturnType<typeof loadStudioVariantProduct>>>) {
  return {
    id: product.id,
    status: product.status,
    metadata: product.metadata ?? {},
    updated_at: product.updated_at || null,
    options: (product.options ?? []).map((option) => ({
      id: option.id,
      title: option.title || "Option",
      values: (option.values ?? []).map((value) => ({
        id: value.id,
        value: value.value || "",
      })),
    })),
    variants: (product.variants ?? []).map((variant) => ({
      id: variant.id,
      title: variant.title || "Variant",
      manage_inventory: Boolean(variant.manage_inventory),
      allow_backorder: Boolean(variant.allow_backorder),
    })),
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = GeneratePayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded variant-generation request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioVariantProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)

  let result: RouteResult
  try {
    result = await locking.execute(
      `coquette-studio-variants:${productId}`,
      async (): Promise<RouteResult> => {
        const product = await loadStudioVariantProduct(req, productId)
        const guard = studioVariantDraftProblem(product)
        if (guard) {
          return {
            status: guard.status,
            body: { message: guard.message, code: guard.code },
          }
        }

        if (studioVariantDraftIsStale(product!, parsed.data.expected_updated_at)) {
          return {
            status: 409,
            body: {
              message: "This draft changed in another session. Reload it before building choices.",
              code: "stale_draft",
              updated_at: product!.updated_at || null,
            },
          }
        }

        if (studioVariantGraphExists(product!)) {
          return {
            status: 409,
            body: {
              message:
                product!.metadata?.coquette_studio_variants_generated === "true"
                  ? "The choice graph has already been generated for this draft."
                  : "This draft already has options or variants outside the guarded Studio generator.",
              code:
                product!.metadata?.coquette_studio_variants_generated === "true"
                  ? "variant_graph_generated"
                  : "existing_variant_graph",
            },
          }
        }

        const { plan, problem } = buildStudioVariantPlan(product!)
        if (!plan) {
          return {
            status: 409,
            body: {
              message: problem?.message || "The saved choice blueprint is incomplete.",
              code: problem?.code || "invalid_blueprint",
            },
          }
        }

        if (plan.blueprint_hash !== parsed.data.blueprint_hash) {
          return {
            status: 409,
            body: {
              message: "The saved choice blueprint changed after the preview. Refresh the plan before building choices.",
              code: "stale_blueprint",
              blueprint_hash: plan.blueprint_hash,
            },
          }
        }

        const generatedAt = new Date().toISOString()
        const optionMetadata = {
          coquette_studio_origin: "guided_variant_generation",
          coquette_studio_product_id: productId,
          coquette_studio_blueprint_hash: plan.blueprint_hash,
        }
        const variantMetadata = {
          coquette_studio_origin: "guided_variant_generation",
          coquette_studio_blueprint_hash: plan.blueprint_hash,
        }
        const existingMetadata =
          product!.metadata && typeof product!.metadata === "object"
            ? product!.metadata
            : {}
        const productMetadata = {
          ...existingMetadata,
          coquette_studio_variants_generated: "true",
          coquette_studio_variant_blueprint_hash: plan.blueprint_hash,
          coquette_studio_variant_count: String(plan.variant_count),
          coquette_studio_variant_graph_version: STUDIO_VARIANT_GRAPH_VERSION,
          coquette_studio_variants_generated_at: generatedAt,
        }

        await generateStudioProductVariantsWorkflow(req.scope).run({
          input: {
            product_id: productId,
            blueprint_hash: plan.blueprint_hash,
            options: plan.options.map((option) => ({
              title: option.title,
              values: option.values,
              is_exclusive: true as const,
              metadata: optionMetadata,
            })),
            variants: plan.variants.map((variant) => ({
              product_id: productId,
              title: variant.title,
              manage_inventory: false as const,
              allow_backorder: false as const,
              options: variant.options,
              metadata: variantMetadata,
            })),
            product_metadata: productMetadata,
          },
        })

        const updated = await loadStudioVariantProduct(req, productId)
        const updatedGuard = studioVariantDraftProblem(updated)
        const generatedHash = updated?.metadata?.coquette_studio_variant_blueprint_hash
        const variants = updated?.variants ?? []
        const options = updated?.options ?? []
        const graphIsSafe = variants.every(
          (variant) =>
            variant.manage_inventory === false && variant.allow_backorder === false
        )

        if (
          updatedGuard ||
          !updated ||
          generatedHash !== plan.blueprint_hash ||
          options.length !== plan.options.length ||
          variants.length !== plan.variant_count ||
          !graphIsSafe
        ) {
          console.error("COQUETTE Studio variant generation invariant failed", {
            productId,
            guard: updatedGuard,
            generatedHash,
            optionCount: options.length,
            variantCount: variants.length,
            graphIsSafe,
          })
          return {
            status: 500,
            body: {
              message: "The generated choice graph failed its safety verification.",
              code: "variant_generation_invariant_failed",
            },
          }
        }

        return {
          status: 200,
          body: {
            product: mapGeneratedProduct(updated),
            plan: {
              mode: plan.mode,
              option_count: plan.options.length,
              variant_count: plan.variant_count,
              blueprint_hash: plan.blueprint_hash,
            },
          },
        }
      },
      { timeout: 10 }
    )
  } catch (error) {
    console.error("COQUETTE Studio variant generation failed", error)
    return res.status(502).json({
      message: "The choice graph could not be generated safely.",
      code: "variant_generation_failed",
    })
  }

  return res.status(result.status).json(result.body)
}
