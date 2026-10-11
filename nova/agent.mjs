/**
 * Nova's ElevenLabs agent, provisioned automatically.
 *
 * Before: someone had to build "Nova — AuraBeat" by hand in the ElevenLabs dashboard, add the four
 * client tools with the exact names below, turn on authentication and paste the agent ID into the code.
 * With a different ElevenLabs account that agent ID simply didn't work.
 *
 * Now: give AuraBeat an ElevenLabs API key and it finds or creates the agent itself, attaches the tools,
 * turns on authentication and remembers the agent ID in `.nova-agent.json` (git-ignored, not a secret).
 * When this file's definition changes, the agent AuraBeat created is updated to match on the next start.
 *
 * Which agent is used, in order:
 *   1. NOVA_AGENT_ID (env or .env.local): always used as is, never modified.
 *   2. The agent AuraBeat created earlier (.nova-agent.json), if the key can still reach it.
 *   3. The team's shared agent (DEFAULT_AGENT_ID), if the key belongs to that ElevenLabs workspace.
 *   4. Otherwise a new agent is created in the key's workspace.
 *
 * Runs on the server only (Vite dev/preview server, or `npm run nova:setup`). The key never reaches a browser.
 * Plain .mjs so `node nova/setup.mjs` runs on any Node 20+ without a TypeScript step.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'

/** The team's original hand-made agent (Vy's ElevenLabs workspace). Not a secret. */
export const DEFAULT_AGENT_ID = 'agent_8101m4j9cbaxfgn94gc1rbscxgce'
export const STATE_FILE = '.nova-agent.json'
const AGENT_NAME = 'Nova — AuraBeat'
const TAG = 'aurabeat'

/**
 * The four client tools. Names and parameters must match src/nova/tools.ts and the
 * useConversationClientTool(...) calls in src/nova/NovaControl.tsx.
 */
export const NOVA_TOOLS = [
  {
    type: 'client',
    name: 'setConcertEnergy',
    description:
      'Change how the at-home concert stage looks and glows: calm, immersive (default) or hype. Presentation only; ' +
      'the song, its timing and the haptics never change. Use when the fan wants it more exciting, more relaxed, or back to normal.',
    expects_response: true,
    response_timeout_secs: 5,
    parameters: {
      type: 'object',
      required: ['level'],
      properties: {
        level: { type: 'string', enum: ['calm', 'immersive', 'hype'], description: 'The stage energy to show.' },
      },
    },
  },
  {
    type: 'client',
    name: 'triggerAuraMoment',
    description:
      'Play a short visual-only moment on stage: bloom (a burst of light), light-wave (the crowd lights sway for a few ' +
      'seconds) or encore (a dreamy finale look for about 12 seconds). A real GET READY / WAVE prompt always takes priority.',
    expects_response: true,
    response_timeout_secs: 5,
    parameters: {
      type: 'object',
      required: ['moment'],
      properties: {
        moment: { type: 'string', enum: ['bloom', 'light-wave', 'encore'], description: 'Which moment to play.' },
      },
    },
  },
  {
    type: 'client',
    name: 'setSensoryPreference',
    description:
      "Turn the fan's sensory settings on or off. Include only the settings to change. light = stage lighting effects, " +
      'watchHaptics = Apple Watch / phone vibration on the beat, lyrics = on-screen lyrics, reduceMotion = calmer, less moving visuals.',
    expects_response: true,
    response_timeout_secs: 5,
    parameters: {
      type: 'object',
      required: [],
      properties: {
        light: { type: 'boolean', description: 'Stage lighting effects on (true) or off (false).' },
        watchHaptics: { type: 'boolean', description: 'Beat vibration on the watch or phone on (true) or off (false).' },
        lyrics: { type: 'boolean', description: 'On-screen lyrics on (true) or off (false).' },
        reduceMotion: { type: 'boolean', description: 'Reduce motion on (true) for calmer visuals, off (false) for full motion.' },
      },
    },
  },
  {
    type: 'client',
    name: 'getConcertStatus',
    description:
      'Read the real, current state of the concert: whether it is playing, the section, position in seconds, whether a ' +
      'watch is connected, the stage energy and every sensory setting. Call it before answering questions about the concert ' +
      'or the watch; never guess.',
    expects_response: true,
    response_timeout_secs: 5,
    parameters: { type: 'object', required: [], properties: {} },
  },
]

