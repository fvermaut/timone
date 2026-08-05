# Phase 12 — completion report

- **Date:** 2026-08-05
- **Plan:** [phase-12.md](../phase-12.md), approved for execution by fvermaut 2026-08-03
- **Requirements delivered:** PRD-02 **R3, R4, R5, R13, R14** → `verified`. R13 closed on 2026-08-05 when fvermaut ran its last clause; see 12g step 5.
- **Tests:** 318 green. `type-check` clean.

## What it does now

A ticket carrying the `timone` label goes from raw text to a plan approved and waiting to be built, without anyone naming a stage or a skill. Triage classifies it; a feature opens a conversation in the human's own terminal; the requirements and then the plan are each committed on a work branch and gated on a ticket reply; an approval is written back into the artifact as its stamp. No session is held open across a wait — each resumption is a fresh session rebuilding itself from the artifacts and the thread.

## Sub-phase outcomes

| # | Deliverable | Commit | Notes |
|---|---|---|---|
| 12a | Gate decisions read off the thread | `861135d` | Judged by shape, never by sentiment |
| 12b | Pipeline state machine + holds-the-project rule | `2ed535b` | Fixture projects left the manifest |
| — | `timone status` shows every waiting ticket | `00e9c0a` | Defect the 12b rule change created |
| 12c | Conversation seam + `timone takeover` | `e7eaccf` | Tests written after the code, not red-first |
| 12d | Clarification end to end | `b4f4534` | |
| — | Resume the runs phase 11 parked | `42063fb` | Without it, `#4` was stuck forever |
| 12e | The PRD gate | `cb2538e` | |
| — | Claim the branch against the real project | `51d16e4` | Broke the first live run |
| 12f | The plan gate | `195c6f7` | |
| — | Never gate over an artifact that was never written | `5c5627b` | Found by 12g |
| — | ADR-0014 and the amendments it forces | `90b1e53` | The grill's outcome |
| 12g | Live proof on `scratch-app` | — | Below |
| 12h | Docs, register flips, this report | this commit | |

## Decisions taken during the phase

- **Holds-the-project: branch-based** (fvermaut, at approval). One running session per project always; a *parked* run holds the project only once it owns a work branch. Enforced in `RunStore`, not by callers.
- **The daemon posts the gate comment, never the session that did the work.** The CTA must be worded exactly as the decision reader accepts it. A session inventing its own would eventually word it otherwise, leaving the human answering a question nothing was listening for.
- **An approval is written back into the artifact by a session of its own**, before the run advances — not appended to the next stage's prompt, because the next stage may not be built and an approval that only lands when the following stage runs disappears whenever the pipeline stops.
- **`CONVERSATION_RECORD_MARKER`** — an accepted conversation's record carries a marker line, so the daemon recognises it without matching on prose.
- **A stage the graph calls `built` but nothing can run is a lie the daemon acts on** — `requirements` and `planning` stayed `built: false` until the slices that built them landed.
- **[ADR-0014](../../adr/0014-artifact-first-gates.md): gated stages write their artifact, then gate on it.** The phase's largest decision, and it was forced by a live failure rather than foreseen. See below.

## 12g — what was actually observed

Against `projects/scratch-app`, one `--once` per step.

| Step | Outcome |
|---|---|
| 1 — R3/R14, conversation opened and concluded | **Observed.** `#6` reached clarification by itself and posted a copy-pasteable `timone takeover scratch-app#6`; fvermaut ran it, held the interview to acceptance, and the accepted summary landed on the ticket. |
| 2 — R4, change request then approval | **Observed, in that order.** A criticism re-ran the *same* stage carrying his words; `approve` then advanced it and recorded the approval on the PRD. |
| 3 — R5, the same on the phase file | **Observed after two defects were fixed.** `phase-04.md` committed `Awaiting approval`, approved, stamped `Approved for execution by fvermaut 2026-08-05T18:02:22Z`. |
| 4 — the gate trap | **Observed.** A machine comment whose first line is the bare word `approve`, posted after the open gate's cursor, moved nothing. |
| 5 — R13's interactive clause | **Observed by fvermaut.** A raw request in a fresh timone-root session routed through triage and then invoked the stage that classification pointed at, naming nothing. Carries a written limit: an interactive session leaves no artifact, so this is his report rather than an inspection. |
| 6 — the holds-the-project rule | **Observed, both halves.** `#4` and `#6` parked side by side while neither owned a branch; once `#6` owned one, a newly marked `#8` queued behind it and said so. `#8` was a test fixture and is closed. |

