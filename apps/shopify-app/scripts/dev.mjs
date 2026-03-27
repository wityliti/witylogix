#!/usr/bin/env node
// Wrapper: forwards the PORT env var (injected by `shopify app dev`) to
// `react-router dev --port`, since react-router dev doesn't read process.env.PORT.
import { spawn } from 'node:child_process'

const port = process.env.PORT || 3000
const child = spawn('pnpm', ['react-router', 'dev', '--port', String(port)], {
  stdio: 'inherit',
  env: process.env,
})
child.on('exit', (code) => process.exit(code ?? 0))
