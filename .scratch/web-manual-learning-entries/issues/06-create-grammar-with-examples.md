Status: done

# Issue 06: Create Grammar Entries with Example Sentences

## What to build

Let a learner choose **Thêm → Ngữ pháp** in a Learning Folder and save a Grammar entry with a required free-form structure and description. The structure may mix Chinese and Vietnamese and has no Pinyin. Example Sentences are optional at creation and may be added later, selected from existing Sentences or entered as multiple new Sentences using the established save and link behavior.

## Acceptance criteria

- [x] Grammar appears as a distinct Learning Category in creation, folder listing, filtering, editing, moving, and trash flows; it requires structure and description and does not generate or display Pinyin for the structure.
- [x] A Grammar entry may be saved with no examples, or linked to multiple existing/new Sentences, including across folders; new examples belong to the Grammar entry's folder and have their own meanings.
- [x] A matching complete structure in the same folder is reported as a Duplicate Learning Item regardless of description or examples; the same structure in another folder is allowed.
- [x] Example creation/linking is atomic with the Grammar save, links can be edited later, and category changes obey the unlinked-only rule. Meaningful tests cover persistence, rollback, duplicates, and account isolation.

## Comments

- Added Grammar category and SQLite migration, example editing, duplicate structure checks, and blank Pinyin. Verified API/UI persistence and rollback.

## Blocked by

- [05-add-example-sentences-in-word-form.md](05-add-example-sentences-in-word-form.md)
