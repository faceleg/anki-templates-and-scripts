#!/usr/bin/env python3
"""Turn words you met in a book into Anki cards with sentences FROM THAT BOOK.

Sources (Anki open with AnkiConnect):
    python3 scripts/book-words-to-anki.py lookups /Volumes/KOBOeReader/.adds/koreader/settings/lookup_history.lua
    python3 scripts/book-words-to-anki.py tsv ~/Desktop/竟争对手-unknown.tsv --book 竟争对手

For each Chinese word:
  - already a "Basic - Mandarin" note -> a book sentence becomes its first example (tag book-context)
  - new word -> new Basic - Mandarin note in "Combined::0. Focus::Pre-reading::<book>" with CEDICT
    pinyin/definitions and up to 3 book sentences (tags book-context, needs-audio, book title)
Skipped: proper nouns (capitalised CEDICT pinyin), words missing from CEDICT, words with no sentence.
Dry run unless --write. Reuses the Chinese Dashboard add-on's epub + Calibre code.
"""
import argparse, json, os, re, sys, unicodedata, urllib.request
from pathlib import Path

DASHBOARD = Path(os.environ.get("DASHBOARD_REPO", Path(__file__).resolve().parents[2] / "anki-zhongwen-shuju"))
sys.path.insert(0, str(DASHBOARD))
from chinese_dashboard.stats import books as B  # noqa: E402

CALIBRE = Path(os.environ.get("CALIBRE_LIBRARY", "~/Documents/Books/Calibre")).expanduser()
KOBO = Path("/Volumes/KOBOeReader")
CEDICT = json.load(open(DASHBOARD / "chinese_dashboard/data/cedict.json", encoding="utf-8"))
DECK = "Combined::0. Focus::Pre-reading::{}"
HDR = '<div class="char_examples-parts-of-speech">Book</div>'
MARKS = {"̄": 1, "́": 2, "̌": 3, "̀": 4}


def ac(action, **params):
    url = os.environ.get("ANKICONNECT_URL", "http://localhost:8766")
    r = json.load(urllib.request.urlopen(urllib.request.Request(url, json.dumps({"action": action, "version": 6, "params": params}).encode())))
    if r["error"]:
        raise RuntimeError(r["error"])
    return r["result"]


def tone(syl):
    return next((t for c, t in MARKS.items() if c in unicodedata.normalize("NFD", syl)), 0)


def norm(s):
    return re.sub(r"[\W_]+", "", s).lower()


def find_epub(title):
    """Calibre first (by title), then any epub on the Kobo whose filename contains the title."""
    key = norm(title.split("(")[0].split("（")[0])
    for b in B.list_books(CALIBRE) if CALIBRE.exists() else []:
        if key and (key in norm(b.title) or norm(b.title) in key):
            return b.epub
    for p in KOBO.glob("**/*.epub") if KOBO.exists() else []:
        if not p.name.startswith("._") and key in norm(p.stem):
            return p
    return None


def clean(s):
    """Strip graded-reader footnote markers ([49], 审理60) and exercise numbering (7. / （3）)."""
    s = re.sub(r"\[\d+\]", "", s)
    s = re.sub(r"(?<=[\u4e00-\u9fff])\d+", "", s)
    s = re.sub(r"^\s*(?:[（(]\d+[）)]|\d+[.、．])\s*", "", s)
    return s.strip()


def sentences(text, word, n=3):
    parts = {clean(s) for s in re.split(r"(?<=[。！？!?])|\n", text) if word in s}
    # drop glossary/exercise lines (Latin letters, blanks) and fragments
    parts = [s for s in parts if 6 <= len(s) <= 60 and word in s and not re.search(r"[A-Za-z_]|（\s*）", s)]
    return sorted(parts, key=lambda s: (abs(len(s) - 18), s))[:n]


