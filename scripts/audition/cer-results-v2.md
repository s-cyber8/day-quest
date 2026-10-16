# Voice audition v2 - eleven_v3, stability 0.3, similarity 0.8, speaker boost on

Local faster-whisper large-v3 (language=he) CER, 4 tagged test lines per candidate. CER = Levenshtein / intended length after stripping niqqud, punctuation, audio tags, whitespace.

## Per-voice results

| role | voice | clips | avg CER % | worst % | description |
|---|---|---|---|---|---|
| narrator | noa | 4 | 4.60 | 9.1 | Noa - Warm, Patient Narrator (he, Jerusalem-standard, slow, warm) |
| narrator | tamar | 4 | 3.90 | 9.1 | Tamar - Gentle, Confident Ad (he, breathy, light, relaxed) |
| narrator | yael | 4 | 3.90 | 9.1 | Yael - Gentle, Confident Ad (he, breathy, light, relaxed) |
| narrator | tami1 | 4 | 1.63 | 6.5 | tami1 (account voice, he, 35 y/o Israeli woman) - current narrator |
| moka | maya | 4 | 5.28 | 18.8 | Maya - Cheerful, Friendly Creator (he, bright, light, Tel Aviv, "cheerful and friendly") |
| moka | shira | 4 | 4.32 | 12.5 | Shira - Cheerful Social Creator (he, bright, light, Tel Aviv, "quick cuts, quick charm") |
| moka | bella | 4 | 13.61 | 35.7 | Bella (premade, English voice speaking Hebrew) - current Moka |

## Decision rule (as specified)

Among voices within 3 CER points of the best, prefer native Hebrew; for Moka prefer the warmer, younger-sounding one by voice description.

**narrator**: best = tami1 (1.63); within 3 points: tami1 1.63, tamar 3.90, yael 3.90, noa 4.60; excluded: none.
**moka**: best = shira (4.32); within 3 points: shira 4.32, maya 5.28; excluded: bella 13.61.

- **Narrator -> tami1 (unchanged).** All four narrator candidates are native-Hebrew voices and all land within 3 points of the best (tami1 1.63; Yael/Tamar 3.91; Noa 4.60), so the native-Hebrew preference does not separate them; the remaining tie-break is the lowest CER. The gap is one clip: the day line with the name רפאל, which Whisper mishears for every voice except tami1 (it is a recogniser weakness with that name, not an audible defect). Keeping tami1 means no voice change for the narrator.
- **Moka -> Maya (changed from Bella).** Bella is an English premade voice speaking Hebrew: 13.6 avg CER and a 35.7% clip, outside the 3-point band. Shira (4.3) and Maya (5.3) are both inside it and both native Hebrew; by description Maya is the warmer one ("Cheerful and friendly", younger social-creator register) while Shira is described by speed ("quick cuts, quick reactions, quick charm"). **Voice change flagged: Moka Bella -> Maya.** Same model, same credit rate.

## Tag format check (Noa, same line)

`[excited, proud] ...` and `[excited][proud] ...` both transcribed without any tag words (CER 0.0 both), so the comma form from stories.he.md is used as written.

## Credits

v3 is billed at ~0.5 credit per spoken character here (character-cost header); tags are not billed. The audition used 666 credits. The API key has no `user_read` permission, so remaining credits cannot be queried: usage is counted in `audio-work/ledger-v2.json` from every call and generation stops before 28,000.

## Every clip

