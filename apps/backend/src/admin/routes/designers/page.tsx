import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"

type Designer = {
  id: string
  name: string
  handle: string
  description: string | null
  logo_url: string | null
  magento_source_id?: string | null
}

type DesignerDraft = {
  name: string
  handle: string
  description: string
  logo_url: string
}

const emptyDraft: DesignerDraft = {
  name: "",
  handle: "",
  description: "",
  logo_url: "",
}

const toDraft = (designer: Designer): DesignerDraft => ({
  name: designer.name,
  handle: designer.handle,
  description: designer.description ?? "",
  logo_url: designer.logo_url ?? "",
})

const fieldClass =
  "w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive"

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { message?: string }

  if (!response.ok) {
    return Promise.reject(
      payload.message || `Request failed with status ${response.status}`
    )
  }

  return payload
}

const DesignersPage = () => {
  const [designers, setDesigners] = useState<Designer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DesignerDraft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadDesigners = useCallback(async (preferredId?: string) => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch("/admin/designers?limit=200", {
        credentials: "include",
      })
      const payload = await readJson<{ designers: Designer[] }>(response)
      setDesigners(payload.designers)

      const nextSelected =
        payload.designers.find((item) => item.id === preferredId) ??
        payload.designers.find((item) => item.id === selectedId) ??
        payload.designers[0]

      if (nextSelected) {
        setSelectedId(nextSelected.id)
        setDraft(toDraft(nextSelected))
      } else {
        setSelectedId(null)
        setDraft(emptyDraft)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void loadDesigners()
  }, [])

  const selectDesigner = (designer: Designer) => {
    setSelectedId(designer.id)
    setDraft(toDraft(designer))
    setMessage(null)
  }

  const startNew = () => {
    setSelectedId(null)
    setDraft(emptyDraft)
    setMessage(null)
  }

  const saveDesigner = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch(
        selectedId ? `/admin/designers/${selectedId}` : "/admin/designers",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            description: draft.description || null,
            logo_url: draft.logo_url || null,
          }),
        }
      )
      const payload = await readJson<{ designer: Designer }>(response)
      setMessage(selectedId ? "Designer updated." : "Designer created.")
      await loadDesigners(payload.designer.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)]">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div>
            <Heading level="h1">Designers</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              First-class designer and brand records used by products and navigation.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={startNew}>
            New designer
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-3">
          {loading ? (
            <Text className="px-3 py-4 text-ui-fg-subtle">Loading designers…</Text>
          ) : designers.length === 0 ? (
            <Text className="px-3 py-4 text-ui-fg-subtle">
              No designers yet. Create the first record.
            </Text>
          ) : (
            designers.map((designer) => (
              <button
                type="button"
                key={designer.id}
                onClick={() => selectDesigner(designer)}
                className={`mb-1 w-full rounded-md px-3 py-3 text-left transition-colors ${
                  selectedId === designer.id
                    ? "bg-ui-bg-base-pressed"
                    : "hover:bg-ui-bg-base-hover"
                }`}
              >
                <Text weight="plus">{designer.name}</Text>
                <Text size="small" className="mt-1 text-ui-fg-subtle">
                  {designer.handle}
                </Text>
              </button>
            ))
          )}
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">{selectedId ? "Edit designer" : "Create designer"}</Heading>
          <Text className="mt-1 text-ui-fg-subtle">
            Magento source IDs remain migration-owned; ordinary merchant edits stay here.
          </Text>
        </div>
        <form className="space-y-5 px-6 py-6" onSubmit={saveDesigner}>
          <label className="block space-y-2">
            <Text size="small" weight="plus">Name</Text>
            <input
              className={fieldClass}
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
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
          <label className="block space-y-2">
            <Text size="small" weight="plus">Description</Text>
            <textarea
              className={`${fieldClass} min-h-28`}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
          <label className="block space-y-2">
            <Text size="small" weight="plus">Logo URL</Text>
            <input
              className={fieldClass}
              value={draft.logo_url}
              onChange={(event) => setDraft({ ...draft, logo_url: event.target.value })}
              placeholder="https://…"
            />
          </label>
          <div className="flex items-center justify-between gap-4 pt-2">
            <Text size="small" className="text-ui-fg-subtle">
              {message ?? "Changes are stored in the COQUETTE Medusa database."}
            </Text>
            <Button type="submit" isLoading={saving} disabled={saving}>
              {selectedId ? "Save changes" : "Create designer"}
            </Button>
          </div>
        </form>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Designers",
})

export default DesignersPage
