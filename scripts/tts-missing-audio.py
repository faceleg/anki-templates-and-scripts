#!/usr/bin/env python3
"""Free word audio for notes tagged `needs-audio`, via edge-tts (Edge read-aloud neural voices).

    python3 -m pip install edge-tts
    python3 scripts/tts-missing-audio.py [--voices zh-CN-XiaoxiaoNeural,zh-CN-YunxiNeural] [--query 'tag:needs-audio'] [--write]

Voices alternate per word (stable: picked from a hash of the word, so re-runs keep the same voice).

Reads each note's Simplified field, stores edgetts-<hash>.mp3 in Anki media, sets the
Audio field and removes the tag. Dry run unless --write. Anki open with AnkiConnect.
"""
import argparse, asyncio, base64, hashlib, json, os, re, urllib.request

import edge_tts


def ac(action, **params):
    url = os.environ.get("ANKICONNECT_URL", "http://localhost:8766")
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, json.dumps({"action": action, "version": 6, "params": params}).encode())))
    if r["error"]:
        raise RuntimeError(r["error"])
    return r["result"]


async def speak(text, voice, tries=5):
    # The endpoint intermittently answers 403; a retry usually succeeds.
    for i in range(tries):
        try:
            audio = b""
            async for chunk in edge_tts.Communicate(text, voice).stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
            if audio:
                return audio
        except Exception:
            pass
        await asyncio.sleep(1 + i)
    raise RuntimeError(f"edge-tts failed for {text!r}")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", default="zh-CN-XiaoxiaoNeural,zh-CN-YunxiNeural")
    ap.add_argument("--query", default='"note:Basic - Mandarin" tag:needs-audio')
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    notes = ac("notesInfo", notes=ac("findNotes", query=a.query))
    voices = a.voices.split(",")
    print(f"{len(notes)} notes, voices {voices}")
    done = 0
    for n in notes:
        word = re.sub(r"<[^>]+>|&nbsp;|\s", "", n["fields"]["Simplified"]["value"])
        if not word:
            continue
        voice = voices[int(hashlib.sha1(word.encode()).hexdigest(), 16) % len(voices)]
        if not a.write:
            print("  would voice", word, "->", voice)
            continue
        name = f"edgetts-{hashlib.sha1((voice + word).encode()).hexdigest()[:16]}.mp3"
        try:
            audio = await speak(word, voice)
        except RuntimeError as e:  # keep the tag so a re-run retries it
            print("  skipped:", e)
            continue
        ac("storeMediaFile", filename=name, data=base64.b64encode(audio).decode())
        ac("updateNoteFields", note={"id": n["noteId"], "fields": {"Audio": f"[sound:{name}]"}})
        ac("removeTags", notes=[n["noteId"]], tags="needs-audio")
        done += 1
    print(f"voiced {done}" if a.write else "dry run")


if __name__ == "__main__":
    asyncio.run(main())
