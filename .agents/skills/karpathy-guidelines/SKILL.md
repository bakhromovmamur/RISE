---
name: karpathy-guidelines
description: Apply Karpathy-inspired coding discipline in Codex when implementing, debugging, refactoring, or reviewing code. Surface material assumptions, prefer simple complete solutions, make focused changes, and verify observable outcomes. Use for coding work or an explicit request for these guidelines; do not trigger solely for general conversation, product planning, or document editing.
license: MIT
---

# Karpathy Guidelines for Codex

Apply these four principles to reduce common coding mistakes. Scale the process to the task: a small fix needs a small investigation and a relevant check, not a ceremony.

Follow the user's current request and higher-priority instructions. Read applicable `AGENTS.md` files and the affected code before changing it; these guidelines supplement the project's requirements rather than replacing them.

## 1. Think Before Coding

**Make important assumptions and tradeoffs visible.**

- Inspect the existing implementation, relevant tests and documentation before proposing a solution. Separate observed behavior from intended behavior.
- State assumptions that materially affect scope, correctness, privacy or compatibility. Use repository evidence to resolve questions first.
- Choose a reasonable approach for routine reversible decisions and continue. Ask a focused question only when unresolved ambiguity materially changes the outcome or requires authorization that has not been given; keep independent work moving.
- If competing interpretations would produce meaningfully different results, explain the choice. Point out a simpler approach when it meets the actual requirements.
- Do not invent APIs, files, test results or platform capabilities. Verify facts that the implementation depends on.

## 2. Simplicity First

**Build the smallest complete solution to the requested problem.**

- Reuse existing patterns and dependencies. Do not add speculative features, configuration, generic layers or framework migrations.
- Introduce an abstraction when it owns meaningful behavior, protects an invariant or removes demonstrated duplication; avoid wrappers that merely forward calls.
- Handle realistic failures and untrusted input. Simplicity must not remove required validation, authorization, persistence recovery, accessibility or compatibility.
- Prefer readable, explicit code over cleverness. Optimize for comprehensibility and correctness, not a target line count.
- For RISE, preserve the existing product, visual design and domain invariants documented in `AGENTS.md` and the relevant requirements.

## 3. Surgical Changes

**Make every change traceable to the requested outcome.**

- Match the surrounding style. Avoid unrelated formatting, renaming, dependency churn, cleanup or refactoring.
- Preserve unrelated user changes and saved data. Do not reset a working directory, browser profile or database to simplify implementation or testing.
- Remove imports, variables and helpers made unused by your own changes. Leave pre-existing dead code alone unless cleanup is in scope; report unrelated issues only when useful.
- Inspect the final diff when Git is available. Otherwise compare the affected files with their starting state. Do not assume this project has a Git repository.

## 4. Goal-Driven Execution

**Define observable success, then verify it.**

For multi-step work, give a brief plan that pairs each meaningful change with evidence. Complete the authorized work instead of stopping at a proposal.

| Task | Useful evidence |
| --- | --- |
| Add validation | Valid inputs succeed; invalid inputs are rejected at the boundary with useful errors |
| Fix a bug | Reproduce the failure, apply the fix and check the same scenario; add a regression test when it protects meaningful behavior |
| Refactor | Relevant behavior checks pass before and after, including affected failure cases |
| Change state or persistence | Verify domain invariants, duplicate actions, migrations and recovery cases relevant to the change |
| Change an interface | Verify the affected interaction, accessibility and visual behavior with equivalent state/data |
| Edit instructions or documentation | Check syntax, links and consistency; do not add application tests that only mirror prose |

- Use the project's required checks and isolated test environments. Run the smallest meaningful set first; broaden it when risk, failures or release requirements justify it.
- Do not treat a green build, mock response or scheduled job as proof of an end-to-end outcome. Report exactly what was checked and any material limitation.
- Finish by explaining what changed, why, and what verification supports it. Update relevant project records with actual evidence, not anticipated results.

## Source and maintenance

Adapted for this project's Codex workflow on 21 October 2026 from the community-maintained [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), inspired by Andrej Karpathy's observations. This is not an official Karpathy or OpenAI skill.

Upstream baseline: [`skills/karpathy-guidelines/SKILL.md` at commit `2c606141936f1eeef17fa3043a72095b4765b9c2`](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/skills/karpathy-guidelines/SKILL.md). The upstream file declares **MIT**; that declaration is preserved for this skill and does not set the license of the RISE application.

The adaptation keeps the four original principles while making clarification, verification and repository integration appropriate for Codex and RISE. Review future upstream changes against this pinned baseline; do not overwrite local project requirements during an update.
