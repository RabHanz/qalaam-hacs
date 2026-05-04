import json, sqlite3
DB = "/home/onnyx/qalam/data/qul.sqlite"
SRC = "/home/onnyx/qalam/data/qul-source/raw/unpacked/quran-metadata-sajda.sqlite/quran-metadata-sajda.json"

with open(SRC) as f:
    src = json.load(f)

conn = sqlite3.connect(DB)
conn.execute("DROP TABLE IF EXISTS qalaam_v1_qul_metadata_sajda")
conn.execute("""
    CREATE TABLE qalaam_v1_qul_metadata_sajda (
        sajdah_number INTEGER PRIMARY KEY,
        verse_key TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('recommended','obligatory'))
    )
""")
# QUL labels: "obligatory"|"recommended"|"optional"
# In our schema: 'obligatory'|'recommended'. Map 'optional'→'recommended'.
inserted = 0
for k, row in src.items():
    n = int(row['sajdah_number'])
    vk = row['verse_key']
    typ = row['sajdah_type']
    typ_db = 'obligatory' if typ == 'obligatory' else 'recommended'
    conn.execute(
        "INSERT INTO qalaam_v1_qul_metadata_sajda (sajdah_number, verse_key, type) VALUES (?,?,?)",
        (n, vk, typ_db),
    )
    inserted += 1
conn.commit()
print(f"Sajda: inserted {inserted} rows")
for row in conn.execute("SELECT sajdah_number, verse_key, type FROM qalaam_v1_qul_metadata_sajda ORDER BY sajdah_number"):
    print(f"  #{row[0]}  {row[1]:8s}  {row[2]}")
conn.close()
