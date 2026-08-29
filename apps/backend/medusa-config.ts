import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const redisUrl =
  process.env.COQUETTE_DISABLE_REDIS === "true" ? undefined : process.env.REDIS_URL
const redisInfrastructureModules: Array<Record<string, unknown>> = []

if (redisUrl) {
  redisInfrastructureModules.push(
    {
      resolve: "@medusajs/medusa/caching",
      options: {
        providers: [
          {
            resolve: "@medusajs/caching-redis",
            id: "caching-redis",
            is_default: true,
            options: {
              redisUrl,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl,
        jobOptions: {
          removeOnComplete: {
            age: 3600,
            count: 1000,
          },
          removeOnFail: {
            age: 3600,
            count: 1000,
          },
        },
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: {
          redisUrl,
        },
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: {
              redisUrl,
            },
          },
        ],
      },
    }
  )
}

const hasS3Configuration = Boolean(
  process.env.S3_FILE_URL &&
    process.env.S3_ENDPOINT &&
    process.env.S3_REGION &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
)

const s3FileModule = hasS3Configuration
  ? [
      {
        resolve: "@medusajs/medusa/file",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/file-s3",
              id: "s3",
              options: {
                file_url: process.env.S3_FILE_URL,
                access_key_id: process.env.S3_ACCESS_KEY_ID,
                secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                region: process.env.S3_REGION,
                bucket: process.env.S3_BUCKET,
                endpoint: process.env.S3_ENDPOINT,
                additional_client_config: {
                  forcePathStyle: true,
                },
              },
            },
          ],
        },
      },
    ]
  : []

const paymentProviders: Array<Record<string, unknown>> = []

if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  paymentProviders.push({
    resolve: "./src/modules/paypal",
    id: "paypal",
    options: {
      client_id: process.env.PAYPAL_CLIENT_ID,
      client_secret: process.env.PAYPAL_CLIENT_SECRET,
      environment:
        process.env.PAYPAL_ENVIRONMENT === "production"
          ? "production"
          : "sandbox",
      autoCapture: process.env.PAYPAL_AUTO_CAPTURE === "true",
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      brand_name: process.env.PAYPAL_BRAND_NAME || "COQUETTE",
    },
  })
}

if (
  process.env.KLARNA_USERNAME &&
  process.env.KLARNA_PASSWORD &&
  process.env.KLARNA_CALLBACK_BASE_URL &&
  process.env.KLARNA_CALLBACK_SECRET
) {
  paymentProviders.push({
    resolve: "./src/modules/klarna",
    id: "klarna",
    options: {
      username: process.env.KLARNA_USERNAME,
      password: process.env.KLARNA_PASSWORD,
      environment:
        process.env.KLARNA_ENVIRONMENT === "production"
          ? "production"
          : "playground",
      api_region:
        process.env.KLARNA_API_REGION === "na" ||
        process.env.KLARNA_API_REGION === "oc"
          ? process.env.KLARNA_API_REGION
          : "eu",
      callback_base_url: process.env.KLARNA_CALLBACK_BASE_URL,
      callback_secret: process.env.KLARNA_CALLBACK_SECRET,
      purchase_country: process.env.KLARNA_PURCHASE_COUNTRY || "GR",
      locale: process.env.KLARNA_LOCALE || "el-GR",
    },
  })
}

const paymentModule = paymentProviders.length
  ? [
      {
        resolve: "@medusajs/medusa/payment",
        options: {
          providers: paymentProviders,
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    workerMode:
      (process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server") ||
      "shared",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },
  featureFlags: {
    translation: true,
    caching: Boolean(redisUrl),
  },
  modules: [
    ...redisInfrastructureModules,
    {
      resolve: "@medusajs/medusa/translation",
    },
    {
      resolve: "./src/modules/brand",
    },
    {
      resolve: "./src/modules/content",
    },
    ...paymentModule,
    ...s3FileModule,
  ],
})
