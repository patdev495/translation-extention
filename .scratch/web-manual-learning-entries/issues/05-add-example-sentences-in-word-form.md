Status: done

# Issue 05: Add Multiple Example Sentences in a Word Form

## What to build

Let a learner add multiple Example Sentences while creating or editing a Word or Phrase, one after another. Each example may be an existing Sentence from any owned Learning Folder or a new Sentence with its own confirmed meaning. New examples become independent Sentence entries in the Word or Phrase's folder, and the form saves the main item, new examples, and Learning Links together.

## Acceptance criteria

- [x] The form supports repeated addition of existing or new Example Sentences; each new Sentence requires text and a confirmed nonblank meaning.
- [x] A newly entered Sentence matching one already in the same folder is reused and linked without silently replacing its meaning; a match in another folder does not get reused unless explicitly selected.
- [x] Canceling a form or failing the main item save leaves no new Sentence or partial Learning Link. A successful save persists the main item, all new Sentences, and all links together.
- [x] Existing examples remain independent items, can serve other entries, and remain after a link is removed. Meaningful tests cover multi-example persistence, reuse, and rollback.

## Comments

- Added draft examples to Word or Phrase creation and editing, with atomic API writes. Verified reuse, cross-folder selection, validation, and rollback.

## Blocked by

- [04-link-existing-words-and-sentences.md](04-link-existing-words-and-sentences.md)
