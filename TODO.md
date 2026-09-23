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
  **Superseded:** built as account failover (0.24.0; the form first actually switched in
  0.26.2). The per-agent `fallbackAccounts` shape below was not built; failover is
  account-wide and asks rather than switching silently.
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

Nothing queued here; the working backlog is the vault note
`opencode-claude-code-plugin/Future Features.md`.

## Deferred decisions

- 2026-09-20: The maintainer chose "later" for adding the Appical MCP project block
  to `Appical.IaC`, `Cl-nica-Aurora---Player-team`, `Manager-toolkit`,
  `NOW-player-web` and `workshop-sep-2026`.
- 2026-09-20: The maintainer chose "later" for choosing a Slack authentication
  strategy. The current global server can still pay a 30-second 1Password unlock
  timeout on startup.
- 2026-09-20: The maintainer chose "later" for completing opencode's separate,
  global Linear OAuth authentication.
- 2026-09-23: The maintainer parked `opencode-local-ollama` ("forget the
  opencode-local-ollama we will get to it later or not because it dying"). State when
  parked: it stays in the global config and cannot collide on either major (checked
  live: opencode 2.0.11 refuses to load it and its built-in Ollama provider lists the
  same models either way; 1.x has no built-in `ollama`). Release prep sits unmerged as
  local-ollama PR #1 (`release-0.1.2`, OIDC publishing); publishing it still needs the
  npm trusted publisher added on npmjs.com. The stale `v0.1.1` GitHub release is untouched.
- 2026-09-23: global plugin cleanup, done: simple-memory, gemini-auth, grok-auth and
  quota removed from `~/.config/opencode/opencode.json` (quota also from `tui.json`
  and `tui.jsonc`, backups `*.bak-20260923-195510`), and the Google and xAI logins
  deleted from opencode's `auth.json`. The unused `lmstudio` provider block is still
  in the config; nobody asked to remove it.

## Open from you

Questions the maintainer still owes an answer on. Written here the turn they are
raised, so they survive context compaction; removed when answered, done or dropped.

- 2026-09-23: **npm's package record for this plugin stopped taking new versions after
  0.24.0.** Measured at 20:5x: the aggregate packument (what `npm install` and opencode
  read) says `latest: 0.24.0` and lists no 0.25.0 to 0.26.3, even uncached
  (`?write=true`, `_rev 82-624ecd15...`), while each version document answers 200 and
  the separate dist-tags endpoint says `latest: 0.26.3`. npm status: operational. Not a
  size limit (262 KB). So `npm install` / opencode `@latest` gets 0.24.0 (false failover
  forms, a form that cannot switch) and `@0.26.3` fails as not found. The maintainer is
  unaffected (`file://` checkout). Every publish itself succeeded. Choice pending:
  (a) the maintainer runs `npm login` then `npm dist-tag add
  @khalilgharbaoui/opencode-claude-code-plugin@0.26.3 latest`, which writes the record
  and may re-sync it; (b) open an npm support ticket with the evidence above; (c) both.
  `publish.yml` now prints `npm --version` and warns on the run when the record does
  not list the release. A support ticket is drafted locally at
  `.opencode/npm-support-ticket.md`. 23:52 local: the maintainer logged in and ran the
  `dist-tag add …@0.27.0 latest`, which was a no-op ("latest is already set to version
  0.27.0") and left the record at `_rev 83`. A real write (`dist-tag add …@0.27.0
  next`) needs the maintainer's browser 2FA (`EOTP` from a non-interactive shell), so
  it is theirs to run. Low expectation: the 0.27.0 publish itself rewrote the record
  and still dropped the versions. If the `next` write does not bring the versions back,
  submit the drafted ticket at npmjs.com/support.
- 2026-09-23: branch `disable-thinking` (local and on origin) holds an unmerged
  `disableThinking` provider option from 2026-05-29. Kept during branch cleanup because
  it is unique work. Claude Code's own `CLAUDE_CODE_DISABLE_THINKING`, which the plugin
  already respects, may make it redundant. Keep, finish, or drop?

## Parked

Nothing parked.

## In progress

- 2026-09-23: opencode 2, the checks that were not possible before release. (1) Install
  by npm name (blocked by the npm record problem under "Open from you", not by lag): `plugins: ["@khalilgharbaoui/opencode-claude-code-plugin@0.26.0"]` failed
  with `NpmInstallFail` right after publishing, because the registry's aggregate
  packument still listed `latest: 0.24.0`; retry once it lists 0.26.0. (2) Account
  failover and the plan-mode form on V2, which need a real usage limit and a headless
  `ExitPlanMode`. (3) Permission prompts in the V2 TUI: every probe ran with `--auto`.

## Done

- 2026-09-23: **done** (v0.27.0, PR #45): the parked skill-bridge work. Merged with
  master, em dashes removed, 720 tests, measured on the real machine (14 bridged, 100
  skipped as already loaded by Claude, `herdr` answered by Claude's own copy) and
  live-verified: a turn loaded `git-archeology`, reachable only through the new roots.
- 2026-09-23: **done** (v0.27.0): `conversation_reset` is announced with a note and
  clears the index-keyed stream bookkeeping. History is deliberately not replayed.
- 2026-09-23: **done**: branch cleanup (seven merged local branches, two stale remote
  ones) and the unused `lmstudio` provider block removed from the global config
  (backup `opencode.json.bak-20260923-232635`). `publish.yml` now prints its npm
  version and warns when npm does not list a fresh release.
- 2026-09-23: **done**, shipped in v0.26.1. Proxied tool calls reached the model as
  rejected while the tool actually ran: opencode 1.18.32 aborts the provider signal of
  every step that ends in tool calls, and the plugin read that as the operator pressing
  stop. Diagnosis and the session-status test in AGENTS.md's first runtime gotcha.
- 2026-09-23: **done** (v0.26.2). A proxied call waiting on an opencode permission
  prompt was rejected at the plugin's 10-minute deadline, and the late approval then
  cancelled Claude's next call ("rejected" though nobody rejected anything). The
  deadline now extends while opencode reports the session busy. AGENTS.md, second
  runtime gotcha.
- 2026-09-23: **done** (v0.26.2), reported by the maintainer as "the switch form does
  not work failed from day 1". It never switched: opencode returns the pick inside a
  sentence the parser only recognised for the plan-approval question. Also fixed: an
  answer after an opencode restart, and the answer leaking to Claude as text on the
  next turn. AGENTS.md, third runtime gotcha. Still not tried against a real limit.
- 2026-09-23: the `appical` Claude Code login expired (CLI: "Failed to authenticate:
  OAuth session expired and could not be refreshed"; `claude-appical auth status` says
  `loggedIn: false`). Every appical turn from 19:00 failed in about 40 ms; `default` is
  fine. Fixed by the maintainer the same evening: `claude-appical auth login`, and
  `auth status` now reports `loggedIn: true`, org Appical, team plan. The follow-up
  is **done** (v0.26.3): an account the CLI reports as blocked now gets a note naming
  it with the login command, and the switch form when another account exists.

- 2026-09-23: opencode **V2 support**, alongside V1, from one package: PR #44, squash
  commit `ed815c9`, shipped in v0.26.0 with the account-failover false-rejection fix
  (`65379ea`). Per-feature live evidence for both majors is in `V2.md`.

- 2026-09-20: two lanes, account failover (PR #41) and small cleanup (PR #42), both
  merged and shipped in v0.24.0.
