Status: done

# Issue 02: Learning Folder Tree

## What to build

Let a signed-in learner organize a personal Learning Library as a tree of Learning Folders on the website. They can create nested folders, rename them, move them within the tree, and browse the resulting structure. Folder creation happens on the website only. Follow the visual direction established in Issue 01 and use `ui-ux-pro-max` for the tree interaction and responsive layout.

## Acceptance criteria

- [x] The learner can create, rename, move, and browse nested Learning Folders, including an initially empty library.
- [x] A folder cannot be moved into itself or its descendants, and one learner cannot access another learner's folders.
- [x] The tree works with mouse and keyboard at desktop and narrow mobile widths, with clear empty, loading, and error states.
- [x] The complete web, API, and persistence flow is covered by meaningful tests; TypeScript and typed Python requirements from Issue 01 continue to hold.

## Blocked by

- [01-learning-account-and-extension-link.md](01-learning-account-and-extension-link.md)

## Comments

- Implemented nested folders with create/rename/move/browse UI and SQLite API. Verified Vue interaction tests, API persistence/isolation/cycle tests, and browser create/browse flow. `python web/dev.py` starts both dev services.
