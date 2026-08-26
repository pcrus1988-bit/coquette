import type { CatalogueSort } from "./catalogue"

export type CatalogueSearchParams = {
  page?: string
  q?: string
  sort?: string
  option?: string | string[]
}

const allowedSorts = new Set<CatalogueSort>([
  "",
  "-created_at",
  "created_at",
  "title",
  "-title",
])

export function parseCatalogueSearchParams(params: CatalogueSearchParams) {
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1)
  const query = params.q?.trim() || ""
  const sortCandidate = params.sort || ""
  const sort = allowedSorts.has(sortCandidate as CatalogueSort)
    ? (sortCandidate as CatalogueSort)
    : ""
  const rawOptions = Array.isArray(params.option)
    ? params.option
    : params.option
      ? [params.option]
      : []
  const optionValueIds = [...new Set(rawOptions.map((value) => value.trim()))].filter(
    (value) => /^optval_[A-Za-z0-9_-]+$/.test(value)
  )

  return {
    page,
    query,
    sort,
    optionValueIds,
  }
}