`git log --stat --all` on `scratch-app` matches no `.claude/` or `timone.yaml` path.

## What 12g found, and why it matters more than what it confirmed

**The plan gate failed live, in the worst available way: it asked for approval of a plan that did not exist.** The planning session obeyed `timone-plan`'s "the human approves the breakdown **before** any file is written", wrote nothing, and reported success. The daemon, which checked only the session's exit code, posted an approval request linking a directory containing no plan. A reply of `approve` would have advanced the pipeline past a step nobody had done.

Two separate defects sat behind it:

- **The daemon opened a gate on the strength of an exit code**, never on the existence of what it was gating. Fixed: it compares the work branch's tip across the session and, when nothing was committed, fails the run and says so rather than collecting a signature on a blank. Found in the same log: the approval-recording session ran with **no guardrail baseline**, silently disarming the checks on a session that commits and pushes — also fixed.
- **Two skills contradicted PRD-02.R4/R5**, and had done since both were approved. The requirements session resolved the contradiction one way and wrote the files; the planning session resolved it the other way and wrote nothing. **The same conflict produced opposite behaviour in two consecutive sessions**, which is worse than either outcome, because it means neither was reliable.

The second was settled by grilling it rather than patching it, and became [ADR-0014](../../adr/0014-artifact-first-gates.md): every gated stage writes its artifact on a branch first, stamped unapproved, and gates on the artifact itself — one rule, both stages, both the daemon's path and a hand-run session's. The grill also surfaced a consequence nobody had considered: under write-then-gate, **requirement IDs were being burned before anything was ratified** — `scratch-app` #6's register carries `R5`–`R9` as tombstones for requirements that were never approved. The clock now starts at approval.

An asymmetry worth recording: `timone-plan` was **stricter than the spec it implements**. Stage 5's gate never stated an ordering, and `process.md` explicitly admitted `Awaiting approval` for a file existing without approval. Only stage 3's gate stated the rule outright. The two skills were not equally wrong — one was enforcing a real rule, the other had invented one.

## Deviations from the plan

- **12c's tests were written after its implementation**, not red-first. 12a, 12b, 12d, 12e and 12f followed the TDD loop; this one did not, and the report says so rather than implying otherwise.
- **Five commits fall outside the sub-phase bodies**, each a defect execution found and each recorded as a dated `✏ Refined` amendment on the plan: the `timone status` rendering, the phase-11 park resumption, the blank-project branch claim, the false gate, and ADR-0014's amendments. All are scope-*reducing* corrections under stage 5's re-approval rule, so the approval stamp stands.
- **`.timone/state.json` was hand-edited three times** during 12g: to withdraw the false gate so a stray `approve` could not advance a phantom plan, to send `#6` back for a planning re-run, and to drop the closed test fixture's queued run. There is no command for any of these, which is a real gap — a failed or mis-parked run currently has no supported way back into the pipeline.
- **A machine comment was posted deliberately** on `#6` to prove the gate trap, and a throwaway ticket `#8` filed and closed to prove queuing. Both are labelled as such in their threads.

## For the next agent

- **Interactive sessions leave no trace.** R13's second clause could only be verified from fvermaut's direct report, because an interactive run produces no ticket comment, no label and no commit. Nobody else can re-check it. The marker-as-convention question is what would fix that.
- **Phase 13 is execution → verification → PR** (R6, R7, R11). `scratch-app` #6 is parked at exactly its entry point, on branch `timone/6-typing-in-the-box-is-fiddly-on-my-phone`, with an approved PRD and an approved five-slice `phase-04.md` waiting. It is the natural first input.
- **`#4` is parked at triage** classified `triage:bug`, waiting for stage 9's daemon path, which is not built. It holds no project.
- **No supported recovery path exists for a failed run.** `register` is idempotent per ticket, so re-marking a ticket whose run ended does nothing. Worth a slice.
