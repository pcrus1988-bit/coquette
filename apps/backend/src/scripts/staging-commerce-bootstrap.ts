import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

const REGION_NAME = "Greece"
const COUNTRY_CODE = "gr"
const STOCK_LOCATION_NAME = "COQUETTE Greece"
const FULFILLMENT_SET_NAME = "COQUETTE Greece delivery"
const SERVICE_ZONE_NAME = "Greece"
const SHIPPING_PROFILE_NAME = "Default Shipping Profile"
const STANDARD_SHIPPING_OPTION_NAME = "Standard Greece"
const STORE_LOCALES = ["el-GR", "en-GB"]

const parseShippingAmount = () => {
  const value = process.env.COQUETTE_STANDARD_SHIPPING_EUR?.trim()

  if (!value) {
    return null
  }

  const amount = Number(value)

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      "COQUETTE_STANDARD_SHIPPING_EUR must be a non-negative number"
    )
  }

  return amount
}

const isExistingLinkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  return (
    normalized.includes("already") ||
    normalized.includes("duplicate") ||
    normalized.includes("unique")
  )
}

const createLinkIfMissing = async (
  link: { create: (definition: Record<string, unknown>) => Promise<unknown> },
  definition: Record<string, unknown>
) => {
  try {
    await link.create(definition)
  } catch (error) {
    if (!isExistingLinkError(error)) {
      throw error
    }
  }
}

export default async function stagingCommerceBootstrap({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const storeModuleService = container.resolve(Modules.STORE)
  const regionModuleService = container.resolve(Modules.REGION)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const paymentModuleService = container.resolve(Modules.PAYMENT)

  const stores = await storeModuleService.listStores({}, { take: 2 })
  if (stores.length !== 1) {
    throw new Error(
      `Expected exactly one COQUETTE store, found ${stores.length}. Refusing to guess.`
    )
  }
  const store = stores[0]

  const salesChannels = await salesChannelModuleService.listSalesChannels(
    {},
    { take: 2 }
  )
  if (salesChannels.length !== 1) {
    throw new Error(
      `Expected exactly one COQUETTE sales channel, found ${salesChannels.length}. Refusing to guess.`
    )
  }
  const salesChannel = salesChannels[0]

  const paymentProviders = await paymentModuleService.listPaymentProviders({})
  const enabledPaymentProviderIds = paymentProviders
    .map((provider) => provider.id)
    .filter(
      (id) =>
        id === "pp_system_default" ||
        id.includes("paypal") ||
        id.includes("klarna")
    )

  const providerIds = enabledPaymentProviderIds.length
    ? enabledPaymentProviderIds
    : ["pp_system_default"]

  let [region] = await regionModuleService.listRegions({ name: REGION_NAME })

  if (!region) {
    logger.info("Creating Greece EUR region")
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: "eur",
            countries: [COUNTRY_CODE],
            payment_providers: providerIds,
          },
        ],
      },
    })
    region = result[0]
  } else {
    const countries = await regionModuleService.listCountries({
      region_id: region.id,
    })
    const hasGreece = countries.some(
      (country) => country.iso_2.toLowerCase() === COUNTRY_CODE
    )

    if (!hasGreece || providerIds.length > 1) {
      logger.info("Updating Greece region country/payment-provider links")
    }

    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: region.id },
        update: {
          countries: [COUNTRY_CODE],
          payment_providers: providerIds,
        },
      },
    })
    ;[region] = await regionModuleService.listRegions({ id: region.id })
  }

  if (!region) {
    throw new Error("Greece region was not available after bootstrap")
  }

  logger.info("Configuring COQUETTE store defaults and locales")
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "COQUETTE",
        default_region_id: region.id,
        default_sales_channel_id: salesChannel.id,
        supported_locales: STORE_LOCALES.map((locale_code) => ({
          locale_code,
        })),
      },
    },
  })

  let [stockLocation] = await stockLocationModuleService.listStockLocations({
    name: STOCK_LOCATION_NAME,
  })

  if (!stockLocation) {
    logger.info("Creating COQUETTE Greece stock location")
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: STOCK_LOCATION_NAME,
          },
        ],
      },
    })
    stockLocation = result[0]
  }

  if (!stockLocation) {
    throw new Error("Stock location was not available after bootstrap")
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "COQUETTE",
        default_region_id: region.id,
        default_location_id: stockLocation.id,
        default_sales_channel_id: salesChannel.id,
        supported_locales: STORE_LOCALES.map((locale_code) => ({
          locale_code,
        })),
      },
    },
  })

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocation.id,
        add: [salesChannel.id],
      },
    })
  } catch (error) {
    if (!isExistingLinkError(error)) {
      throw error
    }
  }

  const manualProviders = await fulfillmentModuleService.listFulfillmentProviders({
    id: "manual_manual",
  })
  if (!manualProviders.length) {
    throw new Error(
      "The manual fulfillment provider is unavailable; cannot create staging shipping configuration"
    )
  }

  await createLinkIfMissing(link, {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  })

  let [shippingProfile] = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })

  if (!shippingProfile) {
    logger.info("Creating default shipping profile")
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: SHIPPING_PROFILE_NAME,
            type: "default",
          },
        ],
      },
    })
    shippingProfile = result[0]
  }

  if (!shippingProfile) {
    throw new Error("Default shipping profile was not available after bootstrap")
  }

  let [fulfillmentSet] = await fulfillmentModuleService.listFulfillmentSets({
    name: FULFILLMENT_SET_NAME,
  })

  if (!fulfillmentSet) {
    logger.info("Creating Greece fulfillment set and service zone")
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: SERVICE_ZONE_NAME,
          geo_zones: [
            {
              type: "country",
              country_code: COUNTRY_CODE,
            },
          ],
        },
      ],
    })
  }

  if (!fulfillmentSet) {
    throw new Error("Fulfillment set was not available after bootstrap")
  }

  await createLinkIfMissing(link, {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  })

  const serviceZones = await fulfillmentModuleService.listServiceZones({})
  const serviceZone = serviceZones.find(
    (zone) =>
      zone.fulfillment_set_id === fulfillmentSet.id &&
      zone.name === SERVICE_ZONE_NAME
  )

  if (!serviceZone) {
    throw new Error("Greece service zone was not available after bootstrap")
  }

  const shippingAmount = parseShippingAmount()
  const allShippingOptions = await fulfillmentModuleService.listShippingOptions({})
  const shippingOption = allShippingOptions.find(
    (option) =>
      option.service_zone_id === serviceZone.id &&
      option.name === STANDARD_SHIPPING_OPTION_NAME
  )

  if (!shippingOption && shippingAmount !== null) {
    logger.info(
      `Creating Standard Greece shipping option at EUR ${shippingAmount}`
    )
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: STANDARD_SHIPPING_OPTION_NAME,
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Standard delivery in Greece",
            code: "standard-gr",
          },
          prices: [
            {
              currency_code: "eur",
              amount: shippingAmount,
            },
            {
              region_id: region.id,
              amount: shippingAmount,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    })
  } else if (!shippingOption) {
    logger.warn(
      "COQUETTE_STANDARD_SHIPPING_EUR is not set; fulfillment structure is ready, but no customer-facing shipping option was created"
    )
  }

  logger.info(
    `COQUETTE staging commerce bootstrap complete: region=${region.id}, sales_channel=${salesChannel.id}, stock_location=${stockLocation.id}`
  )
}
