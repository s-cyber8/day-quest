// Props for the mini-games. Wherever the supplied sprite sheets have the object, the prop is the 3D sprite; the rest are flat SVG
// (no emoji: they render differently on iOS/Android).
import { spr } from './sprites';
const svg = (inner: string, vb = '0 0 100 100', cls = 'prop') =>
  `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" draggable="false">${inner}</svg>`;

export const P = {
  spoon: () => spr('food', 'spoon'),
  fork: () => spr('food', 'fork'),
  apple: () => spr('food', 'apple'),
  pillow: () => spr('bedroom', 'pillow'),
  curtains: () => spr('bedroom', 'curtains'),
  toothpaste: () => spr('teeth', 'toothpaste'),
  sponge: () => spr('bath', 'sponge'),
  foam: () => spr('bath', 'foam'),
  towel: () => spr('bath', 'towel'),
  cone: () => spr('sports', 'cone'),
  monkey: () => spr('sports', 'monkey-bars'),
  trophy: () => spr('rewards', 'trophy'),
  heart: () => spr('rewards', 'heart'),
  rainbow: () => spr('rewards', 'rainbow'),
  aviv: () => spr('chars', 'aviv'),
  tooth: () => spr('teeth', 'mouth'),
  germ: (c = '') => spr('teeth', `germ-${1 + ([...c].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4)}`),
  brush: () => spr('teeth', 'toothbrush'),
  shirt: () => spr('clothes', 'shirt-argentina'),
  shorts: () => spr('clothes', 'shorts-navy'),
  sock: () => spr('clothes', 'socks'),
  shoe: () => spr('clothes', 'sneakers'),
  bowl: () => spr('food', 'cereal-bowl'),
  bowlFull: () => spr('food', 'cereal-bowl'),
  cereal: () => spr('food', 'cereal-bowl'),
  milk: () => spr('food', 'milk'),
  toast: () => spr('food', 'toast'),
  plate: () => spr('food', 'plate'),
  plateFull: () => spr('food', 'plate'),
  broccoli: () => spr('food', 'broccoli'),
  chicken: () => spr('food', 'chicken'),
  sweet: () => spr('food', 'sweet-potato'),
  glass: (_level = 1) => spr('food', 'water-glass'),
  /** the calm corner's drinking glass: a drawn glass whose water level is animated (.water rect) */
  glassSvg: (level = 1) => svg(`<defs><clipPath id="gl"><path d="M26 16 H74 L68 88 H32Z"/></clipPath></defs><path d="M26 16 H74 L68 88 H32Z" fill="#eaf7ff" opacity=".6"/><g clip-path="url(#gl)"><rect class="water" x="20" y="${16 + 72 * (1 - level)}" width="60" height="${72 * level + 2}" fill="#8fd0f0" opacity=".85"/></g><path d="M26 16 H74 L68 88 H32Z" fill="none" stroke="#bcd8e8" stroke-width="3"/>`),
  football: () => spr('sports', 'football'),
  goal: () => spr('sports', 'goal', 'goal'),
  goalie: () => spr('chars', 'aviv'),
  bubble: () => spr('bath', `bubble-${1 + Math.floor(Math.random() * 3)}`),
  lamp: (on = true) => spr('bedroom', on ? 'lamp-on' : 'lamp-off'),
  teddy: () => spr('toys', 'teddy'),
  star: (c = '#ffd966') => spr('rewards', 'star', c === '#ffd966' || c === '#fff3a8' ? '' : 'dimstar'),
  block: (c: string) => spr('toys', 'block-bar-green', 'stretch', `filter:hue-rotate(${([...c].reduce((a, ch) => a + ch.charCodeAt(0), 0) * 47) % 360}deg) saturate(1.1)`),
  duck: () => spr('bath', 'duck'),
  sun: () => svg(`<g stroke="#ffcf5a" stroke-width="6" stroke-linecap="round">${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return `<path d="M${50+Math.cos(a)*34} ${50+Math.sin(a)*34} L${50+Math.cos(a)*44} ${50+Math.sin(a)*44}"/>`}).join('')}</g><circle cx="50" cy="50" r="26" fill="#ffd966"/><circle cx="42" cy="47" r="3" fill="#7a4a1e"/><circle cx="58" cy="47" r="3" fill="#7a4a1e"/><path d="M42 58 Q50 65 58 58" stroke="#7a4a1e" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  cloud: () => svg(`<path d="M26 74 C10 74 8 50 28 48 C28 28 56 22 66 40 C86 36 96 62 80 74Z" fill="#fff" stroke="#c9dbea" stroke-width="3" stroke-linejoin="round"/>`),
  balloon: (c = '#ff9bb3') => svg(`<path d="M50 6 C78 6 90 30 84 52 C78 72 62 80 50 84 C38 80 22 72 16 52 C10 30 22 6 50 6Z" fill="${c}"/><path d="M50 84 L44 94 H56Z" fill="${c}"/><ellipse cx="34" cy="28" rx="7" ry="11" fill="#fff" opacity=".4" transform="rotate(25 34 28)"/>`, '0 0 100 100', 'prop balloon'),
  ball: () => svg(`<defs><radialGradient id="rb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="42" fill="#fff"/>${['#ff7f7f','#ffb866','#ffe066','#8fe08f','#7fc8ff','#c3a3ff'].map((c,i)=>`<path d="M50 50 L${50+42*Math.cos((i*60-90)*Math.PI/180)} ${50+42*Math.sin((i*60-90)*Math.PI/180)} A42 42 0 0 1 ${50+42*Math.cos(((i+1)*60-90)*Math.PI/180)} ${50+42*Math.sin(((i+1)*60-90)*Math.PI/180)}Z" fill="${c}"/>`).join('')}${Array.from({length:14},(_,i)=>`<circle cx="${50+22*Math.cos(i*0.9)*(0.4+i%3*0.3)}" cy="${50+22*Math.sin(i*0.9)*(0.4+i%3*0.3)}" r="4" fill="#fff" opacity=".35"/>`).join('')}<circle cx="50" cy="50" r="42" fill="url(#rb)"/>`),
  bed: () => svg(`<rect x="4" y="52" width="92" height="26" rx="8" fill="#9ab7e0"/><rect x="4" y="30" width="16" height="52" rx="6" fill="#7e9bc9"/><rect x="22" y="40" width="28" height="14" rx="7" fill="#fff"/><rect x="4" y="76" width="8" height="14" fill="#7e9bc9"/><rect x="88" y="76" width="8" height="14" fill="#7e9bc9"/>`),
  tile: (shape: 'sq' | 'tri' | 'rect', c: string) => {
    const hue = c.toLowerCase(); const warm = /ff[89a-c]|ffb|ffe|f[0-9a-f]{2}[0-7]/.test(hue);
    const pick = ([...c].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 2);
    const name = shape === 'sq' ? ['tile-square-red', 'tile-square-green'][pick] : shape === 'tri' ? ['tile-triangle-blue', 'tile-triangle-orange'][pick] : 'tile-flat-blue';
    void warm; return spr('toys', name);
  },
  cushion: () => spr('sports', 'cushion-blue'),
  gem: () => svg(`<path d="M50 10 L84 36 L50 90 L16 36Z" fill="#c3a3ff"/>`),
  medal: (_c = '') => spr('rewards', 'medal'),
  paw: () => svg(`<ellipse cx="50" cy="66" rx="22" ry="18" fill="currentColor"/><ellipse cx="22" cy="44" rx="9" ry="12" fill="currentColor" transform="rotate(-20 22 44)"/><ellipse cx="40" cy="26" rx="9" ry="12" fill="currentColor" transform="rotate(-6 40 26)"/><ellipse cx="60" cy="26" rx="9" ry="12" fill="currentColor" transform="rotate(6 60 26)"/><ellipse cx="78" cy="44" rx="9" ry="12" fill="currentColor" transform="rotate(20 78 44)"/>`),
  face: (kind: 'calm' | 'meh' | 'upset') => {
    const c = kind === 'calm' ? '#8fe0a8' : kind === 'meh' ? '#ffe28a' : '#ff9b9b';
    const mouth = kind === 'calm' ? 'M30 60 Q50 80 70 60' : kind === 'meh' ? 'M32 66 H68' : 'M32 72 Q50 54 68 72';
    const brows = kind === 'upset' ? '<path d="M28 34 L44 40 M72 34 L56 40" stroke="#4a3a2e" stroke-width="4" stroke-linecap="round"/>' : '';
    return svg(`<circle cx="50" cy="50" r="44" fill="${c}"/><circle cx="35" cy="44" r="5" fill="#4a3a2e"/><circle cx="65" cy="44" r="5" fill="#4a3a2e"/>${brows}<path d="${mouth}" stroke="#4a3a2e" stroke-width="4.5" fill="none" stroke-linecap="round"/>`);
  },
  cloudBtn: () => svg(`<path d="M26 74 C10 74 8 50 28 48 C28 28 56 22 66 40 C86 36 96 62 80 74Z" fill="#fff" stroke="#9ec7e6" stroke-width="4" stroke-linejoin="round"/><path d="M38 60 Q50 70 62 60" stroke="#7fb2d6" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="40" cy="52" r="3" fill="#7fb2d6"/><circle cx="60" cy="52" r="3" fill="#7fb2d6"/>`),
  gear: () => svg(`<circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="9"/><g stroke="currentColor" stroke-width="12" stroke-linecap="round">${Array.from({length:8},(_,i)=>{const a=i*45*Math.PI/180;return `<path d="M${50+Math.cos(a)*30} ${50+Math.sin(a)*30} L${50+Math.cos(a)*40} ${50+Math.sin(a)*40}"/>`}).join('')}</g>`),
  book: () => svg(`<path d="M10 20 C30 12 44 16 50 24 C56 16 70 12 90 20 V80 C70 72 56 76 50 84 C44 76 30 72 10 80Z" fill="#ffb3c1" stroke="#e08aa0" stroke-width="3" stroke-linejoin="round"/><path d="M50 24 V84" stroke="#e08aa0" stroke-width="3"/>`),
  arrow: () => svg(`<path d="M62 18 L28 50 L62 82" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`),
  play: () => svg(`<path d="M32 18 L82 50 L32 82Z" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>`),
  check: () => svg(`<path d="M20 52 L42 74 L82 28" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`),
  mic: () => svg(`<rect x="38" y="10" width="24" height="46" rx="12" fill="currentColor"/><path d="M24 46 C24 68 76 68 76 46 M50 68 V88" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round"/>`),
  clock: () => spr('bedroom', 'alarm-clock'),
  raincoat: () => spr('clothes', 'raincoat-yellow'),
  pajamas: () => spr('clothes', 'pajamas'),
  banana: () => spr('food', 'banana'),
  egg: () => spr('food', 'apple'),
  juice: () => spr('food', 'water-glass'),
  carrot: () => spr('food', 'banana'),
  rice: () => spr('food', 'toast'),
  lollipop: () => spr('food', 'candy'),
  cake: () => spr('food', 'candy'),
  puddle: () => svg(`<ellipse cx="50" cy="62" rx="44" ry="16" fill="#8fd0f0"/><ellipse cx="38" cy="58" rx="14" ry="4" fill="#fff" opacity=".5"/>`),
  box: () => svg(`<rect x="12" y="30" width="76" height="58" rx="8" fill="#e8b575" stroke="#c98f4e" stroke-width="3"/><rect x="12" y="30" width="76" height="14" rx="6" fill="#d9a05a"/>`),
  retry: () => svg(`<path d="M78 50 A28 28 0 1 1 62 24" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/><path d="M52 8 L68 24 L50 38" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`),
  finger: () => svg(`<circle cx="50" cy="50" r="40" fill="#ffd9bf"/>`),
};
