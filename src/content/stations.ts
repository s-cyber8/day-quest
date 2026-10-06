export interface Station {
  id: number;
  label: string; // exactly as on Rafael's printed board
  image: string; // under assets/schedule
  announce: string; // phrase ids
  go: string;
  labelId: string;
  game: string; // key in games registry
}

const defs: [number, string, string, string][] = [
  [1, 'מתעורר בבוקר', '01-wake-up', 'wake'],
  [2, 'מצחצח שיניים', '02-brush-teeth', 'teeth'],
  [3, 'מתלבש', '03-get-dressed', 'dress'],
  [4, 'אוכל ארוחת בוקר', '04-breakfast', 'breakfast'],
  [5, 'הולך לגן', '05-walk-to-kindergarten', 'walk'],
  [6, 'מתנהג יפה בגן', '06-kindergarten-behave', 'tower'],
  [7, 'משחק בחוג כדורגל', '07-football-class', 'football'],
  [8, 'מתאמן בחוג נינג׳ה', '08-ninja-class', 'ninja'],
  [9, 'משחק חופשי בקוביות', '09-free-play-blocks', 'build'],
  [10, 'משחק קופסה', '10-board-game', 'memory'],
  [11, 'אוכל ארוחת ערב', '11-dinner', 'dinner'],
  [12, 'מתרחץ באמבטיה', '12-bath', 'bath'],
  [13, 'הולך לישון', '13-sleep', 'sleep'],
];

export const STATIONS: Station[] = defs.map(([id, label, image, game]) => ({
  id, label, image, game,
  announce: `st.${id}.announce`,
  go: `st.${id}.go`,
  labelId: `st.${id}.label`,
}));

export const stationById = (id: number) => STATIONS.find((s) => s.id === id)!;
export const imgOf = (s: Station) => `${import.meta.env.BASE_URL}assets/schedule/${s.image}.webp`;
export const asset = (p: string) => `${import.meta.env.BASE_URL}assets/${p}`;
