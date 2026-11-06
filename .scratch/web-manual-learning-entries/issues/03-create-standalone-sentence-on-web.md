Status: done

# Issue 03: Create a Standalone Sentence on the Website

## What to build

Let a learner choose **Thêm → Câu** from a Learning Folder's context menu or visible menu button and save a Sentence with Chinese text and a learner-confirmed meaning. A Sentence can exist without a Learning Link. The form and saved card fit the existing folder browsing and editing experience.

## Acceptance criteria

- [x] An authenticated learner can create a Sentence in an owned Learning Folder without selecting a Word or Phrase or Grammar entry, and can find it there after reload.
- [x] Chinese text and nonblank meaning are required; saved text displays Pinyin and can be corrected through the existing item editing flow.
- [x] The same complete text in the same folder and category reports a Duplicate Learning Item; matching text in another folder is allowed.
- [x] Canceling the form leaves no item, account boundaries are enforced, and meaningful UI/API persistence and validation tests cover the creation path.

## Blocked by

None - can start immediately.

## Comments

- Added the standalone Sentence form with multiline Chinese text and confirmed meaning. Verified cancellation, independent persistence without links, duplicates, ownership, Pinyin, and live local browser saving.
