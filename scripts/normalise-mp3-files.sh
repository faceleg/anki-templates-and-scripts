#!/bin/zsh

# Normalise mp3 loudness with aacgain (album mode over all files in one call).
#
# brew install aacgain
# copy mp3 files out of ~/Library/Application Support/Anki2/<profile>/collection.media/*.mp3 to a working directory, consider backing them up as well.
# find . -name '*.mp3'  -exec cp "{}" working-directory \;
# cd to the working directory
# execute this file
# copy mp3 files back into the anki folder
# find . -name '*.mp3'  -exec mv "{}" ~/Library/Application Support/Anki2/<profile>/collection.media/ \;

if ! command -v aacgain >/dev/null 2>&1; then
    echo "aacgain not found on PATH. Install it with: brew install aacgain" >&2
    exit 1
fi

files=(**/*.mp3(N))
if (( ${#files} == 0 )); then
    echo "No mp3 files found under $PWD" >&2
    exit 1
fi

aacgain -a -k "${files[@]}"
