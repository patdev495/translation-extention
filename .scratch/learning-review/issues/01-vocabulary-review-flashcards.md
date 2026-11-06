Status: done

# Issue 01: Vocabulary Review Flashcards

## What to build

Let a signed-in learner open Learning Review from a top-level sidebar destination, choose a Review Scope, and complete a Vocabulary Review Session using Word or Phrase entries. Deliver the complete flow from persisted Vocabulary Recall Results through the website controls, including the Review Summary. Keep review state and results owned by the learner's Learning Account.

## Acceptance criteria

- [x] The sidebar opens Learning Review beside All Folders and Learning Trash. Choosing one Learning Folder includes its direct Word or Phrase entries and every descendant folder; choosing the whole Learning Library includes all active Word or Phrase entries. Empty scopes have a usable empty state.
- [x] A Review Session shuffles its eligible entries once, shows each once, and offers the three Flashcard Prompt Modes: Vietnamese meaning, Chinese text, or Pinyin on the front, with the other two revealed after flipping.
- [x] Previous and Next work throughout the session. Space advances only when focus is outside editable fields. Next or Space records remembered; Not Yet Remembered records that result and advances. Revisiting and changing a result replaces the earlier result for that entry in the same session.
- [x] Every card has an ungraded Review Scratchpad. Its text survives Previous within the same session and clears on a new session. Results already recorded survive leaving the page; unseen cards have no result.
- [x] Finishing shows a Review Summary and a way to start another shuffled session. Browser and API behavior tests cover folder descendants, the three prompt modes, navigation, account isolation, result replacement, and partial sessions.

## Blocked by

None - can start immediately.

## Comments
