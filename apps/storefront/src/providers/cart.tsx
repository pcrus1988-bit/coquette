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
type CartUpdateInput = Parameters<typeof medusa.store.cart.update>[1]
type PaymentSessionInput = Parameters<
  typeof medusa.store.payment.initiatePaymentSession
>[1]
export type CompleteCartResponse = Awaited<
  ReturnType<typeof medusa.store.cart.complete>
>

export type CheckoutAddress = {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  company?: string
  postal_code: string
  city: string
  country_code: string
  province?: string
  phone?: string
}

type CartContextValue = {
  cart?: StoreCart
  itemCount: number
  loading: boolean
  error: string | null
  addToCart: (variantId: string, quantity?: number) => Promise<StoreCart>
  updateItemQuantity: (itemId: string, quantity: number) => Promise<StoreCart>
  removeItem: (itemId: string) => Promise<StoreCart>
  updateCart: (input: CartUpdateInput) => Promise<StoreCart>
  updateCheckoutContact: (input: {
    email: string
    shippingAddress: CheckoutAddress
    billingAddress?: CheckoutAddress
  }) => Promise<StoreCart>
  addShippingMethod: (optionId: string, data?: Record<string, unknown>) => Promise<StoreCart>
  initiatePaymentSession: (input: PaymentSessionInput) => Promise<StoreCart>
  completeCart: () => Promise<CompleteCartResponse>
  refreshCart: () => Promise<StoreCart | undefined>
}

const CartContext = createContext<CartContextValue | null>(null)
const CART_STORAGE_KEY = "coquette_cart_id"
const cartFields = [
  "+items.*",
  "+items.variant.*",
  "+items.variant.options.*",
  "+items.variant.options.option.*",
  "+shipping_methods.*",
  "+shipping_address.*",
  "+billing_address.*",
  "+payment_collection.*",
  "+payment_collection.payment_sessions.*",
].join(",")

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

  const updateCart = useCallback(
    async (input: CartUpdateInput) => {
      setLoading(true)
      setError(null)
      try {
        const current = await ensureCart()
        const { cart: updated } = await medusa.store.cart.update(
          current.id,
          input,
          { fields: cartFields }
        )
        setCart(updated)
        return updated
      } catch (reason) {
        console.error("COQUETTE cart update failed", reason)
        setError("The checkout details could not be saved.")
        throw reason
      } finally {
        setLoading(false)
      }
    },
    [ensureCart]
  )

  const updateCheckoutContact = useCallback(
    async ({
      email,
      shippingAddress,
      billingAddress,
    }: {
      email: string
      shippingAddress: CheckoutAddress
      billingAddress?: CheckoutAddress
    }) =>
      updateCart({
        email,
        shipping_address: shippingAddress,
        billing_address: billingAddress || shippingAddress,
      }),
    [updateCart]
  )

  const addShippingMethod = useCallback(
    async (optionId: string, data?: Record<string, unknown>) => {
      if (!cart) {
        throw new Error("No active cart")
      }

      setLoading(true)
      setError(null)
      try {
        const { cart: updated } = await medusa.store.cart.addShippingMethod(
          cart.id,
          {
            option_id: optionId,
            ...(data ? { data } : {}),
          },
          { fields: cartFields }
        )
        setCart(updated)
        return updated
      } catch (reason) {
        console.error("COQUETTE shipping-method selection failed", reason)
        setError("The shipping method could not be selected.")
        throw reason
      } finally {
        setLoading(false)
      }
    },
    [cart]
  )

  const initiatePaymentSession = useCallback(
    async (input: PaymentSessionInput) => {
      if (!cart) {
        throw new Error("No active cart")
      }

      setLoading(true)
      setError(null)
      try {
        await medusa.store.payment.initiatePaymentSession(cart, input)
        const { cart: updated } = await medusa.store.cart.retrieve(cart.id, {
          fields: cartFields,
        })
        setCart(updated)
        return updated
      } catch (reason) {
        console.error("COQUETTE payment-session initialization failed", reason)
        setError("The payment method could not be initialized.")
        throw reason
      } finally {
        setLoading(false)
      }
    },
    [cart]
  )

  const completeCart = useCallback(async () => {
    if (!cart) {
      throw new Error("No active cart")
    }

    setLoading(true)
    setError(null)
    try {
      const result = await medusa.store.cart.complete(cart.id)

      if (result.type === "order") {
        localStorage.removeItem(CART_STORAGE_KEY)
        setCart(undefined)
        return result
      }

      if (result.cart) {
        setCart(result.cart as StoreCart)
      }
      setError(result.error?.message || "The order could not be completed.")
      return result
    } catch (reason) {
      console.error("COQUETTE cart completion failed", reason)
      setError("The order could not be completed.")
      throw reason
    } finally {
      setLoading(false)
    }
  }, [cart])

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
      updateCart,
      updateCheckoutContact,
      addShippingMethod,
      initiatePaymentSession,
      completeCart,
      refreshCart,
    }),
    [
      cart,
      itemCount,
      loading,
      error,
      addToCart,
      updateItemQuantity,
      removeItem,
      updateCart,
      updateCheckoutContact,
      addShippingMethod,
      initiatePaymentSession,
      completeCart,
      refreshCart,
    ]
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