const PROMPT = `You are Nova, the virtual performer and host of AuraBeat, a concert experience built so Deaf and
hard-of-hearing fans get the whole show through light, lyrics and haptics on an Apple Watch or phone.
The fan is watching the at-home concert of "Grateful" by NEFFEX.

How you help:
- "Make it more exciting" -> setConcertEnergy("hype"). "Calm it down" -> setConcertEnergy("calm"). "Back to normal" -> "immersive".
- Too bright or too much motion -> setSensoryPreference with reduceMotion true, or light false.
- "I'm hard of hearing, help me feel it" -> setSensoryPreference with lyrics, watchHaptics and light all true.
- "Give me an encore / a moment" -> triggerAuraMoment (bloom, light-wave or encore).
- Questions about the concert or the watch -> call getConcertStatus first and answer from what it returns.

Rules:
- You only change how the concert looks and feels. You cannot change the song, its timing, speed, lyrics or
  the GET READY / WAVE moments, and you never claim to.
- When the fan has to wave, the screen shows WAVE: encourage them to wave their wrist with the beat.
- Keep replies short and warm: one or two sentences, since the fan is watching a show. Speak plainly.
- Never invent state. If a tool returns an error, say so simply.`

const FIRST_MESSAGE = "Hey, I'm Nova. Want the show more hype, calmer, or easier to feel? Just tell me."

/** The full agent definition AuraBeat keeps in sync. `toolIds` attach tools created through the tools API. */
export function agentBody({ toolIds, inlineTools, voiceId } = {}) {
  const prompt = { prompt: PROMPT }
  if (toolIds) prompt.tool_ids = toolIds
  if (inlineTools) prompt.tools = NOVA_TOOLS
  const conversation_config = { agent: { first_message: FIRST_MESSAGE, language: 'en', prompt } }
  if (voiceId) conversation_config.tts = { voice_id: voiceId }
  return {
    name: AGENT_NAME,
    tags: [TAG],
    conversation_config,
    // The browser only ever gets a short-lived conversation token, never the key.
    platform_settings: { auth: { enable_auth: true } },
  }
}

/** Changes whenever the prompt, tools, first message or voice change, so a stale agent gets updated. */
export function definitionHash(voiceId = '') {
  return createHash('sha256').update(JSON.stringify({ PROMPT, FIRST_MESSAGE, NOVA_TOOLS, AGENT_NAME, voiceId })).digest('hex').slice(0, 16)
}

export class ElevenLabsError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Plain-language reasons, so the person running the demo knows what to fix. */
function explain(status, what) {
  if (status === 401) return `ElevenLabs rejected the API key (${what}).`
  if (status === 403) return `The ElevenLabs API key needs ElevenLabs Agents access (${what}).`
  if (status === 429) return `ElevenLabs rate or credit limit reached (${what}).`
  return `ElevenLabs returned HTTP ${status} (${what}).`
}

