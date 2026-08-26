"use client"

import { usePathname } from "next/navigation"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { ENGLISH_LOCALE, GREEK_LOCALE } from "../lib/localization"
import { isMedusaStoreConfigured, medusa } from "../lib/medusa"
import { useRegion } from "./region"

type CartRetrieveResponse = Awaited<ReturnType<typeof medusa.store.cart.retrieve>>
export type StoreCart = CartRetrieveResponse["cart"]

type CartContextValue = {
  cart?: StoreCart
  itemCount: number
  loading: boolean
  error: string | null
  addToCart: (variantId: string, quantity?: number) => Promise<StoreCart>
  updateItemQuantity: (itemId: string, quantity: number) => Promise<StoreCart>
  removeItem: (itemId: string) => Promise<StoreCart>
  refreshCart: () => Promise<StoreCart | undefined>
}

const CartContext = createContext<CartContextValue | null>(null)
const CART_STORAGE_KEY = "coquette_cart_id"
const cartFields = "+items.*,+items.variant.*,+items.variant.options.*,+items.variant.options.option.*"

export function CartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { region } = useRegion()
  const [cart, setCart] = useState<StoreCart>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locale = pathname === "/en" || pathname.startsWith("/en/")
    ? ENGLISH_LOCALE
    : GREEK_LOCALE

  const createCart = useCallback(async () => {
    if (!isMedusaStoreConfigured || !region) {
      throw new Error("The COQUETTE commerce region is not configured.")
    }

    const { cart: created } = await medusa.store.cart.create(
      {
        region_id: region.id,
        locale,
      },
      { fields: cartFields }
    )

    localStorage.setItem(CART_STORAGE_KEY, created.id)
    setCart(created)
    return created
  }, [region, locale])

  const refreshCart = useCallback(async () => {
    if (!isMedusaStoreConfigured || !region) {
      return undefined
    }

    const cartId = localStorage.getItem(CART_STORAGE_KEY)
    if (!cartId) {
      return undefined
    }

    try {
      const { cart: refreshed } = await medusa.store.cart.retrieve(cartId, {
        fields: cartFields,
      })
      setCart(refreshed)
      return refreshed
    } catch (reason) {
      console.warn("COQUETTE stored cart is no longer valid", reason)
      localStorage.removeItem(CART_STORAGE_KEY)
      setCart(undefined)
      return undefined
    }
  }, [region])

  useEffect(() => {
    if (!isMedusaStoreConfigured || !region) {
      return
    }

    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const saved = await refreshCart()
        if (!active || !saved) {
          return
        }

        // Medusa supports mutating a cart's locale, but the StoreCart response type
        // doesn't currently expose a locale property. Apply the desired locale
        // idempotently whenever a persisted cart is restored or language changes.
        const { cart: updated } = await medusa.store.cart.update(
          saved.id,
          {
            ...(saved.region_id !== region.id ? { region_id: region.id } : {}),
            locale,
          },
          { fields: cartFields }
        )

        if (active) {
          setCart(updated)
        }
      } catch (reason) {
        if (!active) {
          return
        }
        console.error("COQUETTE cart loading failed", reason)
        setError("The cart could not be loaded.")
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [region?.id, locale, refreshCart])

  const ensureCart = useCallback(async () => {
    if (cart) {
      return cart
    }

    const restored = await refreshCart()
    return restored || createCart()
  }, [cart, refreshCart, createCart])

  const addToCart = useCallback(
    async (variantId: string, quantity = 1) => {
      setLoading(true)
      setError(null)
      try {
        const current = await ensureCart()
        const { cart: updated } = await medusa.store.cart.createLineItem(
          current.id,
          {
            variant_id: variantId,
            quantity,
          },
          { fields: cartFields }
        )
        setCart(updated)
        return updated
      } catch (reason) {
        console.error("COQUETTE add-to-cart failed", reason)
        setError("The product could not be added to the cart.")
        throw reason
      } finally {
        setLoading(false)
      }
    },
    [ensureCart]
  )

  const updateItemQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (!cart) {
        throw new Error("No active cart")
      }

      if (quantity < 1) {
        return removeItemInternal(cart, itemId, setCart)
      }

      setLoading(true)
      setError(null)
      try {
        const { cart: updated } = await medusa.store.cart.updateLineItem(
          cart.id,
          itemId,
          { quantity },
          { fields: cartFields }
        )
        setCart(updated)
        return updated
      } catch (reason) {
        console.error("COQUETTE cart quantity update failed", reason)
        setError("The cart quantity could not be updated.")
        throw reason
      } finally {
        setLoading(false)
      }
    },
    [cart]
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!cart) {
        throw new Error("No active cart")
      }

      setLoading(true)
      setError(null)
      try {
        return await removeItemInternal(cart, itemId, setCart)
      } catch (reason) {
        console.error("COQUETTE cart item removal failed", reason)
        setError("The product could not be removed from the cart.")
        throw reason
      } finally {
        setLoading(false)
      }
    },
    [cart]
  )

  const itemCount = (cart?.items ?? []).reduce(
    (total, item) => total + Number(item.quantity ?? 0),
    0
  )

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount,
      loading,
      error,
      addToCart,
      updateItemQuantity,
      removeItem,
      refreshCart,
    }),
    [cart, itemCount, loading, error, addToCart, updateItemQuantity, removeItem, refreshCart]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

async function removeItemInternal(
  cart: StoreCart,
  itemId: string,
  setCart: (cart: StoreCart) => void
) {
  const { parent } = await medusa.store.cart.deleteLineItem(cart.id, itemId, {
    fields: cartFields,
  })
  const updated = parent as StoreCart
  setCart(updated)
  return updated
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error("useCart must be used within CartProvider")
  }

  return context
}
