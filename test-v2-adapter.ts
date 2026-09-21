import assert from "node:assert/strict"
import { test } from "node:test"
import { defaultModels } from "./src/models.js"
import adapter, { PROVIDER_ID, settingsFromOptions } from "./src/v2.js"

const MODEL_IDS = Object.keys(defaultModels)
const HAUKU_ID = "claude-haiku-4-5"
const SONNET_ID = "claude-sonnet-4-6"

function makeCtx(options: Record<string, unknown> = {}) {
  const captured = {
    providerTransforms: [] as Array<(editor: any) => void>,
    aisdkHooks: [] as Array<{ name: string; options?: unknown }>,
    sdkCallbacks: [] as Array<(event: any) => void>,
    languageCallbacks: [] as Array<(event: any) => void>,
  }
  const ctx: any = {
    options,
    provider: {
      transform: async (cb: (editor: any) => void) => {
        captured.providerTransforms.push(cb)
      },
    },
    aisdk: {
      hook: async (name: string, cb: (event: any) => void, options?: unknown) => {
        captured.aisdkHooks.push({ name, options })
        if (name === "sdk") captured.sdkCallbacks.push(cb)
        if (name === "language") captured.languageCallbacks.push(cb)
      },
    },
  }
  return { ctx, captured }
}

function makeEditor() {
  const added: Array<{ info: any; models: Array<any> }> = []
  const editor: any = {
    added,
    add: (input: { info: any; models: Array<any> }) => {
      added.push(input)
    },
  }
  return { editor, added }
}

test("adapter exposes a stable plugin id", () => {
  assert.equal(typeof adapter.id, "string")
  assert.ok(adapter.id.length > 0)
})

test("setup registers the claude-code provider with the full model registry", async () => {
  const { ctx, captured } = makeCtx()
  await adapter.setup(ctx)
  assert.equal(captured.providerTransforms.length, 1)

  const { editor, added } = makeEditor()
  for (const transform of captured.providerTransforms) transform(editor)
  assert.equal(added.length, 1)

  const [registration] = added
  assert.equal(registration.info.id, PROVIDER_ID)
  assert.ok(String(registration.info.name).includes("Claude Code"))
  assert.equal(registration.info.activation, "enabled")

  const registeredIds = registration.models.map((model: any) => String(model.id))
  for (const id of MODEL_IDS) assert.ok(registeredIds.includes(id), `missing model ${id}`)

  for (const model of registration.models) {
    const source = defaultModels[String(model.id)]
    assert.equal(model.name, source.name)
    assert.equal(model.limit.context, source.limit.context)
    assert.equal(model.capabilities.tools, source.capabilities.toolcall)
    assert.equal(model.status, "active")
    assert.equal(model.enabled, true)
  }
})

test("reasoning models carry variants, haiku carries none", async () => {
  const { ctx, captured } = makeCtx()
  await adapter.setup(ctx)
  const { editor, added } = makeEditor()
  for (const transform of captured.providerTransforms) transform(editor)

  const byId = new Map(added[0].models.map((model: any) => [String(model.id), model]))
  const sonnet = byId.get(SONNET_ID) as any
  const haiku = byId.get(HAUKU_ID) as any
  const sonnetVariantIds = sonnet.variants.map((variant: any) => String(variant.id))
  for (const id of ["low", "medium", "high", "xhigh", "max"]) {
    assert.ok(sonnetVariantIds.includes(id), `missing variant ${id}`)
  }
  assert.equal(haiku.variants.length, 0)
})

test("setup registers provider-scoped sdk and language hooks", async () => {
  const { ctx, captured } = makeCtx()
  await adapter.setup(ctx)
  const names = captured.aisdkHooks.map((hook) => hook.name)
  assert.ok(names.includes("sdk"))
  assert.ok(names.includes("language"))
  for (const hook of captured.aisdkHooks) {
    assert.deepEqual(hook.options, { providerID: PROVIDER_ID })
  }
})

test("sdk hook supplies a v3 language-model provider", async () => {
  const { ctx, captured } = makeCtx()
  await adapter.setup(ctx)
  assert.equal(captured.sdkCallbacks.length, 1)

  const event: any = { model: { id: HAUKU_ID }, package: "", options: {} }
  await captured.sdkCallbacks[0](event)
  assert.equal(typeof event.sdk, "function")
  assert.equal(event.sdk.specificationVersion, "v3")
  assert.equal(typeof event.sdk.languageModel, "function")
})

