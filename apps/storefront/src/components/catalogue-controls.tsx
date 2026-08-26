import Link from "next/link"
import type {
  CatalogueProductOption,
  CatalogueSort,
} from "../lib/catalogue"

type StorefrontLanguage = "el" | "en"

type CatalogueControlsProps = {
  action: string
  language: StorefrontLanguage
  query?: string
  sort?: CatalogueSort
  selectedOptionValueIds?: string[]
  options: CatalogueProductOption[]
}

const copy = {
  el: {
    search: "Αναζήτηση στην επιλογή",
    searchPlaceholder: "Τίτλος ή περιγραφή προϊόντος",
    sort: "Ταξινόμηση",
    recommended: "Προτεινόμενα",
    newest: "Νεότερα πρώτα",
    oldest: "Παλαιότερα πρώτα",
    titleAsc: "Όνομα Α–Ω",
    titleDesc: "Όνομα Ω–Α",
    color: "Χρώμα",
    size: "Μέγεθος",
    price: "Τιμή",
    designer: "Σχεδιαστής",
    later: "επόμενο φίλτρο",
    apply: "Εφαρμογή",
    clear: "Καθαρισμός",
    noValues: "Δεν έχουν μεταφερθεί ακόμη global τιμές.",
  },
  en: {
    search: "Search this selection",
    searchPlaceholder: "Product title or description",
    sort: "Sort",
    recommended: "Recommended",
    newest: "Newest first",
    oldest: "Oldest first",
    titleAsc: "Name A–Z",
    titleDesc: "Name Z–A",
    color: "Colour",
    size: "Size",
    price: "Price",
    designer: "Designer",
    later: "next filter",
    apply: "Apply",
    clear: "Clear",
    noValues: "Global option values have not been migrated yet.",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

const colorAliases = new Set(["color", "colour", "χρώμα", "χρωμα"])
const sizeAliases = new Set(["size", "sizes", "μέγεθος", "μεγεθος"])

function normalizeTitle(value: string) {
  return value.trim().toLocaleLowerCase("el-GR")
}

function valuesForDimension(
  options: CatalogueProductOption[],
  dimension: "color" | "size"
) {
  const aliases = dimension === "color" ? colorAliases : sizeAliases
  const values = options
    .filter((option) => aliases.has(normalizeTitle(option.title)))
    .flatMap((option) => option.values ?? [])

  return [...new Map(values.map((value) => [value.id, value])).values()].sort(
    (left, right) => left.value.localeCompare(right.value, "el", { numeric: true })
  )
}

export function CatalogueControls({
  action,
  language,
  query = "",
  sort = "",
  selectedOptionValueIds = [],
  options,
}: CatalogueControlsProps) {
  const labels = copy[language]
  const selected = new Set(selectedOptionValueIds)
  const colors = valuesForDimension(options, "color")
  const sizes = valuesForDimension(options, "size")

  return (
    <section className="border-y border-neutral-200 bg-white">
      <form action={action} className="mx-auto max-w-[1440px] px-5 py-5 lg:px-8" method="get">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {labels.search}
            </span>
            <input
              className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
              defaultValue={query}
              name="q"
              placeholder={labels.searchPlaceholder}
              type="search"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {labels.sort}
            </span>
            <select
              className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
              defaultValue={sort}
              name="sort"
            >
              <option value="">{labels.recommended}</option>
              <option value="-created_at">{labels.newest}</option>
              <option value="created_at">{labels.oldest}</option>
              <option value="title">{labels.titleAsc}</option>
              <option value="-title">{labels.titleDesc}</option>
            </select>
          </label>

          <div className="flex gap-2">
            <button
              className="bg-neutral-950 px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-white"
              type="submit"
            >
              {labels.apply}
            </button>
            <Link
              className="border border-neutral-300 px-5 py-3 text-[11px] uppercase tracking-[0.14em]"
              href={action}
            >
              {labels.clear}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FilterDetails
            emptyLabel={labels.noValues}
            label={labels.color}
            selected={selected}
            values={colors}
          />
          <FilterDetails
            emptyLabel={labels.noValues}
            label={labels.size}
            selected={selected}
            values={sizes}
          />
          <span
            className="cursor-not-allowed border border-neutral-200 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400"
            title={labels.later}
          >
            {labels.price} +
          </span>
          <span
            className="cursor-not-allowed border border-neutral-200 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400"
            title={labels.later}
          >
            {labels.designer} +
          </span>
        </div>
      </form>
    </section>
  )
}

function FilterDetails({
  emptyLabel,
  label,
  selected,
  values,
}: {
  emptyLabel: string
  label: string
  selected: Set<string>
  values: Array<{ id: string; value: string }>
}) {
  const selectedCount = values.filter((value) => selected.has(value.id)).length

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none border border-neutral-300 px-4 py-2 text-[11px] uppercase tracking-[0.12em]">
        {label}{selectedCount > 0 ? ` (${selectedCount})` : " +"}
      </summary>
      <div className="absolute left-0 z-20 mt-2 max-h-72 min-w-52 overflow-y-auto border border-neutral-200 bg-white p-4 shadow-xl">
        {values.length === 0 ? (
          <p className="w-56 text-xs leading-5 text-neutral-500">{emptyLabel}</p>
        ) : (
          <div className="space-y-2">
            {values.map((value) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm" key={value.id}>
                <input
                  defaultChecked={selected.has(value.id)}
                  name="option"
                  type="checkbox"
                  value={value.id}
                />
                <span>{value.value}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}
