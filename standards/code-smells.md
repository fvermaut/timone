# Standards — Code-Smell Review Reference

> **Status: Draft 2026-07-28 — awaiting approval.** Not normative until approved.
> **Tier: review reference.** Applied by `process.md` stage 8's **Standards** review to every project, and **overridden by that project's `doc/standards.md` on any conflict**. Unlike the mandatory baseline it admits project exceptions; unlike a stack entry it is not selected per project.
> **Scope: what a reviewer can see in a diff**, without running the code and without knowing the project's history. A smell is a *suspicion*, not a defect — "a certain structure in the code that suggests, sometimes screams for, refactoring" [1]. The reviewer labels it as such; the human decides.

## How to use it

- A finding names the smell, quotes the hunk, and states the signal that identified it. Report; never fix — refactoring found here is remediated through stage 9, never committed by stage 8.
- **Skip anything tooling enforces.** If ESLint, Prettier, `tsc` or the project's own config would catch it — formatting, import order, unused bindings, `any`, missing return types, a complexity ceiling, compiler-visible dead code — it is not a finding. Restating a tool's job wastes the human's attention on the one report they read by hand.
- **Silence is a valid report.** An axis that always finds something is not reviewing, it is padding.
- Judge only the diff's own lines and what they touch. Pre-existing smells the diff merely moved past belong to a later pass, not this one.

## Bloaters

| Smell | Signal in the diff | Usually indicates |
|---|---|---|
| **Long function** [1] | A new or grown function noticeably longer than its neighbours, or one whose body has a comment introducing each section | Sections that want names — extract them |
| **Long parameter list** [1] | Four or more parameters, or parameters only forwarded untouched | A missing object, or a call site doing the callee's assembly |
| **Large class / module** [1] | One file gaining responsibilities that share no reason to change | A second module hiding inside the first |
| **Primitive obsession** [1] | `string` / `number` carrying domain meaning — an id, a currency, a status — repeated across signatures | A missing value type; also a glossary term (`CONTEXT.md`) with no code counterpart |
| **Data clumps** [1] | The same three-or-more fields travelling together through several signatures | They are one concept, unnamed |

## Couplers

| Smell | Signal in the diff | Usually indicates |
|---|---|---|
| **Feature envy** [1] | A function reaching repeatedly through another object's fields to compute something | The behaviour belongs to the other object |
| **Inappropriate intimacy** [1] | Modules importing each other's internals; a one-field change that had to touch two layers | A boundary in the wrong place |
| **Message chains** [1] | `a.b().c().d()` — the caller navigating a structure it shouldn't know | A missing method on the first object |
| **Middle man** [1] | A class or module whose new methods only delegate | The indirection is no longer paying for itself |

## Change preventers

| Smell | Signal in the diff | Usually indicates |
|---|---|---|
| **Divergent change** [1] | One module changed in this diff for two unrelated reasons | It should be two modules |
| **Shotgun surgery** [1] | One behavioural change scattered as many one-to-three-line edits sharing a theme | The concept has no home; it is spread across files |

## Dispensables

| Smell | Signal in the diff | Usually indicates |
|---|---|---|
| **Duplicated code** [1] | The same block appearing a second time (tolerable) or a third (not) — the rule of three. **A repeated one-liner counts:** the same call or responsibility restated in every sibling function is a duplicated *decision*, and the copies are what the fourth sibling will forget | An extraction is now cheaper than the copies. **Exception:** test code prefers visible duplication over a homegrown DSL (see `testing.md`) |
| **Comment as deodorant** [1][3] | A comment explaining *what* the code does rather than *why* it does it | The code needs the name the comment is supplying |
| **Speculative generality** [1] | An abstraction, hook, option or parameter with exactly one caller and no requirement behind it | Stage 6's "no speculative features", surfacing at review |
| **Dead code** [1] | A branch no caller can reach, a flag never set to its other value | Removal — but only when tooling did not already flag it |

## Obscurers

Naming and clarity heuristics [3] — the ones a diff makes visible:

| Smell | Signal in the diff | Usually indicates |
|---|---|---|
| **Uncommunicative name** [3] | A name needing the body read to be understood; an abbreviation not already in the project's vocabulary | Rename before anything else — it is the cheapest fix in the table |
| **Magic number or string** [3] | A literal with domain meaning inline at its use site | A named constant, or a value type |
| **Flag parameter** [1][3] | A boolean parameter that switches what the function does | Two functions wearing one name |
| **Inconsistent vocabulary** [3] | One concept under two names within the diff, or a name contradicting `CONTEXT.md` | A glossary conflict — report it as one; the glossary is the authority |
| **Obscured intent** [3] | Deep conditional nesting where a guard clause or early return would flatten it | The happy path is buried |

## What this reference deliberately excludes

- **Anything a tool enforces** — see above; that is the library's standing discipline, not a local rule.
- **Test quality** — seams, mocking, flake posture, the three TDD anti-patterns: `testing.md` and `process.md` stages 5–6.
- **Accessibility and UI/UX** — the mandatory baseline; those are checked at stage 3 and stage 7, and a diff-level restatement here would let a reviewer believe they had covered them.
- **Architectural fit and stack idiom** — the project's `doc/standards.md` and its selected stack entries.
- **Whether the code implements the right thing** — that is the Spec axis. A missing requirement, scope creep, or a wrong-looking implementation is never a Standards finding; the two axes are reported separately and never merged.

## Sources

1. Fowler, M. & Beck, K. — *Refactoring: Improving the Design of Existing Code*, 2nd ed. (2018), ch. 3, "Bad Smells in Code"
2. Fowler, M. — *Refactoring* catalogue — <https://refactoring.com/catalog/>
3. Martin, R. C. — *Clean Code* (2008), ch. 17, "Smells and Heuristics"

Process alignment: `process.md` — stage 8 (the Standards review axis and its read list), stage 6 (refactoring identified at the delivery review, remediated via stage 9).