def note_fields(word, sents):
    e = CEDICT[word]
    syls = e["pinyin"].split()
    tones = [tone(s) for s in syls]
    pinyin = " ".join(f'<span class="pinYinWrapper"><span class="t{t}">{s}</span></span>' for s, t in zip(syls, tones))
    chars = "".join(f'<span class="char-tone{t}">{c}</span>' for c, t in zip(word, tones + [0] * len(word)))
    meaning = "<br>".join(d for d in e["definitions"] if not d.startswith(("CL:", "old variant", "variant of")))
    blank = lambda s: s.replace(word, f'<span class="char_example_blank">{"_" * len(word)}</span>')
    return {
        "Simplified": word,
        "Pinyin": pinyin,
        "Definitions": f'<div class="meaning-container"><div class="char"><span id="char-sim-id">{chars}</span></div>'
                       f'<div class="pinyin">{e["pinyin"]}</div><div class="meaning">{meaning}</div></div>',
        "Examples": HDR + "".join(f'<div class="char_example">{s}</div>' for s in sents),
        "ExamplesBlank": HDR + "".join(f'<div class="char_examples_blank">{blank(s)}</div>' for s in sents),
    }


def read_lookups(path):
    out = []
    for blk in Path(path).read_text(encoding="utf-8").split("LookupHistoryEntry{")[1:]:
        w = re.search(r'\["word"\] = "([^"]*)"', blk)
        b = re.search(r'\["book_title"\] = "([^"]*)"', blk)
        if w and re.search(r"[一-鿿]", w.group(1)):
            out.append((w.group(1).strip(), b.group(1) if b else ""))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", choices=["lookups", "tsv"])
    ap.add_argument("path")
    ap.add_argument("--book", help="book title for tsv source")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    pairs = read_lookups(a.path) if a.source == "lookups" else [
        (l.split("\t")[0].strip(), a.book) for l in open(a.path, encoding="utf-8") if l.strip()]

    texts, report = {}, {"new": 0, "example_added": 0, "proper_noun": 0, "not_in_cedict": 0, "no_sentence": 0, "no_book": set()}
    seen = set()
    for word, title in pairs:
        if (word, title) in seen:
            continue
        seen.add((word, title))
        if title not in texts:
            epub = find_epub(title)
            texts[title] = B.extract_text(epub) if epub else None
            print(f"book: {title[:40]} -> {epub.name if epub else 'NOT FOUND'}")
        if texts[title] is None:
            report["no_book"].add(title)
            continue
        if word not in CEDICT:
            report["not_in_cedict"] += 1
            continue
        if CEDICT[word]["pinyin"][:1].isupper():
            report["proper_noun"] += 1
            continue
        sents = sentences(texts[title], word)
        if not sents:
            report["no_sentence"] += 1
            continue
        book = re.sub(r"[（(].*", "", title).strip()
        ids = ac("findNotes", query=f'"note:Basic - Mandarin" "Simplified:{word}"')
        if ids:
            n = ac("notesInfo", notes=ids[:1])[0]["fields"]
            if sents[0] in n["Examples"]["value"]:
                continue
            report["example_added"] += 1
            if a.write:
                one = note_fields(word, sents[:1])
                ac("updateNoteFields", note={"id": ids[0], "fields": {
                    "Examples": one["Examples"] + n["Examples"]["value"],
                    "ExamplesBlank": one["ExamplesBlank"] + n["ExamplesBlank"]["value"]}})
                ac("addTags", notes=ids[:1], tags="book-context")
        else:
            report["new"] += 1
            if a.write:
                deck = DECK.format(book)
                ac("createDeck", deck=deck)
                ac("addNote", note={"deckName": deck, "modelName": "Basic - Mandarin", "fields": note_fields(word, sents),
                                    "tags": ["book-context", "needs-audio", re.sub(r"\s+", "_", book)],
                                    "options": {"allowDuplicate": False}})
    report["no_book"] = sorted(report["no_book"])
    print(("WROTE " if a.write else "DRY RUN ") + json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
