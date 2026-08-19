# Phase 28: stage 9 folds into stage 1

> **Status:** **Complete 2026-08-19.** All five parts built; 1121 tests pass. Not live-gated — the next real request on `scratch-app` is the gate, and it costs nothing to wait for one.

> Governing decision: **[ADR-0036](../../adr/0036-feedback-is-triage-with-the-documents-open.md)** — accepted on fvermaut's ruling of 2026-08-19: *"it's just a later request, it has no reason to exist."*

## Why

Phase 27 built stage 9's daemon path, ran it live on a real ticket, and the run proved the stage was unnecessary. Its whole contribution was to redo a triage that had been done badly, by reading documents triage never opens.

So the reading moves to triage, and the stage goes.

## What changes

### 28a — the stage leaves the graph

`feedback` goes from `PIPELINE_STAGES`, from the stage table, from the prompts, and from the gate list. A `bug` routes to planning like any other work that already knows what it is. The third gate phase 27 added goes with it; the count is two again.

**Validation:** no stage in the graph is unbuilt; the gated set is `requirements` and `breakdown`; a `triage:bug` ticket reaches planning.

### 28b — triage reads before it decides

The triage prompt tells the session to open the criteria register, the PRD narrative, the delivery and verification reports and the relevant history before it classifies — and to classify on what it finds, not on the words the reporter used.

It also carries ADR-0036 D3's definitions: a complaint about a promise that was never made is a **feature**; a complaint that a document is wrong is a **chore**; only a break from a promise that is written down is a **bug**.

**Validation:** the prompt names the register, says to read before deciding, and carries the three definitions.

### 28c — the skill is retired

`.claude/skills/timone-improve/` is deleted. Every live document that routes work to it — `process.md`, `README.md`, the skills that hand off to it — is corrected. Old phase files, reports and handovers are history and are left alone.

**Validation:** no live document sends anything to stage 9.

### 28d — the intakes that are not tickets

Stage 9 also accepted a verification pass that ran out of loops, a criteria line left at `failed`, and the outcome of a check a human performed. ADR-0036 left them open.

**They are filed as tickets and triaged like anything else.** That is the rule ADR-0036 called obvious, and nothing else in the process now has a second front door. It costs a ticket; it buys one road in.

**Validation:** `process.md` says so where those hand-offs are described.

### 28e — the manual keeps up

`manual/how-the-daemon-works.md` still draws `feedback`. The drawing is what found all this, so it has to stay true.

**Validation:** no diagram or table names a stage that does not exist.
