import { h } from '../core/dom';
import { PHRASES, PHRASE_IDS } from '../content/phrases';
import { STATIONS, stationById } from '../content/stations';
import { settings, saveSettings, day, saveDay, loadLog, resetToday, resetEverything, recPut, recDel, recKeys, recGet, Rec } from '../core/storage';
import { applyVolume, sfx } from '../core/audio';
import { speak, stopSpeaking, hasHebrewVoice, testSound, dropRecordingCache, playBundled } from '../core/speech';
import { resetProg, getProg } from '../core/storage';
import { currentStation } from './map';

const WD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const FEEL: Record<string, string> = { calm: 'רגוע', meh: 'בינוני', upset: 'עדיין כועס', left: 'יצא', unknown: '—' };
const ACT: Record<string, string> = { water: 'מים', ball: 'כדור', pet: 'ללטף את מוקה', breath: 'בלון' };

function pickMime(): string {
  const c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return c.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) ?? '';
}

export function renderParent(onClose: () => void, apply: () => void): HTMLElement {
  const root = h('div', { class: 'parent', 'data-screen': 'parent', 'data-testid': 'parent' });
  const section = (t: string) => root.append(h('h2', {}, t));
  const row = (label: string, ctl: HTMLElement) => root.append(h('div', { class: 'row' }, h('label', {}, label), ctl));
  const close = () => { stopSpeaking(); saveSettings(); apply(); onClose(); };

  root.append(h('div', { class: 'topbtns' }, h('button', { class: 'pbtn on', 'data-testid': 'parent-close', onclick: close }, 'סגירה וחזרה')), h('h1', {}, 'אזור הורים'));

  // --- today
  section('היום');
  const cur = currentStation();
  const todayBox = h('div', { class: 'row' });
  const renderToday = () => {
    todayBox.replaceChildren(h('label', {}, cur ? `תחנה נוכחית: ${cur.id}. ${cur.label}` : 'כל התחנות הושלמו'));
    if (cur) todayBox.append(h('button', { class: 'pbtn', 'data-testid': 'skip-station', onclick: () => { day.skipped.push(cur.id); saveDay(); close(); } }, 'דלג על התחנה'));
  };
  renderToday(); root.append(todayBox);

  // --- active stations per weekday
  section('תחנות פעילות לפי יום בשבוע');
  let wd = new Date().getDay();
  const tabs = h('div', { class: 'tabs' }); const list = h('div');
  const renderDays = () => {
    tabs.replaceChildren(...WD.map((n, i) => h('button', { class: i === wd ? 'on' : '', onclick: () => { wd = i; renderDays(); } }, n)));
    list.replaceChildren(...STATIONS.map((s) => {
      const on = (settings.days[wd] ?? []).includes(s.id);
      const cb = h('input', { type: 'checkbox', 'data-testid': `st-${s.id}` }) as HTMLInputElement; cb.checked = on;
      cb.onchange = () => { const set = new Set(settings.days[wd] ?? []); cb.checked ? set.add(s.id) : set.delete(s.id); settings.days[wd] = [...set].sort((a, b) => a - b); saveSettings(); };
      return h('label', { class: 'st' }, cb, h('span', {}, `${s.id}. ${s.label}`));
    }));
  };
  renderDays(); root.append(tabs, list);

  // --- settings
  section('הגדרות');
  
  const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(settings.volume), 'data-testid': 'volume' }) as HTMLInputElement;
  vol.oninput = () => { settings.volume = +vol.value; applyVolume(); }; vol.onchange = () => { saveSettings(); sfx.chime(0); };
  row('עוצמת קול', vol);
  const unlock = h('input', { type: 'time', value: settings.unlock, 'data-testid': 'unlock-time' }) as HTMLInputElement;
  unlock.onchange = () => { if (unlock.value) { settings.unlock = unlock.value; saveSettings(); } };
  row('היום החדש מתחיל ב־ (ההתקדמות מתאפסת אוטומטית)', unlock);
  const pin = h('input', { type: 'password', inputmode: 'numeric', maxlength: '4', placeholder: 'ללא', value: settings.pin, 'data-testid': 'pin-input' }) as HTMLInputElement;
  pin.onchange = () => { const v = pin.value.replace(/\D/g, '').slice(0, 4); if (v.length === 4 || v === '') { settings.pin = v; saveSettings(); } else pin.value = settings.pin; };
  row('קוד הורה (4 ספרות, ריק = ללא)', pin);
  const num = (label: string, key: 'rageTaps' | 'rageWindowMs' | 'missStreak' | 'cooldownMin', min: number, max: number, step = 1) => {
    const i = h('input', { type: 'number', min: String(min), max: String(max), step: String(step), value: String(settings[key]), 'data-testid': key }) as HTMLInputElement;
    i.onchange = () => { const v = Math.min(max, Math.max(min, +i.value || min)); settings[key] = v; i.value = String(v); saveSettings(); };
    row(label, i);
  };
  num('הקשות זעם לפני הצעה לפינה השקטה', 'rageTaps', 3, 15);
  num('חלון זמן להקשות (מילישניות)', 'rageWindowMs', 500, 4000, 100);
  num('החטאות רצופות לפני הצעה', 'missStreak', 2, 8);
  num('מרווח בין הצעות אוטומטיות (דקות)', 'cooldownMin', 0, 30);
  const rm = h('input', { type: 'checkbox', style: 'width:26px;height:26px', 'data-testid': 'rm' }) as HTMLInputElement; rm.checked = settings.reducedMotion;
  rm.onchange = () => { settings.reducedMotion = rm.checked; saveSettings(); apply(); };
  row('הפחתת תנועה (מצב רגוע במיוחד)', rm);

  // --- game levels
  section('רמות המשחקים');
  root.append(h('div', { class: 'help' }, 'כל משחק מתחיל ברמה 2 כברירת מחדל ומתאים את עצמו: שתי הצלחות ברצף מעלות רמה, שתי כישלונות מורידות. כאן אפשר לקבוע רמת התחלה לכל משחק.'));
  STATIONS.forEach((s) => {
    const sel = h('select', { 'data-testid': 'lvl-' + s.game }, ...[1, 2, 3].map((n) => h('option', { value: String(n) }, 'רמה ' + n))) as HTMLSelectElement;
    sel.value = String(settings.startLevel[s.game] ?? 2);
    sel.onchange = () => { settings.startLevel[s.game] = +sel.value; saveSettings(); };
    const cur = getProg(s.game);
    row(`${s.id}. ${s.label} (עכשיו: רמה ${cur.level})`, sel);
  });
  root.append(h('div', { class: 'topbtns' }, h('button', { class: 'pbtn danger', 'data-testid': 'reset-levels', onclick: () => { resetProg(); close(); } }, 'איפוס כל הרמות')));

  // --- sound test
  section('בדיקת צליל');
  const rep = h('div', { class: 'help', 'data-testid': 'sound-report' }, 'לחצו כדי לשמוע קטע דיבור וצליל, ולראות באיזו דרך הושמע הדיבור.');
  root.append(h('div', { class: 'topbtns' }, h('button', { class: 'pbtn on', 'data-testid': 'test-sound', onclick: async () => { rep.textContent = 'מנגן…'; rep.textContent = await testSound(); } }, 'בדיקת צליל')), rep);

  // --- voice
  section('הקלטת קולות (אופציונלי)');
  root.append(h('div', { class: 'help' }, `ההקלטות נשמרות רק במכשיר הזה ולא יוצאות ממנו. סדר ההשמעה: הקלטה שלך ← קול עברי של המכשיר ← טקסט וצליל עדין.${hasHebrewVoice() ? '' : ' שים לב: במכשיר הזה לא נמצא קול עברי, ולכן מומלץ להקליט.'}`));
  const phrases = h('div');
  root.append(phrases);
  let recorder: MediaRecorder | null = null;
  const renderPhrases = async () => {
    const have = new Set((await recKeys()).map(String));
    phrases.replaceChildren();
    let lastGroup = '';
    for (const id of PHRASE_IDS) {
      const ph = PHRASES[id];
      if (ph.group !== lastGroup) { lastGroup = ph.group; phrases.append(h('div', { class: 'grp' }, ph.group)); }
      const has = have.has(id);
      const recBtn = h('button', { class: 'rec', 'data-testid': 'rec-' + id }, has ? 'הקלט מחדש' : 'הקלט');
      recBtn.onclick = async () => {
        if (recorder) { recorder.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mime = pickMime(); const chunks: Blob[] = [];
          recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          recorder.onstop = async () => {
            stream.getTracks().forEach((t) => t.stop());
            const type = recorder?.mimeType || mime || 'audio/mp4'; recorder = null;
            await recPut(id, { blob: new Blob(chunks, { type }), mime: type } as Rec); dropRecordingCache(id); renderPhrases();
          };
          recorder.start(); recBtn.textContent = 'עצור'; recBtn.classList.add('recording');
        } catch { recBtn.textContent = 'אין הרשאת מיקרופון'; }
      };
      const play = h('button', { onclick: () => speak(id), 'data-testid': 'play-' + id }, 'השמע');
      const orig = h('button', { onclick: () => playBundled(id), 'data-testid': 'orig-' + id }, 'מקורי');
      const del = h('button', { onclick: async () => { await recDel(id); dropRecordingCache(id); renderPhrases(); } }, 'מחק');
      phrases.append(h('div', { class: 'phr' }, h('div', { class: 'tx' }, (has ? '● ' : '') + (ph.speaker === 'moka' ? '[מוקה] ' : '') + ph.text), h('div', { class: 'acts' }, orig, recBtn, play, has ? del : null)));
    }
  };
  renderPhrases(); void recGet;

  // --- log
  section('יומן (14 הימים האחרונים)');
  const log = loadLog().slice().reverse();
  if (!log.length) root.append(h('div', { class: 'log' }, 'אין עדיין נתונים'));
  log.forEach((d) => root.append(h('div', { class: 'log', 'data-testid': 'log-day' },
    h('b', {}, d.key), h('div', {}, `תחנות שהושלמו: ${d.stations.length ? d.stations.map((i) => stationById(i).label).join(', ') : '—'}`),
    ...d.calm.map((c) => h('div', {}, `פינה שקטה ${new Date(c.t).toTimeString().slice(0, 5)} · ${c.activity.split('+').map((a) => ACT[a] ?? a).join(', ')} · כניסה: ${c.source === 'self' || (!c.auto && !c.source) ? 'ביוזמת רפאל' : c.source === 'fails' ? 'אחרי ניסיונות במשחק' : 'הצעה אוטומטית'} · אחרי: ${FEEL[c.after] ?? c.after}${c.medal ? ' · מדליה' : ''}`)))));
  let armed = '';
  const dangerBtn = (label: string, key: string, fn: () => void, id: string) => {
    const b = h('button', { class: 'pbtn danger', 'data-testid': id }, label);
    b.onclick = () => { if (armed !== key) { armed = key; b.textContent = 'בטוח? לחץ שוב'; setTimeout(() => { if (armed === key) { armed = ''; b.textContent = label; } }, 4000); return; } fn(); close(); };
    return b;
  };
  root.append(h('div', { class: 'topbtns', style: 'margin-top:14px' }, dangerBtn('איפוס היום', 'today', resetToday, 'reset-today'), dangerBtn('איפוס הכל', 'all', resetEverything, 'reset-all')));

  // --- help
  section('עזרה');
  root.append(h('div', { class: 'help' },
    h('b', {}, 'התקנה באייפון: '), 'פתחו את הקישור ב-Safari ← כפתור השיתוף ← "הוסף למסך הבית". ',
    h('br'), h('b', {}, 'התקנה באנדרואיד: '), 'ב-Chrome ← תפריט (שלוש נקודות) ← "התקן אפליקציה" / "הוסף למסך הבית". ',
    h('br'), 'אחרי הפתיחה הראשונה האפליקציה עובדת גם בלי אינטרנט (מצב טיסה).',
    h('br'), h('b', {}, 'להישאר באפליקציה: '), 'באייפון – הגדרות ← נגישות ← גישה מודרכת (Guided Access), ואז לחיצה שלישית על כפתור הצד. באנדרואיד – הגדרות ← אבטחה ← הצמדת אפליקציה (Screen pinning), ואז מסך האפליקציות האחרונות ← סמל האפליקציה ← "הצמד".',
    h('br'), h('b', {}, 'מהלך תחנה: '), 'הכרזה ← רפאל עושה את המשימה באמת ← ההורה לוחץ ארוכות על הכפה (3 שניות) ← התחנה הושלמה, וחגיגה ומשחק קצר שמרוויח כוכבים (אפשר לצאת מהמשחק בכל רגע).',
    h('br'), h('b', {}, 'סדר חופשי: '), 'כל התחנות במפה פתוחות בכל זמן ובכל סדר. התחנה הבאה לפי הסדר זוהרת ורפאל עומד בה, כדי שהשגרה תישאר צפויה. אפשר לשחק שוב תחנות שהושלמו כדי לאסוף כוכבים. אין נעילה בלילה: אחרי תחנת השינה יש סצנת לילה רגועה, וכל נגיעה (או כפתור החזרה) חוזרת למפה. ההתקדמות מתאפסת אוטומטית בשעת "היום החדש מתחיל".'));
  return root;
}
