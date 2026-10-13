#!/usr/bin/env python3
"""Pull the sentence you were reading from KOReader's Vocabulary Builder into Anki.

Usage (Anki open with AnkiConnect, Kobo mounted or DB copied):
    python3 scripts/koreader-context.py /Volumes/KOBOeReader/.adds/koreader/settings/vocabulary_builder.sqlite3 [--write]

For every looked-up word:
  - already a "Basic - Mandarin" note -> the book sentence becomes the FIRST example
    (and blanked example), tagged `book-context`. Idempotent: skipped if already there.
  - not in Anki yet -> listed in koreader-new-words.tsv (word, sentence, book) for the
    usual xiehanzi -> import pipeline.
Without --write it only reports. Don't delete lookups in KOReader any more; re-runs are safe.
"""
import json, re, sqlite3, sys, urllib.request

SENT_END = "。！？!?…\n"
HDR = '<div class="char_examples-parts-of-speech">Book</div>'


def ac(action, **params):
    req = urllib.request.Request("http://localhost:8765", json.dumps({"action": action, "version": 6, "params": params}).encode())
    r = json.load(urllib.request.urlopen(req))
    if r["error"]:
        raise RuntimeError(r["error"])
    return r["result"]


def sentence(prev, word, nxt):
    """Trim KOReader's surrounding text to the sentence containing the word."""
    prev, nxt = prev or "", nxt or ""
    cut = max(prev.rfind(c) for c in SENT_END)
    start = prev[cut + 1:] if cut >= 0 else prev
    ends = [i for i in (nxt.find(c) for c in SENT_END) if i >= 0]
    end = nxt[: min(ends) + 1] if ends else nxt
    return (start + word + end).strip()


def lookups(db):
    con = sqlite3.connect(f"file:{db}?immutable=1", uri=True)
    rows = con.execute(
        "SELECT v.word, v.prev_context, v.next_context, t.name FROM vocabulary v LEFT JOIN title t ON t.id = v.title_id"
    )
    return [(w, sentence(p, w, n), book or "") for w, p, n, book in rows if w]


def main():
    db, write = sys.argv[1], "--write" in sys.argv
    added, new = 0, []
    for word, sent, book in lookups(db):
        ids = ac("findNotes", query=f'"note:Basic - Mandarin" "Simplified:{word}"')
        if not ids:
            new.append((word, sent, book))
            continue
        note = ac("notesInfo", notes=ids[:1])[0]
        ex = note["fields"]["Examples"]["value"]
        if not sent or word not in sent or sent in ex:
            continue
        blank = sent.replace(word, f'<span class="char_example_blank">{"_" * len(word)}</span>')
        fields = {
            "Examples": f'{HDR}<div class="char_example">{sent}</div>' + ex,
            "ExamplesBlank": f'{HDR}<div class="char_examples_blank">{blank}</div>' + note["fields"]["ExamplesBlank"]["value"],
        }
        added += 1
        if write:
            ac("updateNoteFields", note={"id": note["noteId"], "fields": fields})
            ac("addTags", notes=[note["noteId"]], tags="book-context")
    with open("koreader-new-words.tsv", "w", encoding="utf-8") as f:
        f.writelines(f"{w}\t{s}\t{b}\n" for w, s, b in new)
    print(f"book sentences {'added' if write else 'to add'}: {added} | new words -> koreader-new-words.tsv: {len(new)}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        assert sentence("他走进来。我们", "觉得", "很奇怪，然后离开了。后面", ) == "我们觉得很奇怪，然后离开了。"
        assert sentence("", "姚", "") == "姚"
        assert sentence("开头", "词", "结尾") == "开头词结尾"
        print("selftest ok")
    else:
        main()
