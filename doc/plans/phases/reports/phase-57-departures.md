# Phase 57 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-08 — timone#230, execution

**Kind:** plan step
**Agreed:** 57a adds `stage` to the test fixtures the compiler rejects, and "no assertion of those tests changes, except" the exact-arguments test of `src/daemon/container-runtime.test.ts`.
**Did instead:** two assertions of `src/daemon/session.test.ts` also changed. "hands the in-process runtime what it received before…" now expects `stage: "execution"` in its `toStrictEqual`, and "leaves the effort key out…" now expects `"stage"` in its list of keys. Both carry a `✏ 57a` marker. The phase file is amended at 57a's fixture line.
**Why:** both tests check the exact shape of a request, and a required `stage` is part of every request now, so neither could pass unchanged. Each still checks what it was written for: no `workspace` key, and no `effort` key.
