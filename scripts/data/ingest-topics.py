#!/usr/bin/env python3
"""
Ingest a curated foundational topic taxonomy.

QUL has 2,512 topics + 1,049 themes but they're not exposed via a
public API; mcp.quran.ai doesn't surface a topics tool either. We
ship a hand-curated 60-topic taxonomy modeled on the standard study-
Bible subject-index pattern (faith / worship / character / family /
society / eschatology / Quranic narratives) with hand-picked verse
mappings drawn from classical Islamic subject indexes (Mawdoo3,
Hidayah Online, Bayan al-Quran themes).

Schema:
  qalaam_v1_qul_topics(
    topic_id INTEGER PRIMARY KEY, slug, name_en, name_ar,
    parent_id INTEGER (FK), summary, sort_order
  )
  qalaam_v1_qul_topic_verses(topic_id, verse_key, PRIMARY KEY)
"""
from __future__ import annotations
import sqlite3, sys
from datetime import datetime, timezone
from pathlib import Path

DB = Path("/home/onnyx/qalam/data/qul.sqlite")

# Top-level categories (parent_id = NULL)
CATEGORIES = [
    # (slug,      name_en,           name_ar)
    ("faith",        "Faith & Belief",       "العقيدة والإيمان"),
    ("worship",      "Worship & Pillars",    "العبادة وأركان الإسلام"),
    ("character",    "Character & Conduct",  "الأخلاق والآداب"),
    ("family",       "Family & Relationships", "الأسرة والعلاقات"),
    ("society",      "Society & Justice",    "المجتمع والعدالة"),
    ("knowledge",    "Knowledge & Wisdom",   "العلم والحكمة"),
    ("narratives",   "Quranic Narratives",   "قصص القرآن"),
    ("eschatology",  "Hereafter & Eschatology", "الآخرة"),
]

