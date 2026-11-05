Status: done

# Issue 05: Manage Saved Learning Items on the Website

## What to build

Let a learner inspect and correct Saved Learning Items on the website without creating new items there. They can edit Chinese text and meaning, correct the Learning Category, and move an item to another Learning Folder. Pinyin must reflect the current Chinese text. Keep the user-approved distinction between duplicates within one folder and separate items across folders. Use `ui-ux-pro-max` guidance for editing states and responsive library views.

## Acceptance criteria

- [x] A learner can edit text, meaning, and category, move an item between their own folders, and see changes after reload; the website does not offer manual item creation.
- [x] Pinyin updates when Chinese text changes, and category or folder changes cannot silently create a Duplicate Learning Item in the destination folder.
- [x] The same Chinese text may remain as distinct items in different folders, and account boundaries prevent cross-account edits.
- [x] Editing, move, collision, and Pinyin behavior have meaningful tests; interfaces remain usable by keyboard and on narrow screens.

## Blocked by

- [03-save-chinese-row.md](03-save-chinese-row.md)
