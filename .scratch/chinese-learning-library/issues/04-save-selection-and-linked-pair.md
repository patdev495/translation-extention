Status: done

# Issue 04: Save a Chinese Selection and Linked Word and Sentence

## What to build

When the learner highlights part of the Chinese text row, preserve that Chinese Save Selection through the save interaction and offer `1` Word or Phrase, `2` Sentence, and `3` Both. Choice `1` saves the highlighted text as a Word or Phrase. Choice `2` saves its containing Sentence. Choice `3` creates two separate Saved Learning Items in the chosen folder: the highlighted Word or Phrase and its containing Sentence, linked for navigation on the website. Show a Sentence Save Preview so the learner can correct the inferred sentence, especially for OCR text without clear punctuation. Generate a Meaning Suggestion for each exact text being saved rather than reusing the translation of the entire row, and let the learner edit it. Apply `ui-ux-pro-max` guidance to selection, keyboard, preview, and linked-item states.

## Acceptance criteria

- [x] Highlighting Chinese text and using either the button or `s` retains the intended selection; `1`, `2`, and `3` map to the visible choices, while shortcuts do not interrupt typing.
- [x] Choice `1` saves the highlighted Word or Phrase; choice `2` saves its containing Sentence; choice `3` saves two distinct linked items, and the website can navigate between them.
- [x] If the selected Word or Phrase already exists in the chosen folder, saving Both can link the containing Sentence to that existing item without making a silent duplicate.
- [x] The learner can review and edit the containing sentence before a Both save; OCR or multi-sentence rows do not silently attach an incorrect sentence.
- [x] The selected text receives its own editable Meaning Suggestion and appropriate Pinyin; meaningful tests cover selection, both-item linking, and ambiguous sentence boundaries.

## Blocked by

- [03-save-chinese-row.md](03-save-chinese-row.md)
