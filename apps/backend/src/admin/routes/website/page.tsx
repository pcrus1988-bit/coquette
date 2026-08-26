import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { FormEvent, useCallback, useEffect, useState } from "react"

type ContentSection = {
  id: string
  type: "hero" | "rich_text" | "image_text" | "product_collection" | "banner" | "spacer"
  enabled: boolean
  data: Record<string, unknown>
}

type ContentPage = {
  id: string
  handle: string
  locale: "el" | "en"
  title: string
  status: "draft" | "published"
  sections: ContentSection[]
  seo_title: string | null
  seo_description: string | null
  magento_source_id?: string | null
}

type ContentDraft = {
  handle: string
  locale: "el" | "en"
  title: string
  status: "draft" | "published"
  sectionsText: string
  seo_title: string
  seo_description: string
}

const emptyDraft: ContentDraft = {
  handle: "",
  locale: "el",
  title: "",
  status: "draft",
  sectionsText: "[]",
  seo_title: "",
  seo_description: "",
}

const toDraft = (page: ContentPage): ContentDraft => ({
  handle: page.handle,
  locale: page.locale,
  title: page.title,
  status: page.status,
  sectionsText: JSON.stringify(page.sections ?? [], null, 2),
  seo_title: page.seo_title ?? "",
  seo_description: page.seo_description ?? "",
})

const fieldClass =
  "w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive"

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { message?: string }

  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`)
  }

  return payload
}

function parseSections(value: string): ContentSection[] {
  const parsed = JSON.parse(value) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error("Sections must be a JSON array.")
  }

  return parsed as ContentSection[]
}

const WebsitePage = () => {
  const [pages, setPages] = useState<ContentPage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ContentDraft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadPages = useCallback(async (preferredId?: string) => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/admin/website?limit=200", {
        credentials: "include",
      })
      const payload = await readJson<{ pages: ContentPage[] }>(response)
      setPages(payload.pages)

      const nextSelected =
        payload.pages.find((item) => item.id === preferredId) ??
        payload.pages.find((item) => item.id === selectedId) ??
        payload.pages[0]

      if (nextSelected) {
        setSelectedId(nextSelected.id)
        setDraft(toDraft(nextSelected))
      } else {
        setSelectedId(null)
        setDraft(emptyDraft)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load website content.")
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void loadPages()
    // Initial load only; later refreshes are explicit after saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectPage = (page: ContentPage) => {
    setSelectedId(page.id)
    setDraft(toDraft(page))
    setMessage(null)
  }

  const startNew = () => {
    setSelectedId(null)
    setDraft(emptyDraft)
    setMessage(null)
  }

  const savePage = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const sections = parseSections(draft.sectionsText)
      const response = await fetch(
        selectedId ? `/admin/website/${selectedId}` : "/admin/website",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle: draft.handle,
            locale: draft.locale,
            title: draft.title,
            status: draft.status,
            sections,
            seo_title: draft.seo_title || null,
            seo_description: draft.seo_description || null,
          }),
        }
      )
      const payload = await readJson<{ page: ContentPage }>(response)
      setMessage(selectedId ? "Website content updated." : "Website content created.")
      await loadPages(payload.page.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save website content.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(480px,1.2fr)]">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div>
            <Heading level="h1">Website</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              Manage bilingual COQUETTE pages and SEO without editing code.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={startNew}>
            New page
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-3">
          {loading ? (
            <Text className="px-3 py-4 text-ui-fg-subtle">Loading website content…</Text>
          ) : pages.length === 0 ? (
            <Text className="px-3 py-4 text-ui-fg-subtle">
              No content pages yet. Create the first record.
            </Text>
          ) : (
            pages.map((page) => (
              <button
                type="button"
                key={page.id}
                onClick={() => selectPage(page)}
                className={`mb-1 w-full rounded-md px-3 py-3 text-left transition-colors ${
                  selectedId === page.id
                    ? "bg-ui-bg-base-pressed"
                    : "hover:bg-ui-bg-base-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Text weight="plus">{page.title}</Text>
                  <Text size="xsmall" className="uppercase text-ui-fg-subtle">
                    {page.locale}
                  </Text>
                </div>
                <Text size="small" className="mt-1 text-ui-fg-subtle">
                  {page.handle} · {page.status}
                </Text>
              </button>
            ))
          )}
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">{selectedId ? "Edit website content" : "Create website content"}</Heading>
          <Text className="mt-1 text-ui-fg-subtle">
            Phase 3 provides structured CRUD. A visual section editor is a Phase 5 merchant-parity enhancement.
          </Text>
        </div>
        <form className="space-y-5 px-6 py-6" onSubmit={savePage}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <Text size="small" weight="plus">Title</Text>
              <input
                className={fieldClass}
                required
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label className="block space-y-2">
              <Text size="small" weight="plus">Handle</Text>
              <input
                className={fieldClass}
                required
                value={draft.handle}
                onChange={(event) => setDraft({ ...draft, handle: event.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <Text size="small" weight="plus">Locale</Text>
              <select
                className={fieldClass}
                value={draft.locale}
                onChange={(event) =>
                  setDraft({ ...draft, locale: event.target.value as "el" | "en" })
                }
              >
                <option value="el">Greek (el)</option>
                <option value="en">English (en)</option>
              </select>
            </label>
            <label className="block space-y-2">
              <Text size="small" weight="plus">Status</Text>
              <select
                className={fieldClass}
                value={draft.status}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    status: event.target.value as "draft" | "published",
                  })
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <Text size="small" weight="plus">Sections JSON</Text>
            <textarea
              className={`${fieldClass} min-h-64 font-mono`}
              value={draft.sectionsText}
              onChange={(event) => setDraft({ ...draft, sectionsText: event.target.value })}
              spellCheck={false}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              Accepted section types: hero, rich_text, image_text, product_collection, banner, spacer.
            </Text>
          </label>

          <label className="block space-y-2">
            <Text size="small" weight="plus">SEO title</Text>
            <input
              className={fieldClass}
              value={draft.seo_title}
              onChange={(event) => setDraft({ ...draft, seo_title: event.target.value })}
            />
          </label>
          <label className="block space-y-2">
            <Text size="small" weight="plus">SEO description</Text>
            <textarea
              className={`${fieldClass} min-h-24`}
              value={draft.seo_description}
              onChange={(event) => setDraft({ ...draft, seo_description: event.target.value })}
            />
          </label>

          <div className="flex items-center justify-between gap-4 pt-2">
            <Text size="small" className="text-ui-fg-subtle">
              {message ?? "Content is stored in the COQUETTE Medusa database."}
            </Text>
            <Button type="submit" isLoading={saving} disabled={saving}>
              {selectedId ? "Save changes" : "Create page"}
            </Button>
          </div>
        </form>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Website",
})

export default WebsitePage
