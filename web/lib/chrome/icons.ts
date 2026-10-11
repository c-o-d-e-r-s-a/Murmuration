// Custom 2 px stroke icon set (art direction §12.2). Static strings; never emoji.
const wrap = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  lock: wrap('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  arrow: wrap('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: wrap('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  down: wrap('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  external: wrap('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  speaker: wrap('<path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>'),
  speakerOff: wrap('<path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M17 9l4 6M21 9l-4 6"/>'),
  replay: wrap('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = ""): HTMLElement {
  const n = document.createElement("span");
  n.className = `icon ${cls}`.trim();
  n.innerHTML = ICONS[name]; // static strings above only
  return n;
}
