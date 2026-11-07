# Personal meanings and memory notes in Hanzi breakdown

Status: done

## Goal

Let a learner record personal meanings and free-form memory notes while inspecting a Hanzi Component Breakdown, then see them again whenever the same character is opened. Keep learner content in extension-local storage and allow a JSON backup to be exported and imported.

## Agreed behavior

- A personal meaning belongs to one exact Chinese character and one Hanzi Breakdown Language. The same personal meaning appears when that character is the main character or a component of another character. Simplified and traditional forms remain separate.
- Original and personal meanings remain separate. Each displayed character or component has its own toggle between them. When a personal meaning exists, show it first on a newly opened breakdown. Editing one language does not change the other.
- A free-form memory note belongs to the character currently in view, including a component opened for deeper breakdown. Returning to the parent restores that parent's note. The note is shared across breakdown languages.
- Meanings and notes save automatically while typing, including when the breakdown closes immediately after a change. The interface indicates whether changes have been saved.
- Unknown `？` positions are not reusable components. Display the actual unmatched stroke shapes in place of the question mark. If several unknown positions exist, group all unmatched strokes into one visual for that character because the source does not map each stroke to a particular unknown position.
- The learner may write one explanation for those grouped unmatched strokes, scoped to the character currently in view. If absent, show “Chưa xác định” (or the corresponding English label in English mode). Do not claim the shape is a named character component.
- Persist learner content in extension-local storage. Provide JSON export and import for backup and transfer. Import adds content absent locally; for conflicting content, let the learner choose whether to keep the current version or use the file version before applying it.
- Review in this iteration happens by opening the breakdown again. A separate review list is outside this feature.

## Acceptance scenarios

1. Edit the Vietnamese meaning of 目 while viewing 見; open another character containing 目 and see that meaning first. Toggle only 目 to its original meaning; the other rows remain as they were.
2. Switch to English and see its independent original or personal meaning; return to Vietnamese and retain the Vietnamese edit.
3. Write a note for 見, open 目 inside it, write a different note, then return to 見 and see the first note. Reopen the tooltip and see both notes at their respective characters.
4. Edit 见 and 見 separately and retain separate content.
5. Open 伤 and see its actual unmatched strokes in one visual with “Chưa xác định” until an explanation specific to 伤 is written. Other characters with unmatched strokes do not inherit that explanation.
6. Export data to JSON and import it into another extension installation. Existing local entries absent from the file remain intact; a conflict is resolved using the learner's selected version.
7. Close the card immediately after typing and reopen it; the last entered content is present.

## Implementation notes to settle during build

- Place backup controls in the extension popup or settings, keeping the breakdown card focused on reading and editing.
- Use a versioned JSON format so future changes can be imported safely. Validate the file before applying any updates.
- When the source has no supplied meaning for an otherwise known character, allow a personal meaning while the original view remains the source's unknown state.
