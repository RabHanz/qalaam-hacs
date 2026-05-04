#!/usr/bin/env python3
"""
Ingest the Quranic Arabic Corpus (QAC) v0.4 morphology — Kais Dukes,
2011, GPL — into qalaam_v1_qul_morphology.

Format of the source file (UTF-8, 128k+ rows):
    LOCATION    FORM            TAG     FEATURES
    (1:1:1:1)   bi              P       PREFIX|bi+
    (1:1:1:2)   somi            N       STEM|POS:N|LEM:{som|ROOT:smw|...
    ...

LOCATION = (surah:ayah:word:token).  Words split into 1+ tokens
(prefix / stem / suffix). FORM is Buckwalter transliteration; we
also store an Arabic-script form. TAG is POS (N, PN, V, ADJ, P,
DET, REL, …). FEATURES is a pipe-separated string with sub-fields
LEM:, ROOT:, gender, number, case, mood, voice, person, etc.

Schema:
  qalaam_v1_qul_morphology(
    surah, ayah, word_index, token_index,
    verse_key,       -- 'S:A' for fast verse-level lookup
    location,        -- 'S:A:W:T' canonical
    pos_tag,         -- 'N' / 'V' / 'ADJ' / 'P' / 'DET' / 'PRON' / etc.
    form_buck,       -- Buckwalter transliteration
    form_arabic,     -- Arabic script (decoded)
    lemma,           -- Buckwalter lemma
    root,            -- 3-/4-letter Buckwalter root
    features_json,   -- raw features hash
    is_prefix INTEGER, is_stem INTEGER, is_suffix INTEGER
  )

Source: https://corpus.quran.com/  (mirror used:
   https://raw.githubusercontent.com/cltk/arabic_morphology_quranic-corpus
   /master/quranic-corpus-morphology-0.4.txt)

Attribution: Quranic Arabic Corpus (Kais Dukes, 2011).
"""
from __future__ import annotations
import json, re, sqlite3, sys
from datetime import datetime, timezone
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")
SRC = Path("/home/onnyx/qalam/data/quranic-corpus-morphology-0.4.txt")

# Buckwalter → Arabic mapping (Tim Buckwalter standard).
BW_TO_AR = {
    "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
    "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
    "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز",
    "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
    "E": "ع", "g": "غ", "_": "ـ", "f": "ف", "q": "ق", "k": "ك",
    "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى",
    "y": "ي", "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ",
    "i": "ِ", "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ", "^": "ٓ",
    "#": "ٔ",
}
def buckwalter_to_arabic(bw: str) -> str:
    return "".join(BW_TO_AR.get(c, c) for c in bw)

LOC_RE = re.compile(r"\((\d+):(\d+):(\d+):(\d+)\)")

