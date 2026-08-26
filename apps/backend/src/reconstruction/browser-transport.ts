import { MedusaError } from "@medusajs/framework/utils"
import { access, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn, type ChildProcess } from "node:child_process"

export type BrowserTextResponse = {
  ok: boolean
  status: number
  url: string
  contentType: string
  text: string
}

type CdpMessage = {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { message?: string }
}

type PendingCall = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

type EventWaiter = {
  resolve: (params: Record<string, unknown>) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

const CHALLENGE_PATTERN = /just a moment|cf-chl|challenge-platform|challenges\.cloudflare\.com/i

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function executableExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

async function findChrome() {
  const configured = process.env.COQUETTE_CHROME_PATH
  const candidates = [
    configured,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (await executableExists(candidate)) return candidate
  }

  throw unexpected(
    "Browser capture requested but Chrome/Chromium was not found. Set COQUETTE_CHROME_PATH."
  )
}

class CdpClient {
  private readonly ws: WebSocket
  private nextId = 1
  private readonly pending = new Map<number, PendingCall>()
  private readonly waiters = new Map<string, EventWaiter[]>()
  private readonly listeners = new Map<
    string,
    Array<(params: Record<string, unknown>) => void>
  >()

  private constructor(ws: WebSocket) {
    this.ws = ws
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage

      if (typeof message.id === "number") {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) {
          pending.reject(new Error(message.error.message ?? "CDP command failed"))
        } else {
          pending.resolve(message.result)
        }
        return
      }

      if (!message.method) return
      const params = message.params ?? {}

      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(params)
      }

      const queue = this.waiters.get(message.method)
      const waiter = queue?.shift()
      if (waiter) {
        clearTimeout(waiter.timeout)
        waiter.resolve(params)
      }
    })
  }

  static async connect(url: string) {
    const ws = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("CDP WebSocket open timeout")),
        10_000
      )
      ws.addEventListener("open", () => {
        clearTimeout(timeout)
        resolve()
      })
      ws.addEventListener("error", () => {
        clearTimeout(timeout)
        reject(new Error("CDP WebSocket failed to open"))
      })
    })
    return new CdpClient(ws)
  }

  async send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {}
  ) {
    const id = this.nextId++
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
    this.ws.send(JSON.stringify({ id, method, params }))
    return (await result) as T
  }

  waitFor(method: string, timeoutMs = 30_000) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const queue = this.waiters.get(method) ?? []
        this.waiters.set(
          method,
          queue.filter((entry) => entry.resolve !== resolve)
        )
        reject(new Error(`Timed out waiting for CDP event ${method}`))
      }, timeoutMs)

      const queue = this.waiters.get(method) ?? []
      queue.push({ resolve, reject, timeout })
      this.waiters.set(method, queue)
    })
  }

  on(method: string, listener: (params: Record<string, unknown>) => void) {
    const listeners = this.listeners.get(method) ?? []
    listeners.push(listener)
    this.listeners.set(method, listeners)
    return () => {
      this.listeners.set(
        method,
        (this.listeners.get(method) ?? []).filter((entry) => entry !== listener)
      )
    }
  }

  close() {
    this.ws.close()
  }
}

type BrowserSnapshot = {
  html: string
  title: string
  url: string
  readyState: string
}

export class BrowserTransport {
  private readonly process: ChildProcess
  private readonly profileDir: string
  private readonly client: CdpClient
  private readonly userAgent: string

  private constructor(
    process: ChildProcess,
    profileDir: string,
    client: CdpClient,
    userAgent: string
  ) {
    this.process = process
    this.profileDir = profileDir
    this.client = client
    this.userAgent = userAgent
  }

