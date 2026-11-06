Status: done

# Issue 03: Shared Grammar Example Sentences

## What to build

Extend Grammar Review so one Example Sentence can test several Grammar entries without duplicate questions or results. Keep Review Scope based on the Grammar entry's folder, while allowing a linked Example Sentence to live in another folder.

## Acceptance criteria

- [x] A Grammar entry within the Review Scope can be tested with a linked Example Sentence from outside the selected folder tree. A Grammar entry outside the Review Scope is not included merely because its linked Sentence is inside it.
- [x] When a Sentence serves multiple eligible Grammar entries, it appears once. Every eligible Grammar entry is asked at most once in the session, even when it links to several selected Sentences.
- [x] Revealing the answer shows the structure and description of only the linked Grammar entries in the Review Scope being tested by that question. A Sentence's links outside the scope do not create answer options or results.
- [x] The learner can mark each revealed Grammar entry as Not Yet Remembered without leaving the question. Next or Space marks any remaining entries remembered and advances. Revisiting and changing one entry's result does not change another entry's result or add an extra result for the session.
- [x] Browser and API behavior tests use shared Sentences and cross-folder links to verify question deduplication, in-scope answers, separate persisted results, and account isolation.

## Blocked by

- [Issue 02: Grammar Review Questions](02-grammar-review-questions.md)

## Comments
