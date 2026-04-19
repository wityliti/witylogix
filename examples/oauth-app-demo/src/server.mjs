import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

loadDotEnv()

const config = {
  apiUrl: requireEnv('WITYLOGIX_API_URL'),
  clientId: requireEnv('OAUTH_CLIENT_ID'),
  clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
  appBaseUrl: requireEnv('APP_BASE_URL'),
  redirectUri: requireEnv('OAUTH_REDIRECT_URI'),
  scopes: (process.env.OAUTH_SCOPES || 'shipments:read operations:read').trim(),
  publicWebhookUrl: process.env.PUBLIC_WEBHOOK_URL || '',
  webhookSecret: process.env.WEBHOOK_SECRET || ''
}

const port = Number(new URL(config.appBaseUrl).port || 4001)

const pendingStates = new Map()
let session = null

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.appBaseUrl)
    switch (url.pathname) {
      case '/':
        return sendHome(res)
      case '/install':
        return startInstall(res)
      case '/oauth/callback':
        return handleCallback(url, res)
      case '/shipments':
        return listShipments(res)
      case '/transition':
        return transitionShipment(req, res, url)
      case '/register-webhook':
        return registerWebhook(res)
      case '/hooks/witylogix':
        return receiveWebhook(req, res)
      default:
        return respond(res, 404, 'Not found')
    }
  } catch (err) {
    console.error('request failed', err)
    respond(res, 500, `Server error: ${err.message}`)
  }
})

server.listen(port, () => {
  console.log(`Demo app listening on ${config.appBaseUrl}`)
  console.log(`Open ${config.appBaseUrl} and click "Install to Witylogix"`)
})

function sendHome (res) {
  const installed = Boolean(session?.accessToken)
  const body = `
    <html><body style="font-family: sans-serif; max-width: 600px; margin: 40px auto;">
      <h1>Witylogix OAuth App Demo</h1>
      <p>Status: <strong>${installed ? 'installed' : 'not installed'}</strong></p>
      ${installed ? '' : '<p><a href="/install">Install to Witylogix</a></p>'}
      ${installed ? `
        <ul>
          <li><a href="/shipments">List shipments (shipments:read)</a></li>
          <li><a href="/register-webhook">Register webhook endpoint</a></li>
        </ul>
        <p>To advance a shipment, POST to <code>/transition?id=SHIPMENT_ID&amp;toStage=STAGE_KEY</code>.</p>
      ` : ''}
    </body></html>`
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(body)
}

function startInstall (res) {
  const state = randomBytes(16).toString('hex')
  const codeVerifier = base64url(randomBytes(32))
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
  pendingStates.set(state, { codeVerifier, createdAt: Date.now() })

  const authorizeUrl = new URL('/api/v4/oauth/authorize', config.apiUrl)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', config.clientId)
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri)
  authorizeUrl.searchParams.set('scope', config.scopes)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')

  res.writeHead(302, { Location: authorizeUrl.toString() })
  res.end()
}

async function handleCallback (url, res) {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return respond(res, 400, 'Missing code or state')

  const pending = pendingStates.get(state)
  if (!pending) return respond(res, 400, 'Unknown state; possible CSRF')
  pendingStates.delete(state)

  const tokens = await exchangeCodeForTokens(code, pending.codeVerifier)
  session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope
  }

  res.writeHead(302, { Location: '/' })
  res.end()
}

async function exchangeCodeForTokens (code, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier
  })
  if (config.clientSecret) body.set('client_secret', config.clientSecret)

  const tokenUrl = new URL('/api/v4/oauth/token', config.apiUrl)
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${text}`)
  }
  return response.json()
}

async function ensureFreshToken () {
  if (!session) throw new Error('App is not installed yet')
  if (Date.now() < session.expiresAt - 30_000) return session.accessToken

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: config.clientId
  })
  if (config.clientSecret) body.set('client_secret', config.clientSecret)

  const tokenUrl = new URL('/api/v4/oauth/token', config.apiUrl)
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) throw new Error(`Refresh failed: ${await response.text()}`)
  const tokens = await response.json()
  session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope
  }
  return session.accessToken
}

async function apiRequest (path, init = {}) {
  const token = await ensureFreshToken()
  const url = new URL(path, config.apiUrl)
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    const err = new Error(`${response.status} ${response.statusText}`)
    err.payload = payload
    throw err
  }
  return payload
}

async function listShipments (res) {
  const data = await apiRequest('/api/v4/shipments?limit=10')
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data, null, 2))
}

async function transitionShipment (req, res, url) {
  if (req.method !== 'POST') return respond(res, 405, 'Use POST')
  const shipmentId = url.searchParams.get('id')
  const toStage = url.searchParams.get('toStage')
  if (!shipmentId || !toStage) return respond(res, 400, 'Provide ?id=...&toStage=...')

  const result = await apiRequest(
    `/api/v4/operations/shipments/${encodeURIComponent(shipmentId)}/transition`,
    { method: 'POST', body: JSON.stringify({ toStage, reason: 'demo app' }) }
  )
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result, null, 2))
}

async function registerWebhook (res) {
  if (!config.publicWebhookUrl) {
    return respond(res, 400, 'Set PUBLIC_WEBHOOK_URL to register a webhook endpoint')
  }
  const result = await apiRequest('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      url: config.publicWebhookUrl,
      events: ['shipment.stage_changed', 'order.stage_changed'],
      description: 'OAuth app demo webhook'
    })
  })
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result, null, 2))
}

async function receiveWebhook (req, res) {
  if (req.method !== 'POST') return respond(res, 405, 'Use POST')
  const raw = await readBody(req)
  if (config.webhookSecret) {
    const signature = req.headers['x-witylogix-signature']
    if (!verifySignature(raw, signature, config.webhookSecret)) {
      return respond(res, 401, 'Invalid signature')
    }
  }
  console.log('webhook received:', raw.toString('utf8'))
  res.writeHead(204)
  res.end()
}

function verifySignature (body, signatureHeader, secret) {
  if (!signatureHeader || typeof signatureHeader !== 'string') return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  const provided = signatureHeader.replace(/^sha256=/, '')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(provided, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function readBody (req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolvePromise(Buffer.concat(chunks)))
    req.on('error', rejectPromise)
  })
}

function respond (res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain' })
  res.end(message)
}

function base64url (buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function requireEnv (name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function loadDotEnv () {
  const here = dirname(fileURLToPath(import.meta.url))
  const envPath = resolve(here, '..', '.env')
  try {
    const text = readFileSync(envPath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      if (process.env[key] !== undefined) continue
      process.env[key] = trimmed.slice(eq + 1).trim()
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}
