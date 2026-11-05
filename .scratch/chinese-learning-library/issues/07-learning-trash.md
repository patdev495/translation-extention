Status: ready-for-agent

# Issue 07: Learning Trash and Recovery

## What to build

Add Learning Trash to the website for a learner's individually deleted Saved Learning Items and deleted Learning Folders with their nested folders and items. The learner can review and restore trash contents, or explicitly delete an entry permanently or empty the trash. Nothing in trash expires automatically. Preserve account ownership and Linked Word and Sentence relationships through recovery where both items still exist. Use `ui-ux-pro-max` guidance for clear destructive actions and recovery feedback.

## Acceptance criteria

- [ ] Deleting one item or a folder tree removes it from the active library and places it in the learner's trash; the learner can restore it.
- [ ] Permanent deletion occurs only after an explicit user action; trash has no automatic expiry.
- [ ] Restore handles unavailable original parent folders without data loss or cross-account placement, and linked items remain navigable where both are restored.
- [ ] Meaningful tests cover nested folder recovery, individual item recovery, permanent deletion, and account isolation.

## Blocked by

- [02-learning-folder-tree.md](02-learning-folder-tree.md)
- [04-save-selection-and-linked-pair.md](04-save-selection-and-linked-pair.md)
- [05-manage-saved-learning-items.md](05-manage-saved-learning-items.md)
