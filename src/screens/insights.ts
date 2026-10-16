// Parent mode: "What we're learning". Plain-Hebrew patterns from the local story play log. Choices in a game, not a diagnosis.
import { h } from '../core/dom';
import { loadPlays, PlayLog } from '../core/stories-store';
import { STORIES, FEELINGS, FeelKey } from '../content/stories';
import { sfx } from '../core/audio';

export const DISCLAIMER = 'אלה בחירות במשחק, לא אבחון. כדאי לשוחח עליהן עם רפאל, ואם יש מטפלת – לשתף אותה.';
const WHEN: Record<string, string> = {
  s01: 'כשמישהו הורס לו משהו', s02: 'כשקוראים לו באמצע משחק', s03: 'כשחוטפים לו את הכדור', s04: 'כשחבר נופל', s05: 'כשרוצה להפתיע חבר',
  s06: 'בזמן מפגש בגן', s07: 'כשצריך לעצור משחק לאמבטיה', s08: 'בארוחת ערב', s09: 'מול צנצנת הממתקים', s10: 'כשאומרים לו לא', s11: 'כשחבר מבקש לשחק', s12: 'כשצריך לחכות בתור',
};
const FEEL_HE = Object.fromEntries(FEELINGS.map((f) => [f.key, f.label])) as Record<FeelKey, string>;
const INT_HE = { little: 'קצת', lot: 'הרבה' };
const num = (sid: string) => Number(sid.slice(1));
const titleOf = (sid: string) => STORIES.find((s) => s.id === sid)!.title;
export const choiceLabel = (p: PlayLog) => (p.choice === 'good' ? 'בחירה טובה' : p.choice === 'bad' ? 'בחירה לא טובה' : p.third === 'words' ? 'אמר במילים (טוב)' : 'התעלם (לא טוב)');
const when = (t: number) => { const d = new Date(t); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export interface Pattern { text: string; kind: 'info' | 'warn' | 'good' }
/** pure: computes the pattern sentences from a play log */
export function patterns(plays: PlayLog[]): Pattern[] {
  const out: Pattern[] = [];
  const by = (sid: string) => plays.filter((p) => p.story === sid).sort((a, b) => a.t - b.t);
  for (const s of STORIES) {
    const all = by(s.id); const last = all.slice(-5); if (last.length < 2) continue;
    // most common feeling+intensity among the last plays
    const tally = new Map<string, number>(); last.forEach((p) => tally.set(`${p.feeling}|${p.intensity}`, (tally.get(`${p.feeling}|${p.intensity}`) ?? 0) + 1));
    const [top, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 2) { const [f, i] = top.split('|'); out.push({ kind: f === 'angry' || f === 'scared' ? 'warn' : 'info', text: `${WHEN[s.id]} (סיפור ${num(s.id)}): ב-${n} מתוך ${last.length} פעמים בחר ${FEEL_HE[f as FeelKey]}-${INT_HE[i as 'lot' | 'little']}` }); }
    const bad = last.filter((p) => !p.good).length;
    if (bad >= 2) out.push({ kind: 'warn', text: `${WHEN[s.id]} (סיפור ${num(s.id)}): ב-${bad} מתוך ${last.length} פעמים בחר קודם בבחירה הלא טובה${last.filter((p) => !p.good && p.repaired).length ? ', ובדרך כלל תיקן אחר כך' : ''}` });
    if (all.length >= 4) { // improvement over time: older half vs newer half
      const h2 = Math.floor(all.length / 2); const a = all.slice(0, h2), b = all.slice(h2);
      const ra = a.filter((p) => p.good).length / a.length, rb = b.filter((p) => p.good).length / b.length;
      if (rb - ra >= 0.3) out.push({ kind: 'good', text: `שיפור ב${titleOf(s.id)} (סיפור ${num(s.id)}): בפעמים האחרונות בחר טוב ב-${b.filter((p) => p.good).length} מתוך ${b.length}, לעומת ${a.filter((p) => p.good).length} מתוך ${a.length} בהתחלה` });
    }
  }
  const strong = plays.filter((p) => (p.feeling === 'angry' || p.feeling === 'scared') && p.intensity === 'lot');
  if (strong.length) {
    const ids = [...new Set(strong.map((p) => p.story))].sort(); const angry = strong.filter((p) => p.feeling === 'angry').length, scared = strong.length - angry;
    out.unshift({ kind: 'warn', text: `כעס גדול או פחד גדול: ${strong.length} פעמים${angry ? ` (כעס ${angry})` : ''}${scared ? ` (פחד ${scared})` : ''}, בסיפורים ${ids.map((i) => num(i)).join(', ')}` });
  }
  const sorted = [...plays].sort((a, b) => a.t - b.t);
  if (sorted.length >= 8) {
    const k = Math.floor(sorted.length / 2); const r = (l: PlayLog[]) => l.filter((p) => p.good).length / l.length;
    const d = r(sorted.slice(k)) - r(sorted.slice(0, k));
    if (d >= 0.2) out.push({ kind: 'good', text: `בסך הכול: בחצי האחרון של המשחקים רפאל בחר בחירה טובה בפעם הראשונה יותר מאשר בחצי הראשון (${Math.round(r(sorted.slice(k)) * 100)}% לעומת ${Math.round(r(sorted.slice(0, k)) * 100)}%)` });
  }
  const rew = plays.filter((p) => p.rewinds > 0).length;
  if (rew >= 2) out.push({ kind: 'info', text: `חזר אחורה כדי לבחור אחרת ב-${rew} משחקים. זה סימן טוב: הוא מנסה לתקן` });
  return out;
}

export function summaryText(plays: PlayLog[]): string {
  const lines = ['הסיפורים של רפאל: מה אנחנו לומדים', DISCLAIMER, ''];
  const pat = patterns(plays);
  lines.push(...(pat.length ? pat.map((p) => `• ${p.text}`) : ['עדיין אין מספיק משחקים כדי לראות דפוסים.']), '');
  for (const s of STORIES) {
    const l = plays.filter((p) => p.story === s.id).sort((a, b) => a.t - b.t).slice(-5); if (!l.length) continue;
    lines.push(`סיפור ${num(s.id)} – ${s.title}:`);
    l.forEach((p) => lines.push(`  ${when(p.t)} · ${FEEL_HE[p.feeling]}-${INT_HE[p.intensity]} · ${choiceLabel(p)}${p.repaired ? ' · תיקן' : ''}${p.rewinds ? ` · חזר אחורה ×${p.rewinds}` : ''} · ${Math.round(p.ms / 1000)} שנ׳`));
  }
  return lines.join('\n');
}

export function renderInsights(onClose: () => void): HTMLElement {
  const plays = loadPlays();
  const root = h('div', { class: 'parent insights', 'data-testid': 'insights', 'data-screen': 'insights' });
  root.append(h('div', { class: 'topbtns' }, h('button', { class: 'pbtn on', 'data-testid': 'insights-close', onclick: () => { root.remove(); onClose(); } }, 'חזרה לאזור ההורים')), h('h1', {}, 'מה אנחנו לומדים'));
  root.append(h('div', { class: 'help disclaimer', 'data-testid': 'disclaimer' }, DISCLAIMER));
  root.append(h('h2', {}, 'דפוסים'));
  const pat = patterns(plays);
  if (!pat.length) root.append(h('div', { class: 'log' }, plays.length ? 'עדיין אין מספיק משחקים (לפחות שניים באותו סיפור) כדי לראות דפוסים.' : 'עדיין לא שוחקו סיפורים.'));
  pat.forEach((p) => root.append(h('div', { class: 'log pat ' + p.kind, 'data-testid': 'pattern' }, p.text)));
  root.append(h('h2', {}, '5 המשחקים האחרונים בכל סיפור'));
  STORIES.forEach((s) => {
    const l = plays.filter((p) => p.story === s.id).sort((a, b) => b.t - a.t).slice(0, 5); if (!l.length) return;
    const box = h('div', { class: 'log', 'data-testid': 'story-log-' + s.id }, h('b', {}, `סיפור ${num(s.id)} – ${s.title}`));
    l.forEach((p) => {
      const hot = (p.feeling === 'angry' || p.feeling === 'scared') && p.intensity === 'lot';
      box.append(h('div', { class: 'prow' + (hot ? ' hot' : '') + (!p.good ? ' bad' : '') }, `${when(p.t)} · ${FEEL_HE[p.feeling]}-${INT_HE[p.intensity]} · ${choiceLabel(p)}${p.repaired ? ' · תיקן' : ''}${p.rewinds ? ` · חזר אחורה ×${p.rewinds}` : ''} · ${Math.round(p.ms / 1000)} שנ׳`));
    });
    root.append(box);
  });
  const status = h('div', { class: 'help', 'data-testid': 'copy-status', style: 'margin-top:10px' }, '');
  root.append(h('div', { class: 'topbtns', style: 'margin-top:14px' }, h('button', { class: 'pbtn on', 'data-testid': 'copy-summary', onclick: async () => {
    sfx.tap(); const t = summaryText(plays);
    try { await navigator.clipboard.writeText(t); status.textContent = 'הסיכום הועתק'; } catch {
      const ta = h('textarea', { style: 'position:fixed;left:-999px' }) as HTMLTextAreaElement; ta.value = t; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); status.textContent = 'הסיכום הועתק'; } catch { status.textContent = 'לא הצלחנו להעתיק'; } ta.remove();
    }
  } }, 'העתקת סיכום כטקסט')), status);
  return root;
}
