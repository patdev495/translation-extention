Status: done

# Issue 06: Pending Sync for Offline Saves

## What to build

For an extension with an Account Link, accept a save when the website is unreachable, mark it as a Pending Sync Item, and deliver it to the correct Learning Library when connectivity returns. The queue must preserve the chosen folder, category, Chinese text, meaning, Pinyin, and Linked Word and Sentence relationship. A learner can see pending, completed, and failed states rather than assuming a save reached the website. Apply the existing design direction to status feedback.

## Acceptance criteria

- [x] A linked learner can save while offline, see a pending state, restart the browser, reconnect, and find the item in the intended folder on the website.
- [x] Retries are idempotent and cannot create duplicate items or split a Linked Word and Sentence pair.
- [x] Pending items stay associated with the account that initiated them and are not uploaded to a different account after a link change.
- [x] Meaningful tests cover restart, retry, account switching, and paired-item sync.

## Blocked by

- [04-save-selection-and-linked-pair.md](04-save-selection-and-linked-pair.md)

## Comments

- Persistent IndexedDB queue records account, chosen folder, category, text, meaning, and Pinyin. Chrome alarm retries pending saves; popup shows pending, completed, failed states and manual retry.
- `/api/extension/sync` stores account-scoped idempotency receipts in the same SQLite transaction as saved items and links.