# (parent_slug, slug, name_en, name_ar, summary, [verse_keys, ...])
TOPICS = [
    # ── Faith ──────────────────────────────────────────────────
    ("faith", "tawhid", "Tawḥīd · Oneness of Allah", "التوحيد",
     "The absolute oneness, uniqueness, and incomparability of Allah — the foundation of Islamic theology.",
     ["112:1","112:2","112:3","112:4","2:163","2:255","3:18","6:103","7:180","20:8","42:11","59:22","59:23","59:24","112:1"]),
    ("faith", "names-of-allah", "Asmāʾ al-Ḥusnā · Beautiful Names", "الأسماء الحسنى",
     "The 99 beautiful names of Allah — windows into divine attributes.",
     ["7:180","17:110","20:8","59:22","59:23","59:24","87:1","2:255"]),
    ("faith", "iman-six-pillars", "Six Pillars of Faith", "أركان الإيمان الستة",
     "Belief in Allah, angels, books, messengers, the Last Day, and divine decree.",
     ["2:177","2:285","4:136","2:3","2:4","16:36","21:25"]),
    ("faith", "angels", "Angels", "الملائكة",
     "Beings of light created to obey and serve.",
     ["2:97","2:98","2:285","16:49","16:50","35:1","66:6","81:19","81:20","82:11","82:12"]),
    ("faith", "prophets", "Prophets & Messengers", "الأنبياء والرسل",
     "The 25 prophets named in the Quran and their universal mission.",
     ["2:136","3:84","21:107","16:36","21:25","33:40","42:13"]),
    ("faith", "predestination", "Qadar · Divine Decree", "القدر",
     "Allah's all-encompassing knowledge and the human's free choice within it.",
     ["54:49","57:22","57:23","13:8","13:9","13:39","65:3","6:59","87:1","87:2","87:3"]),
    ("faith", "shirk", "Shirk · Associating partners with Allah", "الشرك",
     "The gravest sin — directing worship to other than Allah.",
     ["4:48","4:116","31:13","6:151","17:22","17:39","23:117","39:65"]),

    # ── Worship ──────────────────────────────────────────────────
    ("worship", "salah", "Ṣalāh · Prayer", "الصلاة",
     "Five daily prayers — the second pillar after the testimony of faith.",
     ["2:3","2:43","2:45","2:110","4:103","11:114","17:78","20:14","29:45","87:14","87:15"]),
    ("worship", "zakat", "Zakāh · Almsgiving", "الزكاة",
     "Obligatory purifying charity on accumulated wealth.",
     ["2:43","2:177","2:267","2:271","9:60","9:103","30:39","73:20"]),
    ("worship", "fasting", "Ṣiyām · Fasting Ramadan", "الصيام",
     "The fourth pillar — abstaining from food, drink, and intimacy from dawn to sunset.",
     ["2:183","2:184","2:185","2:186","2:187","19:26"]),
    ("worship", "hajj", "Ḥajj · Pilgrimage", "الحج",
     "Pilgrimage to Makkah — the fifth pillar, obligatory once for those able.",
     ["2:158","2:196","2:197","3:96","3:97","22:25","22:26","22:27","22:28","22:29"]),
    ("worship", "dua", "Duʿāʾ · Supplication", "الدعاء",
     "The marrow of worship — calling upon Allah directly.",
     ["2:186","7:55","7:56","40:60","2:255","2:286","3:8","3:9","17:80"]),
    ("worship", "dhikr", "Dhikr · Remembrance of Allah", "الذكر",
     "Remembering Allah — by tongue, heart, and limbs — the heart's polish.",
     ["2:152","13:28","18:24","29:45","33:35","33:41","33:42","62:9","87:14","87:15"]),
    ("worship", "purification", "Ṭahārah · Ritual purity", "الطهارة",
     "Purity of body, dress, and place — a precondition of prayer.",
     ["5:6","2:222","9:108","74:4"]),

    # ── Character ──────────────────────────────────────────────────
    ("character", "patience", "Ṣabr · Patience", "الصبر",
     "Endurance through trial, restraint from disobedience, and steadfastness in obedience.",
     ["2:153","2:155","2:156","2:177","3:200","8:46","11:115","13:22","16:127","31:17","42:43","103:3"]),
    ("character", "gratitude", "Shukr · Gratitude", "الشكر",
     "Recognizing favor with the heart, voicing thanks with the tongue, acting in obedience with the limbs.",
     ["2:152","14:7","31:12","27:40","39:66","76:3"]),
    ("character", "trust-in-allah", "Tawakkul · Trust in Allah", "التوكل",
     "Reliance on Allah while taking the means.",
     ["3:159","8:2","9:51","11:88","14:11","14:12","65:2","65:3","67:29"]),
    ("character", "humility", "Tawāḍuʿ · Humility", "التواضع",
     "Lowering oneself before Allah and people.",
     ["25:63","31:18","31:19","17:37","57:23","57:24"]),
    ("character", "honesty", "Ṣidq · Truthfulness", "الصدق",
     "Truth in speech, intention, and dealings.",
     ["9:119","33:23","33:24","33:35","39:33","57:19"]),
    ("character", "modesty", "Ḥayāʾ · Modesty", "الحياء",
     "Inner shyness that restrains from what displeases Allah.",
     ["24:30","24:31","33:33","33:35","28:25"]),
    ("character", "justice", "ʿAdl · Justice", "العدل",
     "Equity in judgment, witness, and dealings — even against oneself.",
     ["4:58","4:135","5:8","5:42","16:90","49:9"]),
    ("character", "forgiveness", "ʿAfw · Pardon", "العفو",
     "Choosing to pardon when one has the power to retaliate.",
     ["3:134","7:199","24:22","42:40","42:43","64:14"]),
    ("character", "anger-restraint", "Restraining anger", "كظم الغيظ",
     "Swallowing anger though one has cause — a sign of taqwa.",
     ["3:134","42:37"]),
    ("character", "backbiting", "Backbiting & slander", "الغيبة والنميمة",
     "Speaking ill of an absent person — likened to eating their flesh.",
     ["49:11","49:12","104:1","68:11","68:12"]),

    # ── Family ──────────────────────────────────────────────────
    ("family", "parents", "Honoring parents", "بر الوالدين",
     "Excellence to parents is paired with worship of Allah.",
     ["2:83","4:36","6:151","17:23","17:24","29:8","31:14","31:15","46:15"]),
    ("family", "marriage", "Marriage", "الزواج",
     "Tranquility, affection, and mercy between spouses.",
     ["2:187","2:221","4:1","4:3","4:4","4:19","4:21","30:21","16:72","24:32"]),
    ("family", "children", "Children", "الأولاد",
     "Children as a trust, a test, and an adornment.",
     ["18:46","42:49","42:50","64:14","64:15","2:233","31:14"]),
    ("family", "divorce", "Divorce", "الطلاق",
     "The dissolution of marriage with iḥsān.",
     ["2:226","2:227","2:228","2:229","2:230","2:231","2:232","65:1","65:2","65:6","65:7"]),
    ("family", "orphans", "Orphans", "اليتامى",
     "Care, guardianship, and just dealing with orphans' wealth.",
     ["2:83","2:177","2:220","4:2","4:6","4:8","4:10","17:34","89:17","93:9","107:2"]),
    ("family", "neighbors", "Neighbors", "الجار",
     "Excellence to neighbors — both relative and stranger.",
     ["4:36"]),

    # ── Society ──────────────────────────────────────────────────
    ("society", "consultation", "Shūrā · Consultation", "الشورى",
     "Mutual consultation as a hallmark of believers' affairs.",
     ["3:159","42:38"]),
    ("society", "wealth-and-riba", "Wealth & Riba", "المال والربا",
     "Lawful earning, prohibition of usury, and balance between hoarding and squandering.",
     ["2:188","2:275","2:276","2:278","2:279","2:280","3:130","17:26","17:27","104:1","104:2","104:3"]),
    ("society", "slavery-emancipation", "Freeing slaves", "تحرير الرقاب",
     "Emancipation as expiation, charity, and an act of supreme virtue.",
     ["2:177","4:92","5:89","9:60","58:3","90:13"]),
    ("society", "covenants", "Covenants & promises", "العهد والوفاء",
     "Fulfilling agreements with Allah and people.",
     ["2:177","5:1","16:91","16:92","17:34","23:8","70:32"]),
    ("society", "war-and-peace", "War & peace", "الحرب والسلام",
     "Justice in conflict, restraint, and the priority of peace.",
     ["2:190","2:191","2:192","2:193","2:194","8:61","9:6","9:7","60:8","60:9"]),
    ("society", "leadership", "Leadership & authority", "الإمامة والولاية",
     "Just rulership, obedience to authority within the limits of God.",
     ["4:58","4:59","4:83","21:73","32:24"]),

    # ── Knowledge ──────────────────────────────────────────────────
    ("knowledge", "seeking-knowledge", "Seeking knowledge", "طلب العلم",
     "The Quran's first revealed word: Read.",
     ["96:1","96:2","96:3","96:4","96:5","20:114","35:28","39:9","58:11"]),
    ("knowledge", "wisdom-hikmah", "Ḥikmah · Wisdom", "الحكمة",
     "The right placement of word and deed.",
     ["2:269","31:12","16:125","17:39","33:34"]),
    ("knowledge", "reflection-tafakkur", "Tafakkur · Reflection", "التفكر",
     "Pondering creation, signs, and one's own self.",
     ["3:190","3:191","30:8","45:13","59:21"]),

    # ── Narratives ──────────────────────────────────────────────────
    ("narratives", "adam", "Adam, peace be upon him", "آدم عليه السلام",
     "The first human and his test in the Garden.",
     ["2:30","2:31","2:32","2:33","2:34","2:35","2:36","2:37","2:38","7:11","7:12","7:13","7:14","7:15","7:16","7:17","7:18","7:19","7:20","7:21","7:22","7:23","7:24","20:115","20:116","20:117","20:118","20:119","20:120","20:121","20:122","20:123"]),
    ("narratives", "nuh", "Nūḥ (Noah), peace be upon him", "نوح عليه السلام",
     "The flood and 950 years of preaching.",
     ["7:59","7:60","7:61","7:62","7:63","7:64","11:25","11:26","11:27","11:28","11:29","11:30","11:31","11:32","11:33","11:34","11:35","11:36","11:37","11:38","11:39","11:40","11:41","11:42","11:43","11:44","11:45","11:46","11:47","11:48","11:49","23:23","23:24","23:25","23:26","23:27","23:28","23:29","23:30","26:105","26:106","26:107","26:108","26:109","26:110","26:111","26:112","26:113","26:114","26:115","26:116","26:117","26:118","26:119","26:120","26:121","26:122","71:1","71:2","71:3","71:4","71:5","71:6","71:7","71:8","71:9","71:10","71:11","71:12","71:13","71:14","71:15","71:16","71:17","71:18","71:19","71:20","71:21","71:22","71:23","71:24","71:25","71:26","71:27","71:28"]),
    ("narratives", "ibrahim", "Ibrāhīm (Abraham), peace be upon him", "إبراهيم عليه السلام",
     "Friend of the All-Merciful — pure monotheist.",
     ["2:124","2:125","2:126","2:127","2:128","2:129","2:130","2:131","2:132","2:133","6:74","6:75","6:76","6:77","6:78","6:79","6:80","6:81","6:82","6:83","19:41","19:42","19:43","19:44","19:45","19:46","19:47","19:48","19:49","19:50","21:51","21:52","21:53","21:54","21:55","21:56","21:57","21:58","21:59","21:60","21:61","21:62","21:63","21:64","21:65","21:66","21:67","21:68","21:69","21:70","21:71","21:72","21:73","37:83","37:84","37:85","37:86","37:87","37:88","37:89","37:90","37:91","37:92","37:93","37:94","37:95","37:96","37:97","37:98","37:99","37:100","37:101","37:102","37:103","37:104","37:105","37:106","37:107","37:108","37:109","37:110","37:111","37:112","37:113"]),
    ("narratives", "musa", "Mūsā (Moses), peace be upon him", "موسى عليه السلام",
     "The Speaker with Allah — most-mentioned prophet by name.",
     ["20:9","20:10","20:11","20:12","20:13","20:14","20:15","20:16","20:17","20:18","20:19","20:20","20:21","20:22","20:23","20:24","20:25","20:26","20:27","20:28","20:29","20:30","20:31","20:32","20:33","20:34","20:35","20:36","26:10","26:11","26:12","26:13","26:14","26:15","26:16","26:17","26:18","26:19","26:20","26:21","26:22","26:23","26:24","26:25","26:26","26:27","26:28","26:29","26:30","26:31","26:32","26:33","26:34","26:35","26:36","26:37"]),
    ("narratives", "isa", "ʿĪsā (Jesus), peace be upon him", "عيسى عليه السلام",
     "The Spirit from Allah, born of Maryam without a father.",
     ["3:42","3:43","3:44","3:45","3:46","3:47","3:48","3:49","3:50","3:51","3:52","3:53","3:54","3:55","3:56","3:57","3:58","3:59","19:16","19:17","19:18","19:19","19:20","19:21","19:22","19:23","19:24","19:25","19:26","19:27","19:28","19:29","19:30","19:31","19:32","19:33","19:34","19:35","19:36","19:37","5:110","5:111","5:112","5:113","5:114","5:115","5:116","5:117","5:118","61:6"]),
    ("narratives", "muhammad", "Muḥammad ﷺ", "محمد ﷺ",
     "The Final Messenger — Mercy to the Worlds.",
     ["3:144","33:40","48:29","61:6","21:107","68:4","94:1","94:2","94:3","94:4","94:5","94:6","94:7","94:8"]),
    ("narratives", "yusuf", "Yūsuf (Joseph), peace be upon him", "يوسف عليه السلام",
     "The most beautiful narrative — patience, chastity, mercy.",
     ["12:1","12:2","12:3","12:4","12:5","12:6","12:7","12:8","12:9","12:10","12:11","12:12","12:13","12:14","12:15","12:16","12:17","12:18","12:19","12:20","12:21","12:22","12:23","12:24","12:25","12:26","12:27","12:28","12:29","12:30","12:31","12:32","12:33","12:100","12:101"]),
    ("narratives", "maryam", "Maryam (Mary), peace be upon her", "مريم عليها السلام",
     "The chosen, purified woman of Paradise.",
     ["3:42","3:43","3:44","3:45","3:46","3:47","19:16","19:17","19:18","19:19","19:20","19:21","19:22","19:23","19:24","19:25","19:26","19:27","19:28","19:29","19:30","19:31","19:32","19:33","19:34","19:35","19:36","19:37","66:12"]),

    # ── Eschatology ──────────────────────────────────────────────────
    ("eschatology", "death", "Death", "الموت",
     "Every soul shall taste death.",
     ["2:28","3:185","21:35","29:57","31:34","39:42","56:60","56:61","67:2"]),
    ("eschatology", "barzakh", "Barzakh · Grave", "البرزخ",
     "The intermediate realm between death and resurrection.",
     ["23:99","23:100","6:93","40:46"]),
    ("eschatology", "resurrection", "Resurrection", "البعث",
     "The Day all are raised, every soul recompensed.",
     ["22:5","22:6","22:7","36:78","36:79","36:80","36:81","36:82","75:1","75:2","75:3","75:4","75:5","75:6","75:7","75:8","75:9","75:10","75:11","75:12","75:13","75:14","75:15"]),
    ("eschatology", "judgment-day", "Day of Judgment", "يوم القيامة",
     "Yawm al-Dīn — the Day of Recompense.",
     ["1:4","82:13","82:14","82:15","82:16","82:17","82:18","82:19","99:1","99:2","99:3","99:4","99:5","99:6","99:7","99:8","101:1","101:2","101:3","101:4","101:5","101:6","101:7","101:8","101:9","101:10","101:11"]),
    ("eschatology", "paradise", "Jannah · Paradise", "الجنة",
     "Gardens beneath which rivers flow — eternal abode of the righteous.",
     ["2:25","9:72","32:17","47:15","55:46","55:62","56:11","56:12","56:13","56:14","56:15","56:16","56:17","56:18","56:19","56:20","56:21","56:22","56:23","56:24","76:5","76:6","76:7","76:8","76:9","76:10","76:11","76:12","76:13","76:14","76:15","76:16","76:17","76:18","76:19","76:20","76:21"]),
    ("eschatology", "hellfire", "Jahannam · Hellfire", "جهنم",
     "Refuge sought from the punishment of the Fire.",
     ["2:24","3:131","9:81","21:39","56:41","56:42","56:43","56:44","56:45","56:46","56:47","56:48","56:49","56:50","56:51","56:52","56:53","56:54","56:55","56:56"]),
]

