# TODO

## Anki

- [ ] Should we remove the pinyin from writing cards? Why/why not?
    - [ ] And from the multi character display?
- [ ] Change the end of quiz tts to read out only the character last written
- [x] Bit of a pause after finishing before transitioning to end state - maybe hold the view when one finishes the last character, let the audio finish then auto transition to back?
    - [x] This is instead of showing the characters they have been completed immediately. It's too jarring on completion the last character
    - [ ] Move the back template character displays to the same size and position of front template
    - [ ] Remove the auto turn logic, it fires on subsequent cards if I turn the card myself
- [x] Again suggested based on % of failed strokes, with failures on the first few strokes being more important. Mistake text could change colour (start green, go orange then red) when mistakes happen?
    - [x] Factor in long multi character words
    - [x] Match colours to Anki good/hard/again
    - [x] Green > orange > red (blue excluded — reserved for Anki "easy" rating)
    - [ ] Add it to the back template
    - [ ] Persist mistake text to the back template
    - [x] Start with "no mistakes for this quiz" and green, to prevent jarring when a mistake is made
    - [ ] Character mistakes section doesn't show consistently for a given character
    - [x] If the "show next stroke" hint button is pressed on the first stroke, immediately go red
- [ ] Strip out Chinese characters from the single character definition portion of the multi character display
- [ ] Is there a way to translate the per character hints that are loaded from json files that are in English into Chinese?
