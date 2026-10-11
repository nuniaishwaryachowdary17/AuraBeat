import { loadEnv, type Plugin, type Connect } from 'vite'
import { createClient, ensureNovaAgent, forgetSavedAgent, ElevenLabsError, type NovaAgent } from './nova/agent.mjs'

/**
 * Nova's server side, on the Vite dev server and on `vite preview` (what start.sh runs for the demo).
 *
 *   GET /__aurabeat/nova/token  → { token }: a short-lived WebRTC conversation token for the Nova agent.
 *   GET /__aurabeat/nova/status → { configured, ready, agentId?, source?, error? }
 *
 * The agent connects itself: with ELEVENLABS_API_KEY set, the server finds or creates Nova's agent in
 * that ElevenLabs workspace (nova/agent.mjs) as soon as it starts, so nobody has to build the agent in the
 * dashboard or paste an agent ID. ELEVENLABS_API_KEY is read only here, from the environment or
 * .env.local (no VITE_ prefix, so it never reaches the browser bundle); only tokens are returned.
 */
export function novaToken(): Plugin {
  let apiKey = ''
  let envAgentId = ''
  let voiceId = ''
  let root = process.cwd()
  let agent: Promise<NovaAgent> | null = null
  let lastError = ''
  let ready: NovaAgent | null = null
  let log: (line: string) => void = (line) => console.log(line)

  /** One provisioning at a time; a failure is remembered for /status and retried on the next request. */
  const ensure = () => {
    agent ??= ensureNovaAgent({ apiKey, root, envAgentId, voiceId, log }).then(
      (a) => {
        ready = a
        lastError = ''
        if (a.source !== 'created' && !a.updated) log(`Nova: connected to agent ${a.agentId} (${a.source})`)
        return a
      },
      (error: unknown) => {
        agent = null
        ready = null
        lastError = error instanceof Error ? error.message : String(error)
        log(`Nova: ${lastError}`)
        throw error
      },
    )
    return agent
  }

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const route = (req.url ?? '').split('?')[0]
    if (route !== '/token' && route !== '/status') return next()
    const reply = (status: number, body: object) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'GET') return reply(405, { error: 'GET only' })
    // Only pages served by this server may ask (blocks other websites in the browser).
    const origin = req.headers.origin
    if (origin && new URL(origin).host !== req.headers.host) return reply(403, { error: 'Cross-origin request refused' })

    if (route === '/status') {
      return reply(200, {
        configured: Boolean(apiKey),
        ready: Boolean(ready),
        agentId: ready?.agentId,
        source: ready?.source,
        error: lastError || undefined,
      })
    }

    if (!apiKey) return reply(503, { error: 'Nova needs an ElevenLabs API key: add ELEVENLABS_API_KEY to .env.local (or paste it into start.sh).' })
    try {
      let current = await ensure()
      const client = createClient(apiKey)
      let data: { token?: string }
      try {
        data = await client.token(current.agentId)
      } catch (error) {
        // The agent was deleted in the dashboard, or the key changed workspace: reconnect once, automatically.
        if (!(error instanceof ElevenLabsError) || ![403, 404].includes(error.status) || current.source === 'env') throw error
        await forgetSavedAgent(root, current.agentId)
        agent = null
        ready = null
        current = await ensure()
        data = await client.token(current.agentId)
      }
      if (!data.token) return reply(502, { error: 'ElevenLabs did not return a conversation token.' })
      reply(200, { token: data.token })
    } catch (error) {
      reply(502, { error: error instanceof Error ? error.message : 'Could not reach ElevenLabs' })
    }
  }

  return {
    name: 'aurabeat-nova',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      apiKey = (env.ELEVENLABS_API_KEY ?? '').trim()
      envAgentId = (env.NOVA_AGENT_ID ?? '').trim()
      voiceId = (env.NOVA_VOICE_ID ?? '').trim()
      root = config.root
      log = (line) => config.logger.info(line, { timestamp: true })
    },
    configureServer(server) {
      server.middlewares.use('/__aurabeat/nova', middleware)
      // Connect in the background as soon as the server starts, so the first "Talk to Nova" is instant.
      if (apiKey) ensure().catch(() => {})
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__aurabeat/nova', middleware)
      if (apiKey) ensure().catch(() => {})
    },
  }
}
