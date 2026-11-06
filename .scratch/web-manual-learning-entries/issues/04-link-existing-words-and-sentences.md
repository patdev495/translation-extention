Status: done

# Issue 04: Manage Learning Links Between Existing Words and Sentences

## What to build

Let a learner link a saved Sentence to multiple existing Words or Phrases, from either item's edit view, and remove those links later. Links may cross Learning Folders without moving either item. A manually chosen link does not require the Word or Phrase text to appear verbatim in the Sentence. Preserve the extension's existing paired-save behavior.

## Acceptance criteria

- [x] A learner can add and remove multiple Word or Phrase–Sentence Learning Links from either side, including across owned folders; links and navigation survive reload.
- [x] Removing a link leaves both items intact, and moving either item between folders does not change its links.
- [x] Manually linked text need not match verbatim; the extension's paired-save check remains intact. Cross-account and wrong-category links are rejected.
- [x] Category changes are blocked while an item has Learning Links; unlinked Word or Phrase and Sentence entries retain category correction. Meaningful tests cover these rules end to end.

## Comments

- Added account-scoped link API and edit-view controls. Verified cross-folder links, removal, navigation, and category guards with API/UI tests.

## Blocked by

- [02-create-word-or-phrase-on-web.md](02-create-word-or-phrase-on-web.md)
- [03-create-standalone-sentence-on-web.md](03-create-standalone-sentence-on-web.md)