export function createClient(apiKey, base = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io') {
  const call = async (method, route, body, what = route) => {
    let response
    try {
      response = await fetch(`${base}${route}`, {
        method,
        headers: { 'xi-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new ElevenLabsError(0, 'Could not reach ElevenLabs. Check the internet connection.')
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new ElevenLabsError(response.status, explain(response.status, what))
    return data
  }
  return {
    getAgent: (id) => call('GET', `/v1/convai/agents/${encodeURIComponent(id)}`, undefined, 'reading the Nova agent'),
    createAgent: (body) => call('POST', '/v1/convai/agents/create', body, 'creating the Nova agent'),
    updateAgent: (id, body) => call('PATCH', `/v1/convai/agents/${encodeURIComponent(id)}`, body, 'updating the Nova agent'),
    listTools: () => call('GET', '/v1/convai/tools', undefined, 'listing agent tools'),
    createTool: (tool) => call('POST', '/v1/convai/tools', { tool_config: tool }, `creating tool ${tool.name}`),
    updateTool: (id, tool) => call('PATCH', `/v1/convai/tools/${encodeURIComponent(id)}`, { tool_config: tool }, `updating tool ${tool.name}`),
    token: (id) => call('GET', `/v1/convai/conversation/token?agent_id=${encodeURIComponent(id)}`, undefined, 'starting a Nova conversation'),
  }
}

async function readState(root) {
  try {
    const state = JSON.parse(await readFile(path.join(root, STATE_FILE), 'utf8'))
    return typeof state?.agentId === 'string' && state.agentId ? state : null
  } catch {
    return null
  }
}

async function writeState(root, state) {
  const file = path.join(root, STATE_FILE)
  await writeFile(`${file}.tmp`, JSON.stringify(state, null, 2) + '\n')
  await rename(`${file}.tmp`, file)
}

/** Creates (or reuses and updates) the four client tools by name. Returns their IDs, or null if the
 *  workspace has no tools API, in which case the deprecated inline tools are used instead. */
async function ensureTools(client, log) {
  let existing
  try {
    existing = (await client.listTools()).tools ?? []
  } catch (error) {
    if (error.status === 404 || error.status === 405) return null
    throw error
  }
  const ids = []
  for (const tool of NOVA_TOOLS) {
    const found = existing.find((t) => t?.tool_config?.type === 'client' && t.tool_config.name === tool.name)
    if (found?.id) {
      await client.updateTool(found.id, tool)
      ids.push(found.id)
    } else {
      const created = await client.createTool(tool)
      if (!created?.id) throw new ElevenLabsError(502, `ElevenLabs did not return an id for tool ${tool.name}.`)
      log(`Nova: created tool ${tool.name}`)
      ids.push(created.id)
    }
  }
  return ids
}

async function buildBody(client, voiceId, log) {
  const toolIds = await ensureTools(client, log)
  return toolIds ? agentBody({ toolIds, voiceId }) : agentBody({ inlineTools: true, voiceId })
}

/** True if this key can open the agent; false if it belongs to another workspace or was deleted. */
async function reachable(client, id) {
  try {
    await client.getAgent(id)
    return true
  } catch (error) {
    // 401 is a bad key: say so. The rest mean "not this workspace's agent" (or deleted).
    if ([400, 403, 404, 422].includes(error.status)) return false
    throw error
  }
}

/**
 * Finds or creates the Nova agent for this API key and makes sure AuraBeat is connected to it.
 * Returns { agentId, source: 'env' | 'saved' | 'shared' | 'created', updated }.
 */
export async function ensureNovaAgent({ apiKey, root, envAgentId = '', voiceId = '', force = false, log = () => {} }) {
  if (!apiKey) throw new ElevenLabsError(0, 'No ElevenLabs API key. Add ELEVENLABS_API_KEY to .env.local or paste it into start.sh.')
  const client = createClient(apiKey)
  const hash = definitionHash(voiceId)

  if (envAgentId && !force) return { agentId: envAgentId, source: 'env', updated: false }

  const saved = force ? null : await readState(root)
  if (saved && (await reachable(client, saved.agentId))) {
    if (saved.hash === hash) return { agentId: saved.agentId, source: 'saved', updated: false }
    await client.updateAgent(saved.agentId, await buildBody(client, voiceId, log))
    await writeState(root, { ...saved, hash, updatedAt: new Date().toISOString() })
    log(`Nova: updated agent ${saved.agentId} to the latest prompt and tools`)
    return { agentId: saved.agentId, source: 'saved', updated: true }
  }

  if (!force && (await reachable(client, DEFAULT_AGENT_ID))) {
    return { agentId: DEFAULT_AGENT_ID, source: 'shared', updated: false }
  }

  const created = await client.createAgent(await buildBody(client, voiceId, log))
  if (!created?.agent_id) throw new ElevenLabsError(502, 'ElevenLabs did not return an agent id.')
  await writeState(root, { agentId: created.agent_id, hash, name: AGENT_NAME, createdAt: new Date().toISOString() })
  log(`Nova: created agent ${created.agent_id} and connected it to AuraBeat`)
  return { agentId: created.agent_id, source: 'created', updated: false }
}

/** Forgets the saved agent (e.g. it was deleted in the dashboard), so the next ensure creates a new one. */
export async function forgetSavedAgent(root, agentId) {
  const saved = await readState(root)
  if (saved?.agentId === agentId) await writeState(root, { ...saved, agentId: '', hash: '' })
}
