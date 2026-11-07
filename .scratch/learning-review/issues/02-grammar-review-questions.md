Status: done

# Issue 02: Grammar Review Questions

## What to build

Add a Grammar Review Session to Learning Review for Grammar entries with linked Example Sentences. This slice delivers the complete question, reveal, self-assessment, and persisted Grammar Recall Result flow for sentences associated with one eligible Grammar entry; the shared-sentence case is extended in Issue 03.

## Acceptance criteria

- [x] A learner can select Grammar Review in a Review Scope. Each eligible Grammar entry contributes one randomly selected linked Example Sentence per session. Grammar entries with no Example Sentence do not enter the session; the page shows their count and a route to add an example.
- [x] Each question begins with the Chinese Sentence and hidden Pinyin. The learner can toggle Pinyin; it returns to hidden on the next question. Revealing the answer shows the Sentence's Vietnamese meaning plus the Grammar structure and description.
- [x] Next or Space before reveal skips the question without a recall result. After reveal, Next or Space records remembered. Previous permits revisiting and changing a result without adding another result for that Grammar entry in the same session.
- [x] Each question has an ungraded Review Scratchpad that survives Previous within the session and clears on a new session. Space types a space while the learner is editing.
- [x] Grammar Recall Results persist for the signed-in learner, including when the session ends early. A completed pass shows a Review Summary and can start another shuffled session. Browser and API behavior tests cover eligible and ineligible Grammar entries, answer reveal, skipping, correction, and account isolation.

## Blocked by

- [Issue 01: Vocabulary Review Flashcards](01-vocabulary-review-flashcards.md)

## Comments
