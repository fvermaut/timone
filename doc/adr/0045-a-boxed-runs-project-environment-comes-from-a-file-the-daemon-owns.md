# ADR-0045: A boxed run's project environment comes from a file the daemon owns, and the box says what it is

- **Status:** accepted
- **Date:** 2026-08-29
- **Source:** `ivtrends#33`, 2026-08-29 — a run stopped before writing a line of code and asked fvermaut to buy an AlphaVantage subscription he had already bought, and reported that no database was running while a healthy one answered on the network its own container had joined
- **Companions:** [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md), [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md)

## Context

[ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) puts every run in a container built from the remotes, and D3 stands the project's services up beside it. [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md) D1 puts the human's checkout out of reach: no fetch, no checkout, no merge, **no read**.

Together those two leave a hole nobody had named. A project's `.env` is gitignored, by every project that has one and by instruction. So the only environment a boxed run can see is the committed `.env.example`, where:

- every secret is empty, deliberately — that is what a committed template is for; and
- every address is the **host's** way to reach a service. `ivtrends` reads `postgresql://ivtrends:ivtrends@localhost:5434/ivtrends`. Inside the box, `localhost` is the box.

`ivtrends#33` met both halves on the same run. It copied `.env.example` to `.env`, as the project's own README says to, and found `ALPHAVANTAGE_API_KEY=`. It then checked for `docker` (absent by design), checked `localhost:5434` (closed, and always will be), and told fvermaut that no key and no database existed. The key was on his disk, sixteen characters, in `projects/ivtrends/.env`. The database was up and healthy on `db:5432` on the container's own network.

Neither conclusion was careless. Every check the run made was a correct check about a machine it was not on, and it had no way to learn that.

Alternatives considered:

- **Read the human's `projects/<name>/.env`.** No setup for him, and it is exactly the file [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md) D1 forbids reading. Rejected: the folder is his, and a daemon that reads it today is a daemon that cannot move to a server tomorrow.
- **Put the values in `timone.yaml`.** That file is committed. Rejected outright for secrets.
- **Have Timone work the addresses out**, by rewriting `localhost` in the template to the compose service name. Rejected: it is guessing about a project's own compose file, it silently rewrites values a human wrote, and it fixes only the addresses — the secrets remain empty.
- **Leave it, and let each run ask.** What happens today. Rejected: the run asked for something already bought, which is the worst possible version of asking.

## Decision

### D1 — One file per project, under the daemon's own state

`.timone/env/<project>.env`, in the format every project's `.env` already uses: `NAME=value`, one per line, `#` comments, blank lines ignored. It holds what a boxed run needs and the repository cannot carry: the real secrets, and the addresses of the services standing beside the box.

`.timone/` is already the daemon's, already gitignored, and already where the forge key lives. Nothing new is invented and the human's checkout is not touched.

An absent file is not a fault. A project that needs no secret and talks to no service is an ordinary case, and gets what it gets today.

### D2 — The values reach the box by name, and are written where the project's own tooling looks

Forwarded as bare `-e NAME`, like every other secret the box is handed, so no value enters an argument vector.

Then written into `projects/<name>/.env` inside the box, **after** the committed template rather than instead of it: a shell that sources the file and dotenv both take the last assignment of a name, so these values win and everything the template declares and this file does not is still there. The file is `chmod 0600`, and `.env` is added to the clone's `.git/info/exclude` so a project that forgot to ignore it cannot have a real key committed by a run.

Setting the variables in the container's environment alone is not enough, and this is the part that is easy to get wrong: the project's own scripts run `set -a; . ./.env; set +a`, which puts the template's `localhost` addresses straight back over the top.

### D3 — A name the box sets for itself is refused, not merged

`GH_TOKEN`, `TIMONE_PROMPT`, `CLAUDE_CODE_OAUTH_TOKEN` and the rest of the box's own variables are rejected when the file is read, naming the line. A project file that set one of them would redirect the run — its identity, or its instruction — without saying so. The daemon's own values are also applied last, so the refusal is not the only thing standing between a file and a hijacked run.

A value carrying a single quote or a backslash is refused for a duller reason: the file it is written into is read both by a shell and by dotenv, and there is no escaping of either character that both read the same way.

### D4 — The box introduces itself, in the prompt, before the stage's own words

Every boxed run's prompt now opens with what the container is: where the two checkouts are, that `docker` is absent on purpose and proves nothing about what is running, which services are up and what they are called, and what was written into `.env` — by name, never by value. When something is genuinely missing, it says the missing name belongs in `.timone/env/<project>.env`.

This is the half of the fix that generalises. D1 to D3 would have given `ivtrends#33` its key and its database; D4 is what stops the next run drawing a confident wrong conclusion about something nobody thought to pass in.

## Consequences

- **A run stops asking for what the human already has.** That was the whole cost of `ivtrends#33`: a stopped phase, a ticket in front of a human, and nothing missing.
- **There is a setup step per project, and it is silent by default.** A project whose file is absent behaves exactly as before, and the daemon logs which file it read or did not find. The run itself will now name what it needs and where to put it, which is what makes the step discoverable at the moment it matters.
- **Secrets are on the host in one more place.** They are in a gitignored directory the daemon already uses for a private key, and they now enter containers that are destroyed at the end of a run. That is a real widening, accepted because the alternative is a machine that cannot do the work it was built for.
- **A preview is unchanged.** [ADR-0005](0005-docker-previews-on-own-host.md) previews still run on the committed `.env.example` and get no secret. A preview is a page a human opens; it does not need a paid feed, and giving it one would put a real key behind a URL.
- **The service names are now part of what a stack returns.** `bringUpServices` already had the list; it kept it to itself.
