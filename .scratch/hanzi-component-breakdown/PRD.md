Status: done

# PRD: Hanzi Component Breakdown

## Goal

Help a Chinese learner remember a character by inspecting all identifiable components, their meanings, and known meaning or sound roles while the character's stroke animation loops.

## Data

- Use Make Me a Hanzi `dictionary.txt` for character decomposition, dictionary radical, component definitions, pinyin, and available etymology roles. Keep the existing `pinyin-pro` transcription for words in context and `hanzi-writer-data` for stroke animation.
- Read component definitions from the same dictionary. A component may be the dictionary radical, a meaning hint, a sound hint, or simply a graphic part; do not present every component as a radical or claim that its standalone meaning explains the parent character.
- Preserve partially known decompositions. Label `？` and missing definitions as unknown, without inventing an explanation.
- The dictionary is licensed separately from the stroke graphics (LGPL-3.0-or-later versus Arphic Public License). Include the applicable notice and license when distributing the derived character data.

## Settings

- `Hanzi Component Breakdown`: on/off, default off. Off preserves the current character-click behavior.
- `Hanzi Breakdown Language`: Vietnamese/English, default Vietnamese, independent of the primary translation language. The choice applies to all explanatory text in the breakdown card; Hanzi and pinyin stay unchanged.
- English meanings come from Make Me a Hanzi. For Vietnamese, translate missing meanings on demand with the configured translation provider and cache successful results. If translation is unavailable, display the original English meaning.

## Interaction

- Clicking a character continues to toggle its looping stroke animation. If breakdowns are enabled, turning a loop on opens a separate Hanzi Breakdown Tooltip for that character. Turning that character's loop off closes its breakdown card.
- Multiple characters may keep looping, but only the most recently activated character has a visible breakdown. Activating another character updates the one breakdown card.
- The breakdown card is separate from the Translation Tooltip, can be dragged independently, and has an X. X closes only the breakdown card; the stroke loop continues. Closing the Translation Tooltip also closes the breakdown card.
- Show immediate components and their known meanings first. Selecting a component shows its own immediate components in the same card, with a way back. Components do not have separate stroke animations.

## Acceptance scenarios

- With the setting off, clicking 妈 only toggles its loop, as today.
- With the setting on, clicking 妈 starts its loop and opens a separate card showing 女 and 马 with their meanings; 女 may be marked as the dictionary radical and 马 as a sound hint when the source supports those roles.
- Clicking another character updates the card while an earlier character can keep looping. Clicking the focused character again stops its loop and closes the card.
- Clicking X leaves the focused character looping. Closing the Translation Tooltip stops its animations and closes the breakdown card.
- Selecting a component drills into it in the same card and can return to the parent character.
- An unknown component is labeled as unknown. A failed Vietnamese translation falls back to the English source meaning.

## Sources

- Make Me a Hanzi data format: https://github.com/skishore/makemeahanzi#format
- Make Me a Hanzi licenses: https://github.com/skishore/makemeahanzi/blob/master/COPYING
- Hanzi Writer Data provenance: https://github.com/chanind/hanzi-writer-data
