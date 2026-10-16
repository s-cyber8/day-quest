// Cut-out 3D sprites (public/assets/game/sprites/<sheet>/<name>.png) and stage backgrounds (public/assets/game/bg/<name>.webp).
const B = () => import.meta.env.BASE_URL;
export const sprUrl = (sheet: string, name: string) => `${B()}assets/game/sprites/${sheet}/${name}.png`;
/** <img> markup that fills its box (same slot an SVG prop used to fill). */
export const spr = (sheet: string, name: string, cls = '', style = '') =>
  `<img class="prop spr ${cls}" src="${sprUrl(sheet, name)}" alt="" draggable="false"${style ? ` style="${style}"` : ''}>`;
export const bgUrl = (name: string) => `${B()}assets/game/bg/${name}.webp`;

export const GAME_BG: Record<string, string> = {
  wake: 'bedroom-morning', teeth: 'bathroom-sink', dress: 'bedroom-morning', breakfast: 'kitchen', walk: 'street-kindergarten', tower: 'kindergarten-playroom',
  football: 'football-pitch', ninja: 'ninja-gym', build: 'kindergarten-playroom', memory: 'kindergarten-playroom', dinner: 'kitchen', bath: 'bathtub', sleep: 'bedroom-night',
};
/** vertical anchor of the cover-fitted background per game (0 = top of the picture, 1 = bottom): keeps the relevant part in view */
export const GAME_BG_Y: Record<string, number> = { wake: 0.12, dress: 0.45, sleep: 0.22, bath: 0 };
