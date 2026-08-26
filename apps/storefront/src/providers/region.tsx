"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { isMedusaStoreConfigured, medusa } from "../lib/medusa"

type RegionListResponse = Awaited<ReturnType<typeof medusa.store.region.list>>
export type StoreRegion = RegionListResponse["regions"][number]

type RegionContextValue = {
  region?: StoreRegion
  regions: StoreRegion[]
  loading: boolean
  error: string | null
  selectRegion: (regionId: string) => void
}

const RegionContext = createContext<RegionContextValue | null>(null)
const REGION_STORAGE_KEY = "coquette_region_id"
const defaultCountryCode = (
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "gr"
).toLowerCase()

function servesCountry(region: StoreRegion, countryCode: string) {
  return (region.countries ?? []).some(
    (country) => country.iso_2?.toLowerCase() === countryCode
  )
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [regions, setRegions] = useState<StoreRegion[]>([])
  const [region, setRegion] = useState<StoreRegion>()
  const [loading, setLoading] = useState(isMedusaStoreConfigured)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isMedusaStoreConfigured) {
      setLoading(false)
      return
    }

    let active = true

    medusa.store.region
      .list({ fields: "*countries" })
      .then(({ regions: fetchedRegions }) => {
        if (!active) {
          return
        }

        setRegions(fetchedRegions)
        const storedId = localStorage.getItem(REGION_STORAGE_KEY)
        const storedRegion = storedId
          ? fetchedRegions.find((candidate) => candidate.id === storedId)
          : undefined
        const countryRegion = fetchedRegions.find((candidate) =>
          servesCountry(candidate, defaultCountryCode)
        )
        const selected = storedRegion || countryRegion || fetchedRegions[0]

        if (selected) {
          setRegion(selected)
          localStorage.setItem(REGION_STORAGE_KEY, selected.id)
        }

        if (!selected) {
          setError("No Medusa storefront region is configured.")
        }
      })
      .catch((reason) => {
        if (!active) {
          return
        }

        console.error("COQUETTE region loading failed", reason)
        setError("The commerce region could not be loaded.")
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const value = useMemo<RegionContextValue>(
    () => ({
      region,
      regions,
      loading,
      error,
      selectRegion: (regionId) => {
        const selected = regions.find((candidate) => candidate.id === regionId)
        if (!selected) {
          return
        }
        setRegion(selected)
        localStorage.setItem(REGION_STORAGE_KEY, selected.id)
      },
    }),
    [region, regions, loading, error]
  )

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
}

export function useRegion() {
  const context = useContext(RegionContext)

  if (!context) {
    throw new Error("useRegion must be used within RegionProvider")
  }

  return context
}
