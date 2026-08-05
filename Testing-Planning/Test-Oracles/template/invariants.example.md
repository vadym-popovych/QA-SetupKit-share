<!-- Copy to <Project>/Test-Oracles/invariants.md. One line per invariant —
     script-checkable, asserted in EVERY run of every discipline that touches the area.
     Sources: business rules (owner interview), schema constraints, and PAST BUGS —
     every bug is a violated invariant; add one when filing. -->

# <Project> — invariants (always-true properties)

| ID | Invariant | Area | Checked by | Origin |
|----|-----------|------|------------|--------|
| INV-1 | every generated chapter has non-empty `chapterCoverUrl` | generation | k6 check + API test | BUG-003 |
| INV-2 | a book reaches `status:completed` within <N> min of creation | generation | k6 threshold | BUG-002 |
| INV-3 | `generatedChapters` ≤ `totalChapters`, never decreases | generation | API assertion | schema |
| INV-4 | user B gets 403/404 on user A's `GET /books/:id` | access control | Security-Testing matrix | business rule |
| INV-5 | account never exceeds 4 active book slots — 5th create → 409 | limits | API test | business rule |
| INV-6 | unlock count ≤ monthly limit; over-limit unlock → 402 | billing | API test | business rule |
| INV-7 | every API response validates against its schema | contract | API-Testing suite | contract |

<!-- Maintenance: new BUG-NNN filed → ask "which invariant did this violate?" —
     if none exists yet, add it here with Origin = that bug. -->
