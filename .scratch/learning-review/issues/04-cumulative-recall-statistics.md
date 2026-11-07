Status: done

# Issue 04: Cumulative Recall Statistics

## What to build

Show Recall Statistics on Learning Review using the persisted Vocabulary Recall Results and Grammar Recall Results. Let the learner see accumulated remembered and not-yet-remembered counts for the selected Review Scope, both overall and per entry.

## Acceptance criteria

- [x] Learning Review shows total remembered and not-yet-remembered counts for eligible Word or Phrase and Grammar entries, plus counts for each entry. Selecting a Learning Folder includes its descendants; selecting the whole Learning Library includes all active entries.
- [x] Counts accumulate across completed and partial Review Sessions. An entry not yet visited contributes no result, and a changed result within the same session replaces the earlier value rather than adding another attempt.
- [x] Vocabulary and Grammar results remain attached to their own Saved Learning Item, regardless of where a linked Example Sentence lives. Deleted or other-account entries do not appear in the current learner's statistics.
- [x] The overview stays accurate when the learner changes Review Scope, completes a session, or starts another one. Browser and API behavior tests cover scope filtering, per-entry counts, partial sessions, corrected results, and account isolation.

## Blocked by

- [Issue 01: Vocabulary Review Flashcards](01-vocabulary-review-flashcards.md)
- [Issue 02: Grammar Review Questions](02-grammar-review-questions.md)

## Comments
