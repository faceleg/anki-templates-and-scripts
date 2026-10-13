#!/usr/bin/env python3
"""Build _hanzi_parts.json (character components + etymology) for the Writing back.

Usage (Anki CLOSED — reads the collection read-only):
    curl -sSfLO https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt
    python3 scripts/build-hanzi-parts.py dictionary.txt ~/Library/Application\\ Support/Anki2/faceleg

Writes <profile>/collection.media/_hanzi_parts.json for every character in
"Basic - Mandarin" Simplified fields. Re-run after adding many new words.
Data: Make Me a Hanzi (https://github.com/skishore/makemeahanzi).
"""
import json, re, sqlite3, sys
from pathlib import Path

dict_path, profile = sys.argv[1], Path(sys.argv[2])
D = {json.loads(l)["character"]: json.loads(l) for l in open(dict_path, encoding="utf-8")}

con = sqlite3.connect(f"file:{profile / 'collection.anki2'}?mode=ro", uri=True)
con.create_collation("unicase", lambda a, b: (a.lower() > b.lower()) - (a.lower() < b.lower()))
mid = con.execute("select id from notetypes where name='Basic - Mandarin'").fetchone()[0]
chars = set()
for (flds,) in con.execute("select flds from notes where mid=?", (mid,)):
    chars |= set(re.findall(r"[㐀-鿿]", flds.split("\x1f")[0]))


def comp(c):
    x = D.get(c, {})
    return {"c": c, "m": re.split(r"[;,]", x.get("definition") or "")[0][:24], "p": (x.get("pinyin") or [""])[0]}


out = {}
for c in sorted(chars):
    d = D.get(c)
    if not d:
        continue
    e = d.get("etymology") or {}
    rec = {"t": e.get("type", ""), "h": e.get("hint", "")}
    if e.get("type") == "pictophonetic":
        if e.get("semantic"):
            rec["s"] = comp(e["semantic"])
        if e.get("phonetic"):
            rec["f"] = comp(e["phonetic"])
    elif "？" not in d.get("decomposition", ""):  # skip partial decompositions (misleading)
        parts = [p for p in re.findall(r"[^⿰-⿿]", d.get("decomposition", "")) if p != c]
        if parts:
            rec["parts"] = [comp(p) for p in parts]
    if rec["h"] or rec.get("s") or rec.get("parts"):
        out[c] = rec

dest = profile / "collection.media" / "_hanzi_parts.json"
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(out)} of {len(chars)} characters -> {dest}")