| clip | intended | heard | CER % |
|---|---|---|---|
| narrator__noa__story.mp3 | [storytelling] רפאל בנה מגדל גבוה מקוביות. אביב רץ לידו... ובטעות, המגדל נפל! | רפאל בנה מגדל גבוה מקוביות, אביו רץ לידו, ובטעות המגדל נפל. | 2.2 |
| narrator__noa__calm.mp3 | [calm, deliberate] רפאל עוצר, לוקח נשימה גדולה, ואומר: "נועה, אני שיחקתי בו. בואי נשחק בתורות." | אבל פעל עוצר לוקח נשימה גדולה ואומר, נועה, אני שיחקתי בו. בואי נשחק בתורות. | 7.1 |
| narrator__noa__cheer.mp3 | [excited] איזו בחירה טובה! | איזו בחירה טובה? | 0.0 |
| narrator__noa__day.mp3 | [warm, cheerful] רְפָאֵל, עכשיו מצחצחים שיניים! | לפעל, עכשיו מצחצחים שיניים. | 9.1 |
| narrator__tamar__story.mp3 | [storytelling] רפאל בנה מגדל גבוה מקוביות. אביב רץ לידו... ובטעות, המגדל נפל! | רפאל בנה מגדל גבוה מקוביות. אביו רץ לידו, ובתאות המגדל נפל. | 6.5 |
| narrator__tamar__calm.mp3 | [calm, deliberate] רפאל עוצר, לוקח נשימה גדולה, ואומר: "נועה, אני שיחקתי בו. בואי נשחק בתורות." | רפאל עוצר, לוקח נשימה גדולה ואומר נועה, אני שיחקתי בו. בואי נשחק בתורות. | 0.0 |
| narrator__tamar__cheer.mp3 | [excited] איזו בחירה טובה! | איזו בחירה טובה. | 0.0 |
| narrator__tamar__day.mp3 | [warm, cheerful] רְפָאֵל, עכשיו מצחצחים שיניים! | ופעל, עכשיו מצחצחים שיניים. | 9.1 |
| narrator__yael__story.mp3 | [storytelling] רפאל בנה מגדל גבוה מקוביות. אביב רץ לידו... ובטעות, המגדל נפל! | רפאל בנה מגדל גבוה מקוביות, אביו רץ לידו, ובתאות המגדל נפל. | 6.5 |
| narrator__yael__calm.mp3 | [calm, deliberate] רפאל עוצר, לוקח נשימה גדולה, ואומר: "נועה, אני שיחקתי בו. בואי נשחק בתורות." | רפאל עוצר, לוקח נשימה גדולה ואומר נועה, אני שיחקתי בו. בואי נשחק בתורות. | 0.0 |
| narrator__yael__cheer.mp3 | [excited] איזו בחירה טובה! | איזו בחירה טובה. | 0.0 |
| narrator__yael__day.mp3 | [warm, cheerful] רְפָאֵל, עכשיו מצחצחים שיניים! | ופעל, עכשיו מצחצחים שיניים. | 9.1 |
| narrator__tami1__story.mp3 | [storytelling] רפאל בנה מגדל גבוה מקוביות. אביב רץ לידו... ובטעות, המגדל נפל! | רפאל בנה מגדל גבוה מקוביות, אביו רץ לידו, ובתאות המגדל נפל. | 6.5 |
| narrator__tami1__calm.mp3 | [calm, deliberate] רפאל עוצר, לוקח נשימה גדולה, ואומר: "נועה, אני שיחקתי בו. בואי נשחק בתורות." | רפאל עוצר, לוקח נשימה גדולה ואומר, נועה, אני שיחקתי בו. בואי נשחק בתורות. | 0.0 |
| narrator__tami1__cheer.mp3 | [excited] איזו בחירה טובה! | איזו בחירה טובה. | 0.0 |
| narrator__tami1__day.mp3 | [warm, cheerful] רְפָאֵל, עכשיו מצחצחים שיניים! | רפאל עכשיו מצחצחים שיניים | 0.0 |
| moka__maya__ask.mp3 | [curious, gentle] מה רפאל מרגיש עכשיו? | מה לפייל מרגיש עכשיו? | 18.8 |
| moka__maya__scared.mp3 | [softly, reassuring] זה בסדר לפחד. אפשר לבקש עזרה ממבוגר. | זה בסדר לפחד. אפשר לבקש עזרה ממבוגר. | 0.0 |
| moka__maya__almost.mp3 | [playful, warm] כמעט! עוד פעם? | כמעט. עוד פעם? | 0.0 |
| moka__maya__big.mp3 | [slow, soothing] זה רגש גדול. בוא ניקח קודם נשימה ביחד... שואפים... ונושפים. | זה רגש גדול. בואו ניקח קודם נשימה ביחד, שואפים, ונושפים. | 2.4 |
| moka__shira__ask.mp3 | [curious, gentle] מה רפאל מרגיש עכשיו? | מה נפעל מרגיש עכשיו? | 12.5 |
| moka__shira__scared.mp3 | [softly, reassuring] זה בסדר לפחד. אפשר לבקש עזרה ממבוגר. | זה בסדר לפחד. אפשר לבקש עזרה ממבוגר. | 0.0 |
| moka__shira__almost.mp3 | [playful, warm] כמעט! עוד פעם? | כמעט! עוד פעם? | 0.0 |
| moka__shira__big.mp3 | [slow, soothing] זה רגש גדול. בוא ניקח קודם נשימה ביחד... שואפים... ונושפים. | זה רגש גדול. בואו ניקח קודם נשימה ביחד, שופים, ונושפים. | 4.8 |
| moka__bella__ask.mp3 | [curious, gentle] מה רפאל מרגיש עכשיו? | מה ריפייל מרגיש עכשיו? | 18.8 |
| moka__bella__scared.mp3 | [softly, reassuring] זה בסדר לפחד. אפשר לבקש עזרה ממבוגר. | אפשר לבקש עזרה ממבוגר. | 35.7 |
| moka__bella__almost.mp3 | [playful, warm] כמעט! עוד פעם? | כמעט. עוד פעם? | 0.0 |
| moka__bella__big.mp3 | [slow, soothing] זה רגש גדול. בוא ניקח קודם נשימה ביחד... שואפים... ונושפים. | זה רגש גדול. בוא ניקח קודם נשימה ביחד. שואפים ונושפים. | 0.0 |
| narrator__noa__fmt-comma.mp3 | [excited, proud] כל הכבוד, רפאל! בחרת נכון. | כל הכבוד רפאל, בחרת נכון. | 0.0 |
| narrator__noa__fmt-sep.mp3 | [excited][proud] כל הכבוד, רפאל! בחרת נכון. | כל הכבוד רפאל, בחרת נכון. | 0.0 |

## Full generation (257 clips: all Day phrases + all story and shared lines), eleven_v3, stability 0.3, similarity 0.8, speaker boost, per-phrase emotion tags

- Mean CER 1.82% over 257 clips; narrator: 1.95% (208 clips), moka: 1.26% (49 clips)
- First pass: 8 clips above 15%. Each got niqqud on the misheard word and was regenerated once (feel.n.angry, calm.pick, calm.breath.in, s03.bad.act, s05.bad.act dropped below 15%).
- Still above 15% after the single regeneration (not regenerated again, per the rule):

  - `g.4.done` 23.1%: intended "נאם נאם! בתיאבון!" / heard "נמנם בתיאבון."
  - `feel.n.disappointed` 16.7%: intended "מאוכזב" / heard "מאוחזב"
  - `s02.good.act` 17.2%: intended "רפאל עונה: "אני בא, אמא!" ושם את הכדור בצד." / heard "רפא אלונה, אני באה אמא, בסם את הכדור בצד."

Credits: 6,262 used by this work in total (audition 666 + generation 5,596) against the 28,000 stop; the key cannot read the account balance (no `user_read`).
