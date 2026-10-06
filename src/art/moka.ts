// Moka, the family chocolate Labrador, drawn in code. States are driven by [data-state] / [data-eyes] + CSS.
import { frag } from '../core/dom';

export type MokaState = 'idle' | 'happy' | 'concerned' | 'sleepy' | 'walking';

const FUR = '#6b3f2a', FUR_D = '#4e2b1c', FUR_L = '#8c5a3d', SNOUT = '#9a6a4a';

export function mokaSvg(state: MokaState = 'idle'): HTMLElement {
  const el = frag(`
<div class="moka" data-state="${state}" data-eyes="open">
<svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="100" cy="203" rx="62" ry="6" fill="#000" opacity=".08"/>
  <g class="tail"><path d="M142 168 C175 160 186 130 176 108 C172 100 164 104 166 112 C172 132 164 150 140 154 Z" fill="${FUR_D}"/></g>
  <g class="bodyg">
    <ellipse cx="100" cy="152" rx="54" ry="46" fill="${FUR}"/>
    <ellipse cx="100" cy="160" rx="30" ry="32" fill="${FUR_L}" opacity=".55"/>
    <g class="legs">
      <rect class="legL" x="72" y="170" width="20" height="32" rx="10" fill="${FUR}"/>
      <rect class="legR" x="108" y="170" width="20" height="32" rx="10" fill="${FUR}"/>
      <ellipse cx="82" cy="201" rx="13" ry="6" fill="${FUR_D}"/><ellipse cx="118" cy="201" rx="13" ry="6" fill="${FUR_D}"/>
    </g>
    <path d="M70 142 Q100 160 130 142" stroke="#c0392b" stroke-width="7" fill="none" stroke-linecap="round" opacity="0"/>
  </g>
  <g class="head">
    <path class="earL" d="M64 52 C44 54 36 86 44 112 C52 122 66 108 68 90 C70 74 70 60 64 52 Z" fill="${FUR_D}"/>
    <path class="earR" d="M136 52 C156 54 164 86 156 112 C148 122 134 108 132 90 C130 74 130 60 136 52 Z" fill="${FUR_D}"/>
    <ellipse cx="100" cy="82" rx="43" ry="40" fill="${FUR}"/>
    <ellipse cx="100" cy="102" rx="25" ry="19" fill="${SNOUT}"/>
    <ellipse cx="100" cy="91" rx="10" ry="7" fill="#2a1812"/>
    <ellipse cx="97" cy="89" rx="3" ry="1.8" fill="#fff" opacity=".35"/>
    <path d="M100 98 V105 M100 105 Q92 112 86 106 M100 105 Q108 112 114 106" stroke="#2a1812" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path class="tongue" d="M95 109 Q100 126 105 109 Z" fill="#ff8fa3"/>
    <g class="eyes">
      <g class="eyeO">
        <circle cx="83" cy="76" r="7" fill="#2a1812"/><circle cx="117" cy="76" r="7" fill="#2a1812"/>
        <circle cx="86" cy="73" r="2.6" fill="#fff"/><circle cx="120" cy="73" r="2.6" fill="#fff"/>
        <circle cx="81" cy="79" r="1.4" fill="#fff" opacity=".6"/><circle cx="115" cy="79" r="1.4" fill="#fff" opacity=".6"/>
      </g>
      <g class="eyeC" stroke="#2a1812" stroke-width="3.4" fill="none" stroke-linecap="round">
        <path d="M75 77 Q83 84 91 77"/><path d="M109 77 Q117 84 125 77"/>
      </g>
    </g>
    <g class="brows" stroke="${FUR_D}" stroke-width="3.5" fill="none" stroke-linecap="round">
      <path d="M74 64 Q82 58 92 62"/><path d="M126 64 Q118 58 108 62"/>
    </g>
  </g>
  <g class="zzz" fill="#7a8fd6" font-family="Rubik, sans-serif" font-weight="700">
    <text x="150" y="40" font-size="22">z</text><text x="166" y="22" font-size="16">z</text>
  </g>
</svg></div>`);
  return el;
}

export function setMoka(el: HTMLElement, state: MokaState, eyes?: 'open' | 'closed') {
  el.dataset.state = state;
  if (eyes) el.dataset.eyes = eyes;
  else if (state === 'sleepy') el.dataset.eyes = 'closed';
  else el.dataset.eyes = 'open';
}
