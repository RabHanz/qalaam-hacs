# Qalaam — what it is, in plain words

## The one-line version

Qalaam is a Quran companion that lives in your home — it reads, listens, and helps your family memorize the Quran together, working with the speakers and devices you already own.

## The real story

Most Quran apps were built for one person, holding a phone, by themselves. That's not how Quran actually lives in a Muslim home. It's playing softly in the kitchen during dinner. It's the thing your child practices after Maghrib while you're listening from the next room. It's the surah everyone in the house is trying to memorize together during Ramadan. It's the adhan that quiets the TV. It's the story the grandparents listen to before bed. It's the dua you whisper as you walk out the door.

Qalaam is built for *that* — the actual rhythm of a Muslim household — instead of for a single user staring at a screen.

---

## The four things it does, at the highest level

### It reads with you

A beautiful, calm Quran reader on phone, tablet, laptop, or — if you have one — a wall tablet in your living room. The original Arabic in the script of your choice (the standard Madani mushaf, the Indo-Pak script familiar to South Asia, or others). Your favorite translations side-by-side if you like. The tafsir of your choice opened with one tap. Word-by-word meanings if you tap any word. Tajweed rules colored beautifully across the text, with a legend so you can learn them as you read. Beautiful ayah-cards you can share to family WhatsApp. Personal notes on any verse, encrypted so they're truly yours. A quiet, private journal of your reflections.

Nothing gamified. No streak guilt. No leaderboards. No XP. No coins. No mascots. Just the Quran, presented with the dignity it deserves.

### It listens around the house

Qalaam can play any reciter on any speaker you own — your Sonos, your Google Home, your Apple HomePod, an old Bluetooth speaker, the laptop you're working on, even a cheap Raspberry Pi in your kid's bedroom. You don't pick "the Qalaam speaker." You pick "the room." If you have multiple speakers in different rooms, Qalaam can play the same recitation in sync across all of them, like a soft envelope of Quran around the whole house.

A few of the things this enables:

- **Listen Mode** — the surah someone in the family is currently memorizing plays softly in the background while everyone goes about their day. That ambient repetition is one of the oldest, most evidence-backed memorization techniques in the world, and no app does it home-wide.
- **Sleep + wake routines** — last night's reviewed portion plays at lights-out; the next morning's Fajr alarm gradually fades the same portion in as you wake up.
- **Multi-reciter comparison** — sit at a table and hear the same verse from three different qaris, side-by-side, to study how each of them handles a particular passage.
- **CarPlay and Android Auto** — pick up exactly where you left off on the drive in.
- **Co-listening across distance** — a child in Lahore and their grandfather in Toronto can listen to Surah Kahf together every Friday, with a private text conversation per ayah as it plays.
- **"Shazam for Quran"** — recite a half-phrase you can't place, and Qalaam jumps you straight to the verse.

### It helps your family memorize

This is the heart of the thing. Memorizing Quran (Hifdh) is one of the most beautiful, hardest disciplines a Muslim family can take on, and the way it's traditionally taught — a daily new lesson, careful revision of the last week's portions, and a slow rolling review of everything memorized so far — is something almost no app respects. Qalaam respects it completely.

What that looks like in practice:

