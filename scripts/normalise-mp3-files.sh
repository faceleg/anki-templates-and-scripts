#!/bin/zsh

# brew install aacgain
# copy mp3 files out of ~/Library/Application Support/Anki2/<profile>/collection.media/*.mp3 to a working directory, consider backing them up as well.
# find . -name '*.mp3'  -exec cp "{}" working-directory \;
# cd to the working directory
# execute this file
# copy mp3 files back into the anki folder

# Find all MP3 files and process them in batches
find . -name "*.mp3" | while read -r file; do
    ./aacgain -a -k "$file"
done