def main() -> int:
    if not DB.exists() or not SRC.exists():
        print(f"ERR: missing {DB if not DB.exists() else SRC}", file=sys.stderr)
        return 2

    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("DROP TABLE IF EXISTS qalaam_v1_qul_morphology")
    conn.execute("""
        CREATE TABLE qalaam_v1_qul_morphology (
            surah        INTEGER NOT NULL,
            ayah         INTEGER NOT NULL,
            word_index   INTEGER NOT NULL,
            token_index  INTEGER NOT NULL,
            verse_key    TEXT NOT NULL,
            location     TEXT NOT NULL,
            pos_tag      TEXT NOT NULL,
            form_buck    TEXT NOT NULL,
            form_arabic  TEXT NOT NULL,
            lemma        TEXT,
            root         TEXT,
            features_json TEXT NOT NULL,
            is_prefix    INTEGER NOT NULL DEFAULT 0,
            is_stem      INTEGER NOT NULL DEFAULT 0,
            is_suffix    INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (surah, ayah, word_index, token_index)
        )
    """)
    conn.execute("CREATE INDEX idx_morph_vk ON qalaam_v1_qul_morphology (verse_key, word_index, token_index)")
    conn.execute("CREATE INDEX idx_morph_root ON qalaam_v1_qul_morphology (root) WHERE root IS NOT NULL")
    conn.execute("CREATE INDEX idx_morph_lemma ON qalaam_v1_qul_morphology (lemma) WHERE lemma IS NOT NULL")

    rows = []
    skipped = 0
    with SRC.open() as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or line.startswith("LOCATION"):
                continue
            parts = line.split("\t")
            if len(parts) < 4:
                skipped += 1
                continue
            loc, form_bw, tag, feats = parts[0], parts[1], parts[2], parts[3]
            m = LOC_RE.match(loc)
            if not m:
                skipped += 1
                continue
            s, a, w, t = (int(x) for x in m.groups())
            verse_key = f"{s}:{a}"
            form_arabic = buckwalter_to_arabic(form_bw)
            # Parse features into a small dict for downstream queries.
            features = {}
            for f_part in feats.split("|"):
                if not f_part:
                    continue
                if ":" in f_part:
                    k, _, v = f_part.partition(":")
                    features[k] = v
                else:
                    # Boolean / class tag (PREFIX, STEM, SUFFIX, MS, FS, GEN, ACC, NOM, …)
                    features[f_part] = True
            lemma = features.get("LEM")
            root = features.get("ROOT")
            is_prefix = 1 if features.get("PREFIX") else 0
            is_stem = 1 if features.get("STEM") else 0
            is_suffix = 1 if features.get("SUFFIX") else 0
            rows.append((
                s, a, w, t, verse_key, loc, tag, form_bw, form_arabic,
                lemma, root, json.dumps(features, ensure_ascii=False),
                is_prefix, is_stem, is_suffix,
            ))

    print(f"parsed {len(rows)} morph tokens (skipped {skipped})")
    conn.executemany(
        """INSERT INTO qalaam_v1_qul_morphology
           (surah, ayah, word_index, token_index, verse_key, location,
            pos_tag, form_buck, form_arabic, lemma, root, features_json,
            is_prefix, is_stem, is_suffix)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    conn.execute("""
        CREATE TABLE IF NOT EXISTS qalaam_v1_morphology_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn.execute("INSERT OR REPLACE INTO qalaam_v1_morphology_meta VALUES ('source', ?)",
                 ("Quranic Arabic Corpus v0.4 (Kais Dukes, 2011) — GPL",))
    conn.execute("INSERT OR REPLACE INTO qalaam_v1_morphology_meta VALUES ('source_url', ?)",
                 ("https://corpus.quran.com/",))
    conn.execute("INSERT OR REPLACE INTO qalaam_v1_morphology_meta VALUES ('ingested_at', ?)", (now,))
    conn.commit()

    # Stats
    print()
    print("=== Stats ===")
    print(f"  total tokens: {conn.execute('SELECT COUNT(*) FROM qalaam_v1_qul_morphology').fetchone()[0]}")
    print(f"  distinct verses: {conn.execute('SELECT COUNT(DISTINCT verse_key) FROM qalaam_v1_qul_morphology').fetchone()[0]}")
    print(f"  distinct lemmas: {conn.execute('SELECT COUNT(DISTINCT lemma) FROM qalaam_v1_qul_morphology WHERE lemma IS NOT NULL').fetchone()[0]}")
    print(f"  distinct roots:  {conn.execute('SELECT COUNT(DISTINCT root) FROM qalaam_v1_qul_morphology WHERE root IS NOT NULL').fetchone()[0]}")
    print(f"  distinct POS:    {conn.execute('SELECT COUNT(DISTINCT pos_tag) FROM qalaam_v1_qul_morphology').fetchone()[0]}")
    print()
    print("  POS distribution:")
    for pos, c in conn.execute(
        "SELECT pos_tag, COUNT(*) FROM qalaam_v1_qul_morphology GROUP BY pos_tag ORDER BY COUNT(*) DESC LIMIT 10"
    ):
        print(f"    {pos:6s} {c}")

    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
