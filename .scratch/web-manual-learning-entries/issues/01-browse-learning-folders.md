Status: done

# Issue 01: Browse Learning Folders with an Expandable Sidebar

## What to build

Let a learner browse the Learning Folder tree without showing every descendant in the sidebar at once. Initially show only root folders in the sidebar; selecting a folder opens it and reveals its immediate children underneath, with the same behavior at deeper levels. In the main view, show child folders as a grid above items directly in the selected folder, so a folder can contain both kinds of content without hiding either.

## Acceptance criteria

- [x] On initial load, the sidebar's folder list shows root Learning Folders only; selecting a folder reveals its children, and deeper levels can be expanded and collapsed without losing the selected folder.
- [x] The main view shows child folders as a grid and direct Saved Learning Items below it; a leaf folder shows its direct items, while existing items remain visible if a child folder is added later.
- [x] Folder create, rename, move, trash, breadcrumbs, and navigation still work with the new hierarchy, including after reload.
- [x] Mouse, keyboard, and narrow-screen interactions are usable, with meaningful tests using folder data through the existing web flow.

## Blocked by

None - can start immediately.

## Comments

- Implemented an expandable sidebar and child-folder grid while retaining direct items in mixed-content folders. Checked browser navigation at desktop and 390px viewport, plus the Vue folder interaction tests and production build.
