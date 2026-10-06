import { Game } from './engine';
import { wake, teeth, dress, breakfast } from './g1_4';
import { walk, tower, football, ninja } from './g5_8';
import { build, memory, dinner, bath, sleep } from './g9_13';

export const GAMES: Record<string, Game> = { wake, teeth, dress, breakfast, walk, tower, football, ninja, build, memory, dinner, bath, sleep };
export { createCtx } from './engine';
