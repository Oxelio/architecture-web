# Agent-aware delivery — Working Decision Log

> **Content status:** Working artifact  
> **Authority:** Non-canonical temporary workflow memory.  
> **Scope:** Agent-aware GitHub delivery governance and release workflow.  
> **Resolution state:** Closed for this governance Work.

The amended governance target was human-approved at proposal blob `c28d487bd0f6d074406fe614fea03bdddd9c56a2` and integrated into the canonical `governance.delivery` owner, `docs/project/delivery-pipeline.md`, at blob `a38ec79465307cad8c9030571e9b68678ff8c61e`.

The canonical implementation passed Governance Compliance Review and documentation Validation. This log therefore no longer carries unresolved governance authority for the completed scope.

## Final dispositions

| Working Decisions | Disposition | Durable / downstream owner |
| --- | --- | --- |
| WD-001 through WD-009 | Resolved — Integrated | `docs/project/delivery-pipeline.md` |
| WD-010 | Resolved — Superseded by WD-035 | `docs/project/delivery-pipeline.md` owns the final V1 Task-concurrency rule |
| WD-011 through WD-022 | Resolved — Integrated | `docs/project/delivery-pipeline.md` |
| WD-023 | Resolved — moved to explicit downstream Technical Design scope | Future runtime/coordinator Technical Design Work; `gh-aw + Codex` is not durable governance |
| WD-024 through WD-034 | Resolved — Integrated | `docs/project/delivery-pipeline.md` |
| WD-035 | Resolved — Integrated | `docs/project/delivery-pipeline.md` |

## External activation boundary

Resolving this Working Decision Log does **not** claim that external GitHub mechanisms are active.

The canonical governance explicitly leaves the following to separately scoped implementation/activation Works:

- `agent:*` label inventory and route mappings;
- Project fields/views and operational-owner activation;
- active Task execution-claim mechanism;
- deterministic coordinator implementation;
- privileged publisher / credential boundary;
- Work Merge Gate enforcement;
- Release Work operational mapping;
- `alpha`, `beta`, and `production` environments;
- Human Release Approval recording mechanism;
- Release Promotion Gate enforcement;
- concrete runtime adapters, including any `gh-aw` / Codex implementation choice.

## Retention

This file is no longer needed as an active decision source. Once the exploration cleanup is performed, Git history is sufficient to preserve this temporary decision trail; downstream Work should load the canonical delivery owner and its own Technical Design rather than this log.
