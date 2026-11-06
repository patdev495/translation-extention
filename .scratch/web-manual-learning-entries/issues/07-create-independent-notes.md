Status: done

# Issue 07: Create Independent Notes in a Learning Folder

## What to build

Let a learner choose **Thêm → Ghi chú** in a Learning Folder and save a Note with a title and plain multiline body. Notes belong directly to a folder but do not participate in Learning Links, duplicate checks, or category conversion with Word or Phrase, Sentence, and Grammar entries.

## Acceptance criteria

- [x] A learner can create, view, edit, move, and trash a Note in their own Learning Folders, including from the folder's context menu and visible menu button; it appears in the direct-item list after reload.
- [x] Title and plain multiline body are required; the content retains line breaks without Markdown rendering or Pinyin.
- [x] Identical titles or bodies may be saved as separate Notes in the same folder; Notes cannot be linked or converted to another Learning Category, and other categories cannot be converted to Note.
- [x] Account isolation and meaningful UI/API persistence, validation, duplicate-exemption, and conversion tests cover the complete Note flow.

## Comments

- Added Note form and plain-text display, duplicate exemption, account-scoped editing, conversion/link guards, and same-folder restore for duplicate titles.

## Blocked by

None - can start immediately.