test("language hook supplies a v3 language model for registered models", async () => {
  const { ctx, captured } = makeCtx()
  await adapter.setup(ctx)

  const sdkEvent: any = { model: { id: HAUKU_ID }, package: "", options: {} }
  await captured.sdkCallbacks[0](sdkEvent)

  const { editor, added } = makeEditor()
  for (const transform of captured.providerTransforms) transform(editor)
  const haiku = added[0].models.find((model: any) => String(model.id) === HAUKU_ID)

  const languageEvent: any = { model: haiku, sdk: sdkEvent.sdk, options: {} }
  await captured.languageCallbacks[0](languageEvent)
  assert.equal(languageEvent.language?.specificationVersion, "v3")
})

test("settingsFromOptions passes provider settings through with defaults", () => {
  const defaults = settingsFromOptions({})
  assert.equal(defaults.skipPermissions, true)
  assert.equal(defaults.bridgeOpencodeMcp, true)

  const CLI_PATH = "/custom/bin/claude"
  const customised = settingsFromOptions({ cliPath: CLI_PATH })
  assert.equal(customised.cliPath, CLI_PATH)
})

test("package entry exports model(modelID, settings) returning a v3 language model", async () => {
  const entry = await import("./src/v2.js")
  assert.equal(typeof entry.model, "function")
  const language = await entry.model(HAUKU_ID, {})
  assert.equal(language?.specificationVersion, "v3")
})

test("registered provider info carries a loadable package reference", async () => {
  const { ctx, captured } = makeCtx()
  await adapter.setup(ctx)
  const { editor, added } = makeEditor()
  for (const transform of captured.providerTransforms) transform(editor)
  assert.equal(typeof added[0].info.package, "string")
  assert.ok(added[0].info.package.length > 0)
})

test("every registered model decodes against V2 Model.Info", async () => {
  const { Schema } = await import("effect")
  const { Model, Provider } = await import("@opencode/plugin")
  const { toV2Model } = await import("./src/v2.js")
  const providerID = PROVIDER_ID as Provider.ID
  for (const [id, source] of Object.entries(defaultModels)) {
    let failure: string | undefined
    try {
      Schema.decodeUnknownSync(Model.Info)(toV2Model(providerID, source))
    } catch (error) {
      failure = String(error).slice(0, 1500)
    }
    assert.equal(failure, undefined, `${id} failed Model.Info decode: ${failure}`)
  }
})

test("provider info decodes against V2 Provider.Info", async () => {
  const { Schema } = await import("effect")
  const { Provider } = await import("@opencode/plugin")
  const { buildProviderInfo } = await import("./src/v2.js")
  let failure: string | undefined
  try {
    Schema.decodeUnknownSync(Provider.Info)(buildProviderInfo(PROVIDER_ID as Provider.ID, {}))
  } catch (error) {
    failure = String(error).slice(0, 1500)
  }
  assert.equal(failure, undefined, `provider info failed decode: ${failure}`)
})

test("default export also exposes model for the provider-package loader", async () => {
  const entry = await import("./src/v2.js")
  const def = entry.default as unknown as Record<string, unknown>
  assert.equal(typeof def["model"], "function")
  const language = await (def["model"] as typeof entry.model)(HAUKU_ID, {})
  assert.equal(
    (language as unknown as { specificationVersion?: string }).specificationVersion,
    "v3",
  )
})

test("provider package uses the aisdk: factory contract", async () => {
  const entry = await import("./src/v2.js") as Record<string, unknown>
  const factoryName = Object.keys(entry).find(
    (key) => key.startsWith("create") && typeof entry[key] === "function",
  )
  assert.ok(factoryName, "expected a create* factory export")
  const factory = entry[factoryName] as (options: Record<string, unknown>) => {
    languageModel: (modelID: string) => unknown
  }
  const sdk = factory({ name: PROVIDER_ID })
  assert.equal(typeof sdk.languageModel, "function")
  const language = sdk.languageModel(HAUKU_ID) as { specificationVersion?: string }
  assert.equal(language?.specificationVersion, "v3")
})

test("registered provider info package carries the aisdk: prefix", async () => {
  const { ctx, captured } = makeCtx()
  await adapter.setup(ctx)
  const { editor, added } = makeEditor()
  for (const transform of captured.providerTransforms) transform(editor)
  assert.ok(String(added[0].info.package).startsWith("aisdk:"))
})
