// One back button for the whole app. Screens set a base handler; overlays (calm, parent) push on top.
const stack: (() => void)[] = [];
let base: (() => void) | null = null;
const subs = new Set<(visible: boolean) => void>();
const top = () => stack[stack.length - 1] ?? base;
const notify = () => subs.forEach((f) => f(!!top()));
export const setBase = (fn: (() => void) | null) => { base = fn; notify(); };
export function pushBack(fn: () => void): () => void {
  stack.push(fn); notify();
  return () => { const i = stack.indexOf(fn); if (i >= 0) stack.splice(i, 1); notify(); };
}
export const goBack = () => top()?.();
export const onBackVisible = (f: (v: boolean) => void) => { subs.add(f); };
