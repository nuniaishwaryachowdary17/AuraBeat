#!/usr/bin/env node
/**
 * npm run nova:setup            find or create Nova's ElevenLabs agent and connect it to AuraBeat
 * npm run nova:setup -- --new   always create a fresh agent (ignores the saved and shared ones)
 *
 * Reads ELEVENLABS_API_KEY (and optional NOVA_AGENT_ID, NOVA_VOICE_ID) from the environment or
 * .env.local. You don't have to run this: the dev server does the same thing on its own the first
 * time someone presses "Talk to Nova". It's here to set things up (and see the result) ahead of a demo.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureNovaAgent, createClient, STATE_FILE } from './agent.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Minimal .env reader: KEY=value lines, optional quotes. The real environment wins. */
function loadEnvFiles() {
  const env = {}
  for (const name of ['.env', '.env.local']) {
    let text = ''
    try {
      text = readFileSync(path.join(root, name), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  return { ...env, ...process.env }
}

const env = loadEnvFiles()
const force = process.argv.includes('--new')
const apiKey = (env.ELEVENLABS_API_KEY ?? '').trim()

if (!apiKey) {
  console.error('No ElevenLabs API key.\n  Add  ELEVENLABS_API_KEY=...  to .env.local, or run:  ELEVENLABS_API_KEY=... npm run nova:setup')
  process.exit(1)
}

try {
  const agent = await ensureNovaAgent({
    apiKey,
    root,
    envAgentId: (env.NOVA_AGENT_ID ?? '').trim(),
    voiceId: (env.NOVA_VOICE_ID ?? '').trim(),
    force,
    log: (line) => console.log(line),
  })
  const how = {
    env: 'using NOVA_AGENT_ID from your environment (left unchanged)',
    saved: agent.updated ? 'using the agent AuraBeat created earlier (updated)' : 'using the agent AuraBeat created earlier',
    shared: "using the team's shared Nova agent (this key belongs to its workspace)",
    created: `created a new agent in your ElevenLabs workspace (saved in ${STATE_FILE})`,
  }[agent.source]
  // Prove the connection end to end: the same token request the browser's "Talk to Nova" makes.
  const { token } = await createClient(apiKey).token(agent.agentId)
  if (!token) throw new Error('ElevenLabs did not return a conversation token.')
  console.log(`Nova is connected: ${agent.agentId}\n  ${how}\n  Conversation token: OK. Open the At-home concert and tap "Talk to Nova".`)
} catch (error) {
  console.error(`Nova setup failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
