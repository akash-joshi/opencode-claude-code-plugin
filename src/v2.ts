import { Model, Plugin, Provider } from "@opencode/plugin"
import { createClaudeCode } from "./index.js"
import { defaultModels } from "./models.js"
import type { OpenCodeModel } from "./opencode-types.js"
import type { ClaudeCodeProviderSettings } from "./types.js"

export const PROVIDER_ID = "claude-code"
const PROVIDER_NAME = "Claude Code (Default)"

/**
 * Merge plugin options over the factory defaults. Mirrors the V1 `provider`
 * options block: every key the factory understands can be set here, so a V1
 * `provider.claude-code.options` map moves across unchanged.
 */
export function settingsFromOptions(
  options: Record<string, unknown> = {},
): ClaudeCodeProviderSettings {
  return {
    ...(options as Partial<ClaudeCodeProviderSettings>),
    skipPermissions: (options.skipPermissions as boolean | undefined) ?? true,
    bridgeOpencodeMcp: (options.bridgeOpencodeMcp as boolean | undefined) ?? true,
  }
}

function modalities(flags: Record<string, boolean>): Array<string> {
  return Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([modality]) => modality)
}

/**
 * Map one V1 registry model onto a V2 Model.Info. Brands are compile-time
 * only (plain strings and numbers at runtime), so the fully-typed default
 * is spread first and the mapped fields are asserted once, in one place.
 */
export function toV2Model(providerID: Provider.ID, model: OpenCodeModel): Model.Info {
  const id = model.id as Model.ID
  const base = Model.Info.default(providerID, id)
  return {
    ...base,
    modelID: model.id as Model.Info["modelID"],
    name: model.name,
    family: model.family,
    capabilities: {
      tools: model.capabilities.toolcall,
      input: modalities(model.capabilities.input),
      output: modalities(model.capabilities.output),
    },
    limit: {
      context: model.limit.context,
      output: model.limit.output,
    },
    cost: [
      {
        input: model.cost.input,
        output: model.cost.output,
        cache: {
          read: model.cost.cache.read,
          write: model.cost.cache.write,
        },
      },
    ],
    status: model.status,
    enabled: true,
    time: { released: Date.parse(model.release_date) },
    variants: Object.entries(model.variants ?? {}).map(([variantID, settings]) => ({
      id: variantID,
      settings: settings as Record<string, unknown>,
    })),
  } as unknown as Model.Info
}

/**
 * Provider-package entrypoint. OpenCode resolves the provider's `package`
 * field, imports it, and calls `model(modelID, settings)` to build the
 * language model for a request. SDK instances are cached per settings so
 * repeated calls share one CLI session space.
 */
const sdkCache = new Map<string, ReturnType<typeof createClaudeCode>>()

export function model(modelID: string, settings: Record<string, unknown> = {}) {
  const key = JSON.stringify(settings)
  let sdk = sdkCache.get(key)
  if (!sdk) {
    sdk = createClaudeCode(settingsFromOptions(settings))
    sdkCache.set(key, sdk)
  }
  return sdk.languageModel(String(modelID))
}

export function buildProviderInfo(
  providerID: Provider.ID,
  settings: ClaudeCodeProviderSettings,
): Provider.Info {
  return {
    ...Provider.Info.empty(providerID),
    id: providerID,
    name: PROVIDER_NAME,
    activation: "enabled",
    // Self-reference: this module is the provider runtime. OpenCode
    // imports it and calls the `model(modelID, settings)` export above.
    // import.meta.url resolves to the loaded file (dist/v2.js), so the
    // fork works from any checkout path.
    package: import.meta.url,
    settings: settings as Provider.Info["settings"],
  } as unknown as Provider.Info
}

export default Plugin.define({
  id: "claude-code-v2",
  async setup(ctx) {
    const providerID = PROVIDER_ID as Provider.ID
    const settings = settingsFromOptions((ctx.options ?? {}) as Record<string, unknown>)
    const sdk = createClaudeCode(settings)

    await ctx.provider.transform((editor) => {
      editor.add({
        info: buildProviderInfo(providerID, settings),
        models: Object.values(defaultModels).map((model) => toV2Model(providerID, model)),
      })
    })

    await ctx.aisdk.hook(
      "sdk",
      (event) => {
        event.sdk = sdk
      },
      { providerID: PROVIDER_ID },
    )

    await ctx.aisdk.hook(
      "language",
      (event) => {
        const modelID = String(event.model.modelID ?? event.model.id)
        event.language = sdk.languageModel(modelID)
      },
      { providerID: PROVIDER_ID },
    )
  },
})