- **Each child gets their own plan.** A range of the Quran they're working on, a daily quantum that's right for their age (a half-page is the classic starting point for kids), and a schedule that fits the family's life.
- **Each day's session assembles itself.** Today's new lesson, the portions due for fresh review, the older portions due for slow review — all balanced 80/20 the way a real teacher would do it.
- **The mistakes are tracked the right way.** When two verses sound similar (a classic stumbling block called *mutashabihat* — "the resembling ones"), Qalaam notices when your child confuses them and gently surfaces the pair together for deliberate practice. No app does this.
- **The AI listens — quietly.** When a child is reciting, Qalaam can listen on the device (never to a cloud, never to anyone else's server) and gently flag the words they got wrong — without interrupting. That last part matters. We never want a child to feel surveilled or judged. The point is to help, the way a kind teacher would.
- **Parents see a daily summary, not a real-time stream.** A calm overview at the end of the day: how each kid did, what their current portion is, where they're stuck. No surveillance. No anxiety. Just the gentle awareness a parent needs to support without nagging.
- **One-tap "I just heard them recite."** When a parent listens to a child read in person, they can rate the session on two simple axes (smoothness and accuracy) in a single tap. The app does the rest.
- **Weak portions get more love automatically.** If a page keeps tripping the child up, Qalaam quietly schedules it more often without anyone having to ask.
- **Streaks have grace days.** A missed day gets a gentle "welcome back" — never a punishment.
- **A heatmap of the whole Quran shows progress.** Pages turn from red (frequent mistakes) to orange to yellow to clear, slowly, over weeks. You can see what's locking in and what still needs work, at a glance.

### It plays with your home

Because Qalaam speaks to your existing smart speakers and to Home Assistant directly, you can wire it into the rhythm of your day automatically. None of this is a gimmick — it's what a Muslim home actually wants from a smart home, and nobody has built it.

- **Adhan-aware automations.** The lights dim and the TV pauses when adhan is about to begin. The whole house gets quiet for a moment.
- **Per-room sabaq announcements.** The kid's room speaker softly says "your sabaq starts now" at the agreed-upon time, in the right voice.
- **Door-LED indicators.** A green LED on the bedroom door means today's wird is done; amber means there's still a portion left; red means nothing yet. Kids respond to ambient light far better than to push notifications.
- **Family wall display.** A tablet on the kitchen wall shows everyone's progress — without ever pitting anyone against anyone.
- **A Ramadan family khatm, lived together.** Each member commits to a few juz; the wall display fills in as people finish their share; the smart speaker softly announces when someone completes theirs in the evening.
- **Voice control in two languages at once.** Say *"shaghil surat al-Mulk"* in Arabic *or* "play Surah Mulk" in English to the same speaker. Newer Home Assistant setups now natively support two voice pipelines per room — Qalaam uses both.
- **Adhan-aware do-not-disturb.** When a prayer window is active, Hifdh sessions don't trigger, notifications hush, and TVs in the house can dim or pause.

---

## The features, more concretely

### Reading

- The complete Quran in multiple Arabic scripts (Uthmani, Indo-Pak, Imlaei, QPC Hafs).
- The Madani 15-line page-faithful mushaf — same words always in the same place, the visual anchor real memorizers depend on.
- Indo-Pak 16-line mushaf for South Asian families who learned with that layout.
- Tajweed colored beautifully, with a legend explaining each rule.
- Word-by-word translations and transliteration on tap.
- Multiple translations (English, Urdu, French, Indonesian, Turkish, Malay, more on request) — pick one or compare them side-by-side.
- Multiple tafsirs (Saheeh International, Ibn Kathir, Maududi, Muyassar, more) — each opened in a clean reading view.
- Bookmarks, highlights, tagging, notes.
- Notes encrypted at rest. Yours, period. Exportable as Markdown or PDF whenever you want.
- A reading journal that quietly keeps your reflections without ever broadcasting them.
- A 3-pane "deep study" view: Arabic + translations + tafsir together.
- Search across translations and across the Arabic text.
- Topical search ("the names of Allah," "the stories of the prophets," "patience," "the orphans").
- Cross-references and related verses.
- Asbab al-nuzul (the story behind each verse's revelation) for the verses where it's known.
- Beautiful one-tap shareable ayah cards with several templates and aspect ratios, branded subtly.

### Listening

- 80+ reciters to choose from, with the Murattal and Mujawwad styles where each reciter recorded both.
- Verse-by-verse highlighting that follows the recitation in real time.
- Speed control, repeat-this-verse, repeat-this-range, sleep timer.
- Background playback with proper lock-screen controls.
- Offline downloads per-surah or per-juz so a long flight or a low-signal area never breaks the practice.
- Multi-reciter A/B comparison.
- "Shazam for Quran" voice search.
- Smart speaker support: Google Cast, Sonos, Apple AirPlay 2, generic UPnP/DLNA, Snapcast, MQTT-aware speakers (ESPHome and friends), Bluetooth, anything Home Assistant can drive.
- Per-room targeting and multi-room sync.
- Listen Mode (ambient low-volume looping of your current memorization portion).
- Co-listening across the internet — synced playback so the family can listen together no matter where they are.
- Adhan-aware "do not disturb" propagated to all family devices automatically.
- CarPlay and Android Auto with full reading-position sync.
- A small e-ink "now playing" device for the prayer room is on our roadmap — for households that want a screen-free permanent display.

### Memorization (Hifdh)

- Per-user plans (kids, parents, anyone) with simple controls a parent can set in two minutes.
- Daily session assembles itself — today's new lesson, last week's review, older portions due, balanced the right way.
- The 80/20 traditional rule honored automatically.
- The "single-reciter rule" honored — the reciter you started memorizing with is the one Qalaam plays back, because rhythm and pause patterns get encoded with the words.
- The "same-mushaf rule" honored — the page layout you memorized with is the layout Qalaam shows, because page position is itself a memory cue.
- Mutashabihat — the similar-verse traps — flagged automatically, with targeted side-by-side practice when needed.
- A per-page mistake heatmap that decays over weeks, so progress is visible without being broadcast.
- Verse-pause drill ("test me"): the speaker recites the first half of a verse and waits for you (or your child) to complete it. The AI on the device judges whether the completion was right, gently.
- Forgiving streaks with grace days.
- "I just heard them recite" one-tap parent rating.
- Daily parent dashboard — a calm summary, not a surveillance feed.
- Family halaqah view — the whole household at a glance, family-private.
- Voice notes from a teacher or parent attached to specific verses.
- Praise stickers and audio replies between family members tied to specific portions ("masha'Allah, that was clean — proud of you").
- Mistake export — for those who work with a human teacher and want to review the week's stumbles together at the lesson.
- Cross-app reading import — count a Quran read on a paper mushaf via "I just read pages 50–55" + an optional voice spot-check.
- Mini-courses for short surahs ("memorize Surah Mulk in 7 days," with daily structured nudges).
- Hifz Tracker-style calendar view of your whole memorization journey.

### Smart-home and ambient

- Home Assistant integration (full-featured: media player, sensors, todo lists, calendars, buttons, voice intents, sidebar dashboard).
- Per-room scheduled "your sabaq starts now" announcements with optional environment control (lights dim, TV pauses, other speakers mute).
- Adhan-aware everything — no Qalaam action ever fires inside a prayer window.
- Door-LED indicators (green = wird done, amber = sabqi pending, red = nothing today).
- Family wall display (a wall-mounted tablet, an old phone, an e-ink display — anything with a browser).
- Sleep / wake routines tied to the last reviewed portion.
- Auto-Quran on alarm (Fajr 30 min before with gradual volume).
- Ramadan-aware UI mode (juz-a-day default goal, sahoor and iftar countdowns, Taraweeh tracker, Laylat al-Qadr odd-night reminders, soft warm-light scenes for sahoor and bright scenes for iftar).
- Friday Surah Kahf nudge (Thursday Maghrib through Friday Maghrib, gentle, opt-in).
- Donation reminder on Friday and the last 10 nights of Ramadan (transparent about which charities are featured).
- Voice-control in two languages simultaneously — say it in Arabic *or* in your household's primary language.
- "Hey Qalaam, continue Surah Al-Kahf in Mishary's voice from where I left off."
- Lockscreen-as-mushaf widget for elders who want the same display always-on without unlocking.
- Family-private khatm announcements ("Dad finished his juz — 4 to go for tonight's khatm").

### Companion features

- Adhan / prayer times for every major calculation method (MWL, Egyptian, Karachi, ISNA, Umm al-Qura, Dubai, Qatar, Kuwait, Singapore, Turkey, Tehran, North America, Moonsighting Committee), including high-latitude rules for Northern Europe and Canada.
- Multiple adhan recordings to pick from, including the Fajr-specific "as-salatu khayrum min an-nawm" variant.
- Qibla direction with smart compass calibration.
- Hijri calendar with Umm al-Qura and tabular methods, plus Islamic event reminders (Ashura, Mawlid, 15 Sha'ban, Ramadan, Laylat al-Qadr odd nights, Eid al-Fitr, the Dhul Hijjah days, Day of Arafah, Eid al-Adha, Tashreeq).
- Hisn al-Muslim azkar — morning, evening, post-salah, sleep, wake, ruqyah, travel, distress, eating, all the canonical categories — with Arabic, transliteration, translation, and audio per dua.
- Scheduled morning and evening adhkar playback after Fajr and Maghrib on the speaker of your choice.
- Masjid finder (with community-submitted prayer-time corrections per masjid).
- Hijri date alongside Gregorian everywhere it matters.

### Family

- Family Plan is *the* plan, not an upsell. Built for households from day one.
- Per-child plans with appropriate defaults for age.
- Parent supervision that respects the child's dignity (daily summary, never real-time mistake notifications).
- Child-consent toggle past about age 10 — children can ask for stat-sharing to be muted from siblings, while keeping it visible to parents.
- Family khatm modes: funeral, Ramadan, rolling weekly, Hifdh-class.
- Voice notes and praise stickers between family members per verse.
- Family-private weekly leaderboard (opt-in, never public, framed as encouragement) — the only "leaderboard" that isn't risky theologically.
- Shared bookmarks and dua lists ("Mom highlighted this for me").
- Friend-circle khatms (a college group, a study circle, a couple in two countries).
- A community / masjid mode for Hifdh academies — group of students, a teacher, weekly summaries.

### Learning the language

- A progressive Quranic Arabic curriculum, built in four levels:
  - **Level 1 — Alphabet & Pronunciation.** The 28 letters, the vowel marks, the basics of joining and word formation.
  - **Level 2 — Tajweed Fundamentals.** Articulation points, the rules of Noon-sakinah and Meem-sakinah, the categories of Madd, qalqalah, lam shamsiyyah and qamariyyah, the rules for Raa, the rules for the lengthening, the rules for stopping and starting.
  - **Level 3 — Connected Recitation.** Fluency, intermediate surahs, stop signs, an introduction to the maqamat (the melodic systems of recitation).
  - **Level 4 — Advanced Mastery.** Complete surah memorization, the seven (and ten) qira'at, teaching and certification preparation.
- Lessons unlock progressively — no skipping ahead.
- Spaced repetition for vocabulary and rules, the same proven engine as Hifdh.
- Verse-by-verse word-by-word grammar (i'rab) for serious students.
- Reciter-style teaching — hear how a specific reciter pronounces a particular sound; mimic; get gentle feedback.
- A children's mode with a softer, slower reciter (Mansour az-Zahrani, Idris Abkar slow), simplified UI, parental PIN, encouraging stickers — but never coins or gems.

### Voice cloning and teach-back (later phase, built carefully)

- Hear any verse generated in the voice of a reciter — Qalaam-house voice initially (a beautiful blend, attributable to nobody in particular), and individually licensed reciter voices later, with proper consent and licensing in place. We won't shortcut this. No stealing voices.
- Personal teacher cloning (Pro tier): with explicit consent and a documented release, a student can clone the voice of their own teacher, parent, or themselves, and have that voice walk alongside them in their earbuds — gently correcting them in a tone they trust.
- All AI-generated audio watermarked, both inaudibly and visibly, in compliance with new AI Voice Rights laws.
- Side-by-side comparison: hear how your recitation compares to a target reciter's, with visual pitch and pause guides.
- Tajweed-correctness scoring (madd lengths, ghunna nasalization, qalqalah) shipped as opt-in experimental, never as authoritative judgment.

### Modes

- **SaaS** — sign up, use it, no setup. Audio cached on Cloudflare so it streams instantly.
- **Self-hosted** — for the privacy-maximalist, the open-source enthusiast, the family that runs everything on a Pi at home. One Docker Compose, no cloud, complete control.
- **Home Assistant native** — runs as a first-class HA integration, dashboards in your sidebar, voice in your existing voice pipeline, automations in your existing automation engine.

The same code powers all three. You can move between them. You can run the SaaS while testing self-host. The data is yours either way.

---

## What's different about it

### It works on every speaker, not just one ecosystem

Most apps lock you into Google Cast or Apple AirPlay. Qalaam plays on whatever you own — Cast, Sonos, AirPlay 2, generic UPnP, Snapcast, MQTT speakers, Bluetooth, the browser tab you're reading in, anything Home Assistant can drive. If something new comes out next year (a new open multi-room protocol, a new fridge with a speaker, a new Matter Casting device), we add it.

### It works completely offline if you want

Qalaam ships with the entire Quran text, audio for the most popular reciters, the memorization helper, the prayer times, the azkar — all stored on your device. You can use it on a plane, in a place with no internet, in the masjid, in the desert. Nothing important breaks when the network goes down.

### It listens on your device, not in our cloud

When the AI checks your child's recitation, the audio never leaves your house. Most apps that do this kind of thing send your child's voice to a server somewhere. Qalaam doesn't. The mistake-detection model runs locally — on the phone, on the laptop, on the Pi, on the Home Assistant box. We get the helpful feedback without the creepy data trade.

The architecture enforces this. Audio buffers are categorically different from sync events at the data-model level. The server *can't* receive audio even if a buggy client tried to send it. That's not a policy promise — it's a structural guarantee.

### It's built for a family, not a single user

Every other Quran app is one phone, one user, one account. Qalaam is built around a household — multiple kids with their own plans, parents with a calm overview, shared khatms, family-private encouragement (no public scoreboards), teacher-style listening, sibling kindness instead of sibling competition. Family is *the* product, not an upsell.

### It respects the practice

No XP. No coins. No cartoon mascots making memorization look like Duolingo. No public leaderboards (which can make people show off, the opposite of why we recite). No fake "AI sheikh" chatbot inventing things and risking misquoting the Quran. No gimmicks that an attentive teacher would side-eye. Just a calm, quiet companion that helps a family do this beautifully.

### It teaches the language too

Qalaam includes a complete progressive course in Quranic Arabic — for the millions of Muslims who want to memorize the Quran but don't speak Arabic, or who speak some Arabic but want to *understand* what they're reciting.

### It can sound like your favorite reciter (carefully)

Down the road, with proper consent and licensing in place, Qalaam will be able to generate any verse in the voice of a reciter you love, so a learner can hear *exactly* how Mishary Alafasy or Sheikh Husary would recite a verse they've never recorded — and then practice matching them. No app does this. We're building it carefully and with permission, not by stealing voices. AI-generated audio is always disclosed, always watermarked.

### It opens up the door to your own teacher

Pro users can — with documented consent — clone the voice of their *own* teacher or parent for personal use. That cloned voice walks alongside them through their day, correcting gently in a tone they actually trust. This is one of the most emotionally significant features in the product, and we're shipping it the right way (consent, watermarking, withdrawal mechanism, privacy vault) or not at all.

### Pricing built around fairness

Three tiers:

- **Free** — read the whole Quran, listen to any reciter, use the prayer times, get the azkar, basic Hifdh tracking. Free forever, no ads (we won't put ads on the Quran). Always.
- **Premium** — full Hifdh engine, voice cloning, smart-home integration, family plan up to 6 members, deep-study mode, all reciters, no usage limits.
- **Pro** — adds your own voice training, advanced analytics, classroom mode for teachers, white-label option for Hifdh academies.

Plus, borrowed from one of the most quietly beautiful things in the Quran-app world — Quranly's "I can't afford it" tier. If you genuinely can't afford it, you get Premium for free. We mean it. Allah's words, Allah's people, our small contribution.

---

## How you'd actually use it

A real day in a Qalaam home, six months from now:

- Your **Fajr alarm** wakes you up by gradually playing the last portion you reviewed before sleeping. The lights warm gradually with it.
- Over breakfast, the kitchen speaker softly loops your daughter's current memorization page while everyone gets ready.
- At 7:30 your son's bedroom door LED turns green — his short morning wird is already done because he listened to it on the way to brushing his teeth, and Qalaam picked it up.
- On your commute, CarPlay picks up exactly where you left off in your morning reading — Surah Yusuf, where you left it.
- An hour before Maghrib your phone reminds you, gently, that it's Friday and you usually read Surah Kahf today.
- When **adhan begins**, the TV pauses, the lights dim, the whole house gets quiet. The adhan plays softly through the right speakers in the right rooms.
- **After Maghrib your daughter sits down to recite** her new sabaq. Qalaam quietly listens on the device and afterwards shows her where she stumbled — only to her, not pushed to your phone in real time. You see a daily summary later: *"Aisha, today, page 421, fluency good, two stumbles on words also found in 3:5 (mutashabihat) — suggested practice tomorrow."*
- Your son finishes his portion and then sits at the table, opens the Arabic course, does a 5-minute lesson on Idgham with Ghunnah. The app closes itself when the lesson is done — no infinite scroll.
- **Sunday evening the family gathers** in the living room. The wall tablet shows your shared Ramadan khatm — collectively 18 of 30 juz, with a soft note: "Dad finished his juz tonight."
- Your **grandfather in Toronto** sends a voice note praising your son's progress — recorded right inside Qalaam, attached to the specific verse he heard him recite, replied to in the family thread that lives only inside your family.
- **Before sleep** the bedroom speaker fades in your last reviewed portion at low volume. The bedside light dims to amber. The house gets quiet.

That's Qalaam.

---

## Who we're building it for

Muslim families. Especially:

- **Parents trying to teach Hifdh at home** — without a $200/month tutor and without nagging.
- **Adults memorizing on their own** in the cracks of their day — commuting, cooking, before sleep.
- **Converts and non-Arabic speakers** trying to learn the language alongside the recitation.
- **Hifdh teachers and small classes** who want a tool that respects how they actually teach.
- **Reverts and second-generation Muslims** who want to come back to the Quran without feeling judged.
- **Grandparents** who want to read on a big screen, with audio they can hear, in the language they know.
- **Anyone who wants the Quran to live in their home**, not just in their phone.

It's a single-user app that quietly grows into a family product, then a smart-home companion, then — for those who want it — an AI tutor that helps you sound like the reciter you grew up loving.

---

## Why now

Three things came together in 2026 that made this finally possible:

1. **AI listening became good enough to run on a phone, fully offline.** Two years ago this lived only in big company servers. Today an open model from a community team called Tarteel sits on your device, accurate enough to catch real mistakes, fast enough to feel instant, small enough to fit in a mobile app.
2. **Smart speakers became ubiquitous and their interfaces became open.** We can now reliably play audio on any speaker in your home from one app. Music Assistant, Sendspin, AirPlay 2, Cast — the protocols matured at the same time the device count exploded.
3. **Home Assistant — the open-source brain people put in their houses — became the default for serious smart-home users**, and it has voice (now in two languages per room), dashboards, and automations sophisticated enough to host a Quran companion as a first-class feature, not a hack.

So we have the AI, the speakers, and the brain. None of them existed in this form even three years ago. That's why now.

---

## How we're building it

Two principles guide everything:

**Built for the foundation, not the demo.** Every part of Qalaam is designed to last five years, not look great in a one-minute screen recording. We choose the slower, sturdier, more correct path almost every time. The data layer comes from a license-clean open canonical source (Tarteel's open Quranic Universal Library, the open quran-align timing files, the open quran-tajweed annotations). The architecture is modular so we can swap any part without breaking anything else. The privacy guarantee (audio never leaves the device) is enforced *structurally*, not by policy. Every significant decision is recorded as an Architecture Decision Record so future contributors can see *why*, not just *what*.

**Adab matters as much as technology.** The way the product feels — quiet, dignified, family-private, never gamifying worship — is part of the architecture, not skin on top. We won't ship anything that disrespects the practice, no matter how clever it is. We won't put coins on a child's recitation. We won't put a leaderboard on a family's Hifdh. We won't ship an "AI sheikh" that risks misquoting the Quran. We won't ship voice cloning of a living scholar without their consent. These aren't trade-offs we'll relax under growth pressure — they're constitutional.

---

## What we don't do (on purpose)

To be clear about the things you will *not* find in Qalaam — because each is a deliberate choice:

- **No public leaderboards.** Family-private only. Showing off recitation can become riya', and we won't engineer toward that.
- **No XP / coins / gems / mascots / cartoon characters.** Streaks with grace days are the ceiling.
- **No real-time parent surveillance of children's mistakes.** Daily summaries only.
- **No always-on microphones in bedrooms.** Push-to-talk or session-bounded, never ambient.
- **No AI chat about the meaning of the Quran.** Current AI hallucinates Quranic text — we won't risk it.
- **No selling, profiling, or biometrically fingerprinting your audio.** Period.
- **No mid-recitation interruptions from the AI.** Feedback comes after, never during.
- **No cloning of named reciters without their explicit consent.** We're pursuing licensing properly.
- **No ads on the Quran.** Free tier is genuinely free.
- **No machine-translated UI strings shipping as official.** Translations come from native-speaker contributors with a tone guide.
- **No locked-down ecosystem.** Your data is yours. You can export, delete, self-host, or migrate at any time.

---

## What success looks like

In a year:

- Ten thousand families using Qalaam regularly.
- A thousand of them paying — keeping the project sustainable without ads.
- Five hundred of them on family plans, with multiple children memorizing.
- One hundred Hifdh academies using the classroom mode for their students.
- The integration on the Home Assistant Community Store with great reviews from people who actually live in Muslim households.
- A small number of reciters formally licensed for voice cloning, the first of their kind, paid fairly.
- A growing library of community-contributed translations and tafsirs.
- A genuinely happy, calm, growing community of users who feel respected.
- Children who memorized the Quran with a bit of help from this tool — and who don't grow up associating that practice with a streak counter or a cartoon owl.

In three years:

- The default Quran companion in Muslim homes that have any smart-home setup.
- A teaching tool used by mosques and madrasas around the world.
- The first product to sustainably ship licensed AI voice-cloning of Quran reciters with full scholarly and legal cover.
- A whole generation of Hifdh students whose first AI tutor was kind, private, and built with adab.

That's Qalaam.

A Quran companion the way a Muslim family actually lives with the Quran — read, listened to, memorized, woven into the rhythm of the home, respected, private, and beautiful.

In sha Allah, may He grant this work tawfeeq, and accept it from the hands that build it and the hearts that use it.
