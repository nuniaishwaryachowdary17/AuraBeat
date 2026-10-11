export declare const DEFAULT_AGENT_ID: string
export declare const STATE_FILE: string
export declare const NOVA_TOOLS: ReadonlyArray<{ type: 'client'; name: string; description: string; parameters: object }>

export type NovaAgentSource = 'env' | 'saved' | 'shared' | 'created'
export interface NovaAgent {
  agentId: string
  source: NovaAgentSource
  /** True when an agent AuraBeat created earlier was updated to the latest prompt and tools. */
  updated: boolean
}

export declare class ElevenLabsError extends Error {
  /** HTTP status from ElevenLabs, or 0 when it couldn't be reached / no key. */
  status: number
  constructor(status: number, message: string)
}

export declare function agentBody(options?: { toolIds?: string[]; inlineTools?: boolean; voiceId?: string }): object
export declare function definitionHash(voiceId?: string): string

export declare function createClient(
  apiKey: string,
  base?: string,
): {
  token(agentId: string): Promise<{ token?: string }>
  [method: string]: (...args: never[]) => Promise<unknown>
}

export declare function ensureNovaAgent(options: {
  apiKey: string
  root: string
  envAgentId?: string
  voiceId?: string
  force?: boolean
  log?: (line: string) => void
}): Promise<NovaAgent>

export declare function forgetSavedAgent(root: string, agentId: string): Promise<void>