  static async launch() {
    const chrome = await findChrome()
    const profileDir = await mkdtemp(join(tmpdir(), "coquette-capture-chrome-"))
    const port = Number.parseInt(
      process.env.COQUETTE_CHROME_DEBUG_PORT ?? "9222",
      10
    )
    const mode = process.env.COQUETTE_CAPTURE_BROWSER_MODE ?? "headed"

    const chromeArgs = [
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      "--remote-allow-origins=*",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--no-sandbox",
      "--window-size=1440,1200",
      "about:blank",
    ]

    let command = chrome
    let args = chromeArgs
    if (mode === "headless") {
      args = ["--headless=new", ...chromeArgs]
    } else if (!process.env.DISPLAY) {
      command = process.env.COQUETTE_XVFB_PATH ?? "/usr/bin/xvfb-run"
      args = ["-a", chrome, ...chromeArgs]
    }

    const child = spawn(command, args, {
      stdio: "ignore",
      detached: false,
      env: process.env,
    })

    const versionUrl = `http://127.0.0.1:${port}/json/version`
    let browserReady = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) {
        throw unexpected(
          `Chrome exited before CDP became ready (code ${child.exitCode})`
        )
      }
      try {
        const response = await fetch(versionUrl)
        if (response.ok) {
          browserReady = true
          break
        }
      } catch {
        // Browser is still starting.
      }
      await sleep(100)
    }

    if (!browserReady) {
      child.kill("SIGTERM")
      throw unexpected("Chrome CDP endpoint did not become ready")
    }

    const targetsResponse = await fetch(`http://127.0.0.1:${port}/json/list`)
    const targets = (await targetsResponse.json()) as Array<{
      type?: string
      webSocketDebuggerUrl?: string
    }>
    const target = targets.find(
      (entry) => entry.type === "page" && entry.webSocketDebuggerUrl
    )
    if (!target?.webSocketDebuggerUrl) {
      child.kill("SIGTERM")
      throw unexpected("Chrome did not expose a page CDP target")
    }

    const client = await CdpClient.connect(target.webSocketDebuggerUrl)
    await client.send("Page.enable")
    await client.send("Runtime.enable")
    await client.send("Network.enable")

    const navigator = await client.send<{
      result?: { value?: { userAgent?: string } }
    }>("Runtime.evaluate", {
      expression: "({ userAgent: navigator.userAgent })",
      returnByValue: true,
    })
    const userAgent =
      navigator.result?.value?.userAgent ??
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome Safari/537.36"

    return new BrowserTransport(child, profileDir, client, userAgent)
  }

  private async snapshot(): Promise<BrowserSnapshot> {
    const evaluation = await this.client.send<{
      result?: { value?: BrowserSnapshot }
    }>("Runtime.evaluate", {
      expression:
        "({html:document.documentElement?document.documentElement.outerHTML:'',title:document.title||'',url:location.href,readyState:document.readyState})",
      returnByValue: true,
    })
    return (
      evaluation.result?.value ?? {
        html: "",
        title: "",
        url: "",
        readyState: "loading",
      }
    )
  }

  async fetchText(url: string): Promise<BrowserTextResponse> {
    let latestStatus = 0
    let latestMimeType = "text/html"
    let latestDocumentUrl = url

    const removeResponseListener = this.client.on(
      "Network.responseReceived",
      (params) => {
        if (params.type !== "Document") return
        const response = params.response as
          | { status?: number; mimeType?: string; url?: string }
          | undefined
        if (!response) return
        latestStatus = response.status ?? latestStatus
        latestMimeType = response.mimeType ?? latestMimeType
        latestDocumentUrl = response.url ?? latestDocumentUrl
      }
    )

    const load = this.client
      .waitFor("Page.loadEventFired", 45_000)
      .catch(() => undefined)
    await this.client.send("Page.navigate", { url })
    await load

    const challengeTimeoutMs = Number.parseInt(
      process.env.COQUETTE_CAPTURE_CHALLENGE_TIMEOUT_MS ?? "30000",
      10
    )
    const started = Date.now()
    let snapshot = await this.snapshot()

    while (
      CHALLENGE_PATTERN.test(`${snapshot.title}\n${snapshot.html}`) &&
      Date.now() - started < challengeTimeoutMs
    ) {
      await sleep(750)
      snapshot = await this.snapshot()
    }

    if (!CHALLENGE_PATTERN.test(`${snapshot.title}\n${snapshot.html}`)) {
      await sleep(350)
      snapshot = await this.snapshot()
    }

    removeResponseListener()

    const challenged = CHALLENGE_PATTERN.test(
      `${snapshot.title}\n${snapshot.html}`
    )
    const status = challenged ? latestStatus || 403 : latestStatus || 200

    return {
      ok: status >= 200 && status < 400 && !challenged,
      status,
      url: snapshot.url || latestDocumentUrl,
      contentType: latestMimeType || "text/html",
      text: snapshot.html,
    }
  }

  async requestHeaders() {
    const cookieResult = await this.client.send<{
      cookies?: Array<{ name?: string; value?: string; domain?: string }>
    }>("Network.getAllCookies")
    const cookies = (cookieResult.cookies ?? [])
      .filter((cookie) => cookie.name && cookie.value)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ")

    return {
      "user-agent": this.userAgent,
      ...(cookies ? { cookie: cookies } : {}),
    }
  }

  async close() {
    this.client.close()
    this.process.kill("SIGTERM")

    if (this.process.exitCode === null) {
      await Promise.race([
        new Promise<void>((resolve) => {
          this.process.once("exit", () => resolve())
        }),
        sleep(2_000),
      ])
    }

    if (this.process.exitCode === null) {
      this.process.kill("SIGKILL")
      await sleep(250)
    }

    await rm(this.profileDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 150,
    }).catch(() => undefined)
  }
}
