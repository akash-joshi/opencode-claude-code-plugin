# Deferred Checks

## Ideas

- 2026-09-06, maintainer: "maybe someday we still want to align it with plan mode of opencode maybe".
  Deferred, not scheduled. Make `permissionMode: "plan"` follow opencode's own plan/build agent
  instead of being a static provider option.

  Cheaper than it looks, and the objection that killed it the first time does not apply:
  the opencode agent is already part of the session key
  (`...::ses_...::context=["claude-code-appical","build"]`), so plan and build turns already
  run as separate `claude` processes. A Tab back to build would spawn one without the flag,
  so a coupled design is not a one-way door the way the static option is.

  What still argues against it, and what to re-check before building:
  1. `"plan"` is only a name. Users define their own agents called plan, some of which write
     plan documents into the repo, and forcing CLI plan mode would break those silently.
     Any implementation needs an explicit opt-in rather than a name match.
  2. The two disagree about how you leave. Claude Code expects an `ExitPlanMode` tool call
     that headless `--print` never offers (measured on 2.1.258, probes recorded in AGENTS.md),
     so the model searches for a tool it cannot find and narrates confusion. Re-run those
     probes first: if a newer CLI offers `ExitPlanMode` headless, this objection dies and the
     `planModeQuestion` bridge becomes reachable at the same time.
  3. It buys little for the common config. opencode's plan mode already denies its own tools,
     and `Bash`/`Edit`/`Write` are proxied by default, so the only gap it closes is Claude's
     unproxied built-ins.

  Shape if built: an explicit option (something like `planModePermission: "follow-agent"`),
  never silent coupling. Do not start this without a user asking for it.

- 2026-09-09, maintainer: "pin to appical but if limits hit switch to default is that possible?"
  Asked while designing the `dev-support` agent, which must run on the appical account for
  its per-profile MCP servers (Linear, Aikido, Sentry) but should survive that account's
  spend limit. Today it is not possible: the account is the provider, it is fixed for the
  life of the `claude` process, and a `forceModel` agent inherits whoever invoked it. When
  the limit error arrives ("You've hit your individual spend limit", resets at a stated
  time) the turn simply fails and the human restarts on the other account.

  Shape if built: an optional `fallbackAccounts: ["default"]` per agent or per provider.
  On a recognised limit error the plugin respawns the session on the next account with
  the same model, effort and cwd, and says so in the turn. Things to check first:
  1. The failover account may lack the MCP servers the run depends on; the resumed turn
     would need to re-announce its tool list, or the option should refuse to fail over when
     the tool sets differ.
  2. Session key includes the account, so a failover is a new process and loses in-process
     state; opencode's own transcript is what carries over, which is probably enough.
  3. Detection must match the CLI's limit message exactly, not any 4xx, or a transient
     error would silently move billing to another account.

## Dropped

- Dropped 2026-09-06 at the user's request: live observation of `idleProcessTimeoutMs: 900000`. The 15-minute eviction and subsequent resume remain unverified in the user's window; no test is planned.

## Backlog

- 2026-09-23: **done**, shipped in v0.26.1. Proxied tool calls reached the model as
  rejected while the tool actually ran: opencode 1.18.32 aborts the provider signal of
  every step that ends in tool calls, and the plugin read that as the operator pressing
  stop. Diagnosis and the session-status test in AGENTS.md's first runtime gotcha.

## Deferred decisions

- 2026-09-20: The maintainer chose "later" for adding the Appical MCP project block
  to `Appical.IaC`, `Cl-nica-Aurora---Player-team`, `Manager-toolkit`,
  `NOW-player-web` and `workshop-sep-2026`.
- 2026-09-20: The maintainer chose "later" for choosing a Slack authentication
  strategy. The current global server can still pay a 30-second 1Password unlock
  timeout on startup.
- 2026-09-20: The maintainer chose "later" for completing opencode's separate,
  global Linear OAuth authentication.

## Open from you

Questions the maintainer still owes an answer on. Written here the turn they are
raised, so they survive context compaction; removed when answered, done or dropped.

- 2026-09-23: global opencode plugin cleanup (maintainer's own config, not this repo).
  Done: simple-memory, gemini-auth, grok-auth and quota removed from
  `~/.config/opencode/opencode.json`, and quota from `tui.json` and `tui.jsonc`;
  backups are `*.bak-20260923-195510` beside them. simple-memory had nothing to port:
  its only call ever (2026-04-14) failed with ENOENT and no `.opencode/memory` exists.
  Still open: (1) `opencode-local-ollama`, which the maintainer asked to discuss last:
  264 replies, all 2026-03-25 to 2026-04-25, on 35B models no longer installed; the
  Ollama server is running and has a model loaded by something else right now. (2) The
  `lmstudio` provider block: 9 replies on 2026-04-26 only, and LM Studio is not
  installed. (3) Whether to delete the Google and xAI login tokens those plugins left.

## Parked

- 2026-09-23: the skill-bridge native-dedup work (expanded discovery roots,
  `bridgeSkipNativeSkills`, and the README/SKILL.md/AGENTS.md copy that goes with it)
  was parked mid-flight on branch `skill-bridge-native-dedup`, commit `50df301`, so
  master could be clean for the V2 lane. It is 9 files and roughly 830 lines, it is
  **not gated** (no typecheck, test or build run since the last edits), and AGENTS.md
  already describes it as offline-verified only with no live Claude session behind it.
  To resume: `git checkout skill-bridge-native-dedup`, run the full gate, then open a PR.
  Nothing is lost by leaving it there, but note the maintainer's local `file://` install
  builds from the working tree, so master builds no longer carry these changes.

## In progress

- 2026-09-23: opencode 2, the checks that were not possible before release. (1) Install
  by npm name: `plugins: ["@khalilgharbaoui/opencode-claude-code-plugin@0.26.0"]` failed
  with `NpmInstallFail` right after publishing, because the registry's aggregate
  packument still listed `latest: 0.24.0`; retry once it lists 0.26.0. (2) Account
  failover and the plan-mode form on V2, which need a real usage limit and a headless
  `ExitPlanMode`. (3) Permission prompts in the V2 TUI: every probe ran with `--auto`.

## Done

- 2026-09-23: opencode **V2 support**, alongside V1, from one package: PR #44, squash
  commit `ed815c9`, shipped in v0.26.0 with the account-failover false-rejection fix
  (`65379ea`). Per-feature live evidence for both majors is in `V2.md`.

- 2026-09-20: two lanes, account failover (PR #41) and small cleanup (PR #42), both
  merged and shipped in v0.24.0.
