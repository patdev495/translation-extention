Status: done

# Issue 02: Create a Word or Phrase on the Website

## What to build

Let a learner choose **Thêm → Từ / cụm từ** from a Learning Folder's context menu or its visible menu button and save a Word or Phrase directly in that folder. The form accepts Chinese text and a learner-confirmed meaning, offers a meaning suggestion for the exact text, and leaves the learner free to correct it before saving. This slice covers a standalone Word or Phrase; Example Sentences come later.

## Acceptance criteria

- [x] An authenticated learner can create a Word or Phrase in an owned Learning Folder from both menu entry points and see it in that folder after reload; another account cannot create it there.
- [x] Chinese text and nonblank meaning are required. A meaning suggestion can be edited or replaced, and the item shows Pinyin for its saved text.
- [x] The same complete text in the same folder and category reports a Duplicate Learning Item without creating another; the same text in a different folder is allowed.
- [x] Canceling the form leaves no item, and meaningful UI/API persistence and validation tests cover the complete creation path.

## Blocked by

None - can start immediately.

## Comments

- Added account-owned website creation and a Vietnamese meaning suggestion for the exact text. The form keeps manual entry available if the suggestion service fails. Verified ownership, validation, duplicates, Pinyin, menu entry points, and live local browser saving.
