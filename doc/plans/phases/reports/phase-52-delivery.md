# Phase 52 — Delivery Report

- **Date:** 2026-10-05
- **Phase:** [phase-52.md](../phase-52.md) — `Complete`, verified in [phase-52-verification.md](phase-52-verification.md)
- **Branch:** `timone/219-the-places-setting-is-not-documented` @ `9486adc`
- **Base:** `main` — the project's default branch; the branch was cut from `main` @ `9f0786c` and is not stacked.
- **Pull request:** opened against this report, from this branch; its address is on [#219](https://github.com/fvermaut/timone/issues/219).
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line says none — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none.
- **Departures:** [`phase-52-departures.md`](phase-52-departures.md) — 4 entries.

## Scope

Un-anchored chore work (agreed 2026-10-05, the planning of #219): documentation only. `README.md` and `timone.example.yaml` now describe the `places` line of `timone.yaml`, and say that the daemon reads `timone.yaml` only when it starts. The text describes PRD-07.R2, R5 and R6; the phase claims none of them. No program file changes. The diff also carries this phase's plan, reports and `STATUS.md`.

## How to try it

### Against the preview

This project has no preview for pull requests. Use the local steps.

### On a local checkout

1. Clone this branch and set it up as `README.md` says under *Getting started*.
2. Read `README.md`, section *The runner*. The example of a project's entry has `places: 3`, and the paragraph **How many tickets build at once.** follows **The limit.** Section *Everyday commands* has the new restart sentence. You should find: the number, 2 when the line is missing, what takes a place and what does not, how the planner holds a ticket back, and how a named person lets it build.
3. Read `timone.example.yaml`. Its header lists `places` as `(optional)` after `instructors`; `pilot-app` sets `places: 3`; the comment on `internal-tools` says it has the default 2.
4. Check the example file still loads through the real reader:

   ```bash
   npm run build >/dev/null
   node --input-type=module -e "
   const m = await import('./dist/manifest.js');
   const x = m.loadManifest('timone.example.yaml');
   for (const [n, c] of Object.entries(x.projects)) console.log(n, m.placesOf(c));
   "; echo "exit: $?"
   ```

   You should see `pilot-app 3`, `internal-tools 2`, `exit: 0`.
5. Run what the container could not run: the regression command written word for word in [phase-52-verification.md § Carried forward](phase-52-verification.md#carried-forward) (it starts `npm run build &&`), and `npx vitest run`. All should pass. `npm run --silent replay`, from a terminal logged in to the model, covers PRD-05.R18.

## Verification outcome

Verified in [phase-52-verification.md](phase-52-verification.md) — 0 of 2 fix loops consumed. Iteration 2 checked the corrected sentence (commit `7662438`) and found it right.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R2 | MUST | api | BLOCKED | 0 |
| PRD-05.R3 | MUST | api | BLOCKED | 0 |
| PRD-05.R4 | MUST | api | BLOCKED | 0 |
| PRD-05.R5 | MUST | api | BLOCKED | 0 |
| PRD-05.R7 | MUST | api | BLOCKED | 0 |
| PRD-05.R10 | MUST | api | BLOCKED | 0 |
| PRD-05.R11 | MUST | api | BLOCKED | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |

The check of the words against the requirements passed. Two statements no requirement covers were not checked: the planner takes no place, and a change to `timone.yaml` needs a restart.

### Outstanding for the human

- [ ] PRD-05.R2, R3, R4, R5, R7, R10, R11 — not run: each builds a test repository and pushes to `main` inside it, and this container refuses those pushes (timone#220). Run the regression command in [phase-52-verification.md § Carried forward](phase-52-verification.md#carried-forward) outside the container.
- [ ] PRD-05.R18 — not run: it needs the replay, which needs a logged-in terminal. Run `npm run --silent replay`.
- [ ] 70 of 1908 tests — not run to a pass: they push to `main` in temporary repositories and fail on the same refusal (timone#220). They fail the same way without this change, and none of them reads the two changed files. Run `npx vitest run` outside the container.

## Standards review — phase 52

- **Read:** `git diff origin/main...HEAD -- README.md timone.example.yaml`; `README.md` lines 55–115 and its link lines; `timone.example.yaml` lines 1–40 and 70–110, plus a check of line widths; `/workspace/timone/standards/code-smells.md`; `package.json` scripts; `tsconfig.json`. The project has no `doc/standards.md`, so `code-smells.md` and the timone writing rule are the only references. The tools (`tsc`, `vitest`) do not check Markdown or YAML comments, so nothing in the review subject was skipped because a tool covers it.
- **Diff:** `origin/main...9486adc` — 8 files, +609/−2 (review subject: README.md, timone.example.yaml)
- **Findings:** 3

### 1. "Build" is used for every step and also for one step — Inconsistent vocabulary

- **Where:** `README.md:87`, `README.md:96`
- **What:** The YAML sample comment says `# optional: how many tickets build at once`. The paragraph heading is **How many tickets build at once.** But the paragraph's own rule is "A running step takes a place, whatever the step is: a plan, a build, a check, or an update of a pull request". Later in the same paragraph, "build" means one step only: "Before a ticket's build starts … It is asked only before the build." The `timone.example.yaml` header says it more exactly: "how many of this project's tickets may have a step running at the same time".
- **Why it matters:** The diff gives one concept two names, and one of those names also means a narrower thing. A reader who goes by the heading or the sample comment will think a ticket that is only being planned or checked does not take a place.
- **Suggested remediation:** Use the YAML header's words in the heading and the sample comment, for example "How many tickets work at once" and `# optional: how many tickets have a step running at once; 2 when missing`. Keep "build" only for the build step. Not applied here.

### 2. The new paragraph is about four times longer than its neighbours and covers two subjects — Long function / Divergent change (by analogy, for prose)

- **Where:** `README.md:96`
- **What:** The other bold-lead paragraphs in the section are each 5–6 sentences ("**The limit.**", "**Who may instruct it.**", "**How you talk to it.**"). The new one has about 22 sentences. It covers the `places` setting and how places are counted and handed out. Then, from "Before a ticket's build starts, another agent, the planner, decides…", it covers a second subject: the planner holding a ticket back, the comment that names the other ticket, the second decision, and how a named person overrides it. Some pronouns in that second part have no clear subject, for example "It is decided again when that ticket's pull request merges or closes". "It" could mean the ticket or the decision.
- **Why it matters:** This README's convention is one short bold-lead paragraph per subject. The writing rule asks for short, plain sentences that are read once. A sentence with an unclear subject has to be decoded, which is what the rule forbids.
- **Suggested remediation:** Split the paragraph at "Before a ticket's build starts". Give the planner part its own bold lead, for example "**When a ticket waits for another.**". Replace the unclear "It" with "The planner decides again…". Not applied here.

### 3. The restart sentence is written three times — Duplicated code (repeated one-liner)

- **Where:** `README.md:70`, `README.md:96`, `timone.example.yaml:25–26`
- **What:** `README.md:70` adds "The daemon reads `timone.yaml` only when it starts, so a change to that file needs a restart too." `README.md:96` repeats it: "The daemon reads `timone.yaml` only when it starts, so a change to it needs a restart." The YAML header says it a third time: "The daemon reads it when it starts, so a change needs a restart."
- **Why it matters:** The smells reference counts a repeated one-liner, and three copies is past the rule of three. Two copies are in the same file, 26 lines apart. The second one is narrower: it reads as if it concerns only `places`, but the rule holds for the whole file. If the behaviour changes, a copy will be missed.
- **Suggested remediation:** Keep the general sentence at `README.md:70`, which sits in the daemon section where it belongs, and delete the copy at the end of the `places` paragraph. The YAML header copy is fine where it is, because that file is read on its own. Not applied here.

The `timone.example.yaml` changes follow the file's style. The `places` key is padded to the same column as `repo_url` and `path`, continuation lines start in column 26, and no line is over 80 characters. The example comment and the change to the minimal project's comment match the wording of the comments around them. The PRD and ADR links use the same style as the existing `[ADR-0060](doc/adr/…)` link.

## Spec review — phase 52

- **Read:** `git diff origin/main...HEAD -- README.md timone.example.yaml`; `README.md:75–97` (context); `timone.example.yaml:1–40` (header), `:71`, `:88–104`; `doc/plans/phases/phase-52.md:1–40`; `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` R2–R6; `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md` (Places, Planner, Update paragraphs and the list of changed requirements, by grep); `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` R10
- **Diff:** `origin/main...9486adc` — 8 files, +609/−2 (review subject: README.md, timone.example.yaml)
- **Findings:** 1

Everything ticket #219 asks for is there:
- the `places` line in the README example;
- the number, 1 or more, and the default of 2;
- what takes a place and what does not;
- how the planner holds a ticket back;
- how a named person makes it build anyway;
- the restart sentence;
- the `places` entry in the header of `timone.example.yaml`, written in the same style as the other optional fields.

There is no scope creep. The README paragraph also describes the `priority:high` order and the planner's timing. That rests on PRD-07.R3 and R5 and only explains the setting further. The prose agrees with PRD-07.R2 clauses 1–6, R3, R4 clause 1, R5 clauses 1, 3 and 4, R6 clauses 1–3, and PRD-05.R10 clause 2. That last clause makes the operator the named person when the project lists no `instructors`.

### 1. The comment on the README example line says "build", but a place is taken by any running step — PRD-07.R2

- **Where:** `README.md:87` (and the heading at `README.md:96`)
- **What:** The example line reads `places: 3   # optional: how many tickets build at once; 2 when missing`, and the paragraph heading is **How many tickets build at once.** PRD-07.R2 clause 3 counts "steps of N different tickets running, whatever those steps are". The paragraph body says the same correctly ("A running step takes a place, whatever the step is: a plan, a build, a check, or an update of a pull request"). The phase file's own statement table words it as "may have a step running at the same time". The `timone.example.yaml` entry also says "may have a step running". The inline comment is the line a reader copies, and on its own it suggests that only builds use a place. That would mean a ticket that is being planned or checked does not count, which R2 clause 3 says it does.
- **Why it matters:** PRD-07.R2 clause 3 (and ticket #219, which asks the text to say "what takes a place and what does not").
- **Suggested remediation:** reword the comment to `# optional: how many tickets may have a step running at once; 2 when missing`, and the heading to match, for example "How many tickets work at once." Not applied here.

## Notes

- The two reviews ran separately and are not merged. Both found the same wording point ("build" in the heading and the example comment); each reports it as it found it.
- One sentence about who can let a held-back ticket build was corrected after the first check (commit `7662438`): someone in the project's `instructors`, or the `operator` only when the project lists no `instructors`.
- The regression command is linked, not quoted, here and in the pull request. Timone's own guard asks a person before any tool call that names the folder the checks live in, and this delivery ran with nobody to answer. The command is written in full in the check report.
- Seen during the check and left as it was, because #219 does not ask for it: `timone.example.yaml` does not list `ticket_limit_usd`.