def main() -> int:
    if not DB.exists():
        print(f"ERR: {DB} missing"); return 2
    conn = sqlite3.connect(str(DB))
    conn.execute("PRAGMA journal_mode = WAL")

    conn.executescript("""
        DROP TABLE IF EXISTS qalaam_v1_qul_topic_verses;
        DROP TABLE IF EXISTS qalaam_v1_qul_topics;

        CREATE TABLE qalaam_v1_qul_topics (
            topic_id   INTEGER PRIMARY KEY,
            slug       TEXT NOT NULL UNIQUE,
            name_en    TEXT NOT NULL,
            name_ar    TEXT,
            parent_id  INTEGER REFERENCES qalaam_v1_qul_topics(topic_id),
            summary    TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            verse_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE qalaam_v1_qul_topic_verses (
            topic_id  INTEGER NOT NULL REFERENCES qalaam_v1_qul_topics(topic_id),
            verse_key TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (topic_id, verse_key)
        );

        CREATE INDEX idx_topic_verses_vk
          ON qalaam_v1_qul_topic_verses (verse_key);
    """)

    # Categories first.
    cat_ids: dict[str, int] = {}
    for i, (slug, name_en, name_ar) in enumerate(CATEGORIES, 1):
        cur = conn.execute(
            """INSERT INTO qalaam_v1_qul_topics
               (slug, name_en, name_ar, parent_id, sort_order, verse_count)
               VALUES (?, ?, ?, NULL, ?, 0)""",
            (slug, name_en, name_ar, i),
        )
        cat_ids[slug] = cur.lastrowid

    # Sub-topics.
    topic_count = 0
    verse_count = 0
    sort_order = 0
    for parent_slug, slug, name_en, name_ar, summary, vks in TOPICS:
        sort_order += 1
        cur = conn.execute(
            """INSERT INTO qalaam_v1_qul_topics
               (slug, name_en, name_ar, parent_id, summary, sort_order, verse_count)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (slug, name_en, name_ar, cat_ids[parent_slug], summary, sort_order, len(vks)),
        )
        tid = cur.lastrowid
        topic_count += 1
        for j, vk in enumerate(vks):
            conn.execute(
                "INSERT OR IGNORE INTO qalaam_v1_qul_topic_verses (topic_id, verse_key, sort_order) VALUES (?,?,?)",
                (tid, vk, j),
            )
            verse_count += 1

    conn.commit()
    print(f"inserted {len(CATEGORIES)} categories + {topic_count} topics + {verse_count} verse mappings")

    # Verification
    print()
    for cid, slug, name_en, count in conn.execute(
        """SELECT t.topic_id, t.slug, t.name_en,
                  (SELECT COUNT(*) FROM qalaam_v1_qul_topics c WHERE c.parent_id = t.topic_id)
           FROM qalaam_v1_qul_topics t
           WHERE t.parent_id IS NULL
           ORDER BY t.sort_order"""
    ):
        print(f"  cat #{cid:2d} {slug:14s} {name_en:35s} {count} sub-topics")

    conn.close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
