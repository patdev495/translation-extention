Status: ready-for-agent

# Issue 03: Save a Chinese Row from the Translation Tooltip

## What to build

Add a save button beside whichever Translation Tooltip row contains Chinese, whether it is Source Text or a translation. With no Chinese Save Selection, the Save Choice Menu offers `1` Word or Phrase and `2` Sentence; the chosen Learning Category never comes from text length. Pressing `s` while the tooltip is open also opens the menu, and number keys choose visible options. The learner chooses an existing Learning Folder on the first save and can change it later; the last chosen folder becomes the Default Learning Folder. Save the exact Chinese row, an editable Meaning Suggestion, and its Pinyin into the account-owned Learning Library, then show the item on the website. Use the `ui-ux-pro-max` design direction for both the web view and the new tooltip flow.

## Acceptance criteria

- [ ] Button and keyboard paths open the same Save Choice Menu; `s` and number shortcuts do not fire while the learner types in an editable field, and only visible choices are actionable.
- [ ] The first save requires an existing Learning Folder; if none exists, the extension directs the learner to create one on the website. Later saves reuse the last folder but allow changing it.
- [ ] Saving works when Chinese is the original or translated row; the website shows the selected category, exact Chinese text, confirmed meaning, and Pinyin, without storing the source page or PDF address.
- [ ] An Unlinked Save Attempt only asks the learner to link through extension settings. A Duplicate Learning Item in the same folder and category is surfaced instead of silently copied, while the same text can exist separately in another folder.
- [ ] Meaningful end-to-end or integration tests cover the save and duplicate paths, with typed frontend and backend code.

## Blocked by

- [01-learning-account-and-extension-link.md](01-learning-account-and-extension-link.md)
- [02-learning-folder-tree.md](02-learning-folder-tree.md)
