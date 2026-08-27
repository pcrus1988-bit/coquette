# Phase 4K — Inventory Evidence Decision Matrix

This companion note makes the non-inference rule operational for review.

| Public evidence | Phase 4K outcome | Numeric quantity allowed? |
| --- | --- | --- |
| `in_stock` | `state_only` | No |
| `out_of_stock` | `state_only` | No |
| `unknown` | `unavailable` | No |
| no stock evidence | `unavailable` | No |
| low-stock wording | `state_only` | No |
| conflicting direct stock observations | `blocked` | No |
| conflicting indexed/direct stock evidence | `blocked` | No |
| exact quantity from a future authoritative variant/location source | outside Phase 4K | Only in a later independently gated quantity phase |

`state_only` is evidence accounting, not executable inventory.
