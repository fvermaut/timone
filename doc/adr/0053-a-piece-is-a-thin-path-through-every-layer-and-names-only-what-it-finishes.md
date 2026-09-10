# ADR-0053: A piece is a thin path through every layer, and names only what it finishes

- **Status:** accepted
- **Date:** 2026-09-10
- **Source:** interview of 2026-09-10 with fvermaut, driven by [timone#121](https://github.com/fvermaut/timone/issues/121), after `ivtrends` #88 stopped

## Context

`ivtrends` #86 was cut into two pieces: piece 1 the arithmetic, piece 2 the screen that shows it. Piece 1's plan file named PRD-06.R1, R2 and R3. R3 is `Verify-via: browser` and all five of its clauses describe the screen. Piece 1 builds no screen, so R3 could never pass there. The checking step ran it, four clauses across R2 and R3 failed for that one reason, and it stamped both requirements `failed` on the branch. The stamp is untrue — the work was never built there — and it is what the standing regression set and later planning read. The step then stopped and asked fvermaut to choose between building piece 2 first and re-cutting the two requirements.

The cut was legal. `process.md` stage 5 requires thin vertical slices — "schema → API → UI, not layer-by-layer" — but only of the slices **inside** a piece. One level up, the breakdown asks for size and order and nothing else: one pull request's worth, reviewable in a sitting, leaving the project working, ordered so each needs only what is above it. Nothing about shape. So the rule that would have forbidden this cut existed already and stopped one level short of where it was needed.

fvermaut's reading: the breakdown never took on the key part of how the planning stage splits work — thin vertical slices, a thin path that works end to end and is thickened afterwards.

Alternatives considered and rejected:

- **A piece may name part of a requirement.** Requirements gain numbered parts; a piece names the parts it delivers and the check runs only those. Rejected: it needs new machinery in the register, the plan file and the check, and it makes the layer cut normal rather than discouraged.
- **A backend-only piece stays, and names no requirement.** It is judged on its pull request like a chore. Rejected: you merge it with nothing checking it against a requirement, which gives up what the machinery is for.
- **A written rule and nothing that checks it.** Rejected by fvermaut: this is the same kind of instruction that was already ignored here, and [timone#36](https://github.com/fvermaut/timone/issues/36) records what that is worth.
- **Refusing the plan for a piece, after the list was approved.** Rejected: the approved list is immutable, so a refusal there has to come back to the human for a second approval — a new stop, against the direction of [ADR-0052](0052-a-run-that-enters-the-build-ends-at-its-pull-request.md).

## Decision

**A piece is a thin path through every layer the work touches, working end to end.** Stage 5's vertical-slice rule is carried up from the slices inside a piece to the pieces of an initiative, and it carries its exception with it: a wide mechanical change across the codebase is the one shape allowed to be horizontal, sequenced as expand–contract. A piece is never one layer of the product.

**A piece names only the requirements it delivers in full.** A requirement another piece has to finish is not named by this one. There is no partial claim, and prose in the plan file saying a requirement does not close here is not one — nothing reads prose.

**The list of pieces names the requirements each piece delivers.** The breakdown gains a requirement mapping per piece, so what the human approves says what each piece is answerable for, and so the mapping exists early enough to be checked by machine.

**The check runs before the human sees the list, and refuses.** When a piece names a requirement whose channel it cannot exercise — a `browser` requirement in a piece that plans no screen being the case seen here — the list is refused and re-cut before it is put in front of anyone. A bad cut is fixed by the machine and never reaches the human, so this adds no stop.

## Consequences

- Pieces get bigger. `ivtrends` #86's two pieces become one, or close to it. One pull request in flight per project (PRD-02.R10) is unchanged, so a bigger piece holds its project longer.
- The record stops carrying false failures. A requirement is stamped `failed` only after work that could have delivered it was checked and found wrong. [timone#62](https://github.com/fvermaut/timone/issues/62) records how hard a wrong `failed` is to walk back.
- What the human approves changes shape: the list of pieces now shows, per piece, which requirements it delivers.
- The check closes the layer case, not every case. It compares names against the register, so it catches a piece naming a screen requirement while planning no screen. It cannot tell that a piece will half-build a requirement for some other reason.
- **A requirement that spans a whole initiative has no single owner, and this decision does not settle it.** `ivtrends` PRD-06.R6 — that what the initiative adds meets WCAG 2.1 AA — is true of every piece that draws anything, and no one piece delivers it in full. Left open deliberately; it needs its own decision.
- Breakdowns already approved are not re-cut by this. `ivtrends` #86's list stands as approved, and #88's stopped run is settled on its own terms.
- `process.md` stage 5, the plan skill's breakdown section, the breakdown file format, and a new check must change to match; the criterion that verifies they did belongs to PRD-01.
