// Consistent stroke-based SVG icon set (24x24, no emoji used anywhere in the UI).
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

const PATHS = {
  today: '<path d="M6.5 3v3M17.5 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/><path d="M9 13.5l2 2 4-4.5"/>',
  journey: '<path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="14" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  evolution: '<path d="M4 19V5M4 19h16"/><path d="M7 16l4-5 3 3 5-7"/>',
  photos: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
  profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"/>',
  flame: '<path d="M12 3s4 3.6 4 7.6A4 4 0 0 1 8 10.6c0-1 .4-1.9 1-2.6-.2 1.4.5 2.6 1.6 2.6 1.3 0 1.6-1.2 1.2-2.2C12.3 7 12 5 12 3Z"/><path d="M7.5 13c-.5 1-1 2.2-1 3.5a5.5 5.5 0 0 0 11 0c0-2-1-3.6-1-3.6" />',
  trophy: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a2 2 0 0 0 0 4h.5M16 5h3a2 2 0 0 1 0 4h-.5"/><path d="M10 14v2M14 14v2"/><path d="M8 20h8"/><path d="M9.5 16h5l.5 4h-6l.5-4Z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"/><path d="M13.5 6.5l3 3"/>',
  trash: '<path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
  play: '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>',
  bolt: '<path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  alert: '<path d="M12 4l9 15.5H3L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  scale: '<path d="M12 3v18M6 7h12M6 7l-3 6a3 3 0 0 0 6 0L6 7Zm12 0l-3 6a3 3 0 0 0 6 0l-3-6Z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/>',
  share: '<circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="M8 10.8l8-4.4M8 13.2l8 4.4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M20 18H6.5A2.5 2.5 0 0 0 4 20.5"/>',
  droplet: '<path d="M12 3s6 7 6 11.5a6 6 0 0 1-12 0C6 10 12 3 12 3Z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"/><path d="M3 12h18"/>',
  heart: '<path d="M12 20s-7-4.35-9.5-8.8C.8 7.8 2.6 4.5 6 4.5c2 0 3.4 1.1 6 3.6 2.6-2.5 4-3.6 6-3.6 3.4 0 5.2 3.3 3.5 6.7C19 15.65 12 20 12 20Z"/>',
  pyramid: '<path d="M12 3.5 21.5 20H2.5L12 3.5Z"/><path d="M6.2 14.5h11.6M8.7 10.2h6.6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3.3 3-5 5.5-5s4.8 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.3 14.2c2 .2 3.7 1.8 4.2 4.3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7-7-1Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M14 16l4-4-4-4"/><path d="M18 12H9"/>',
  download: '<path d="M12 3v13"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9s1.3-6.5 3.8-9Z"/>',
  crown: '<path d="M4 8l3.5 3L12 6l4.5 5L20 8l-1.5 9h-13L4 8Z"/><path d="M6.5 20h11"/>',
  wind: '<path d="M4 9h10.5a3 3 0 1 0-2.8-4"/><path d="M4 13h14a3 3 0 1 1-2.8 4"/><path d="M4 17h5.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.8 2.1 2.1-4.9 4.8-2.1Z"/>',
  sparkle: '<path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/>',
};

// The Skeelo Evolution brand mark: a three-level stepped pyramid — Corpo
// (base), Mente (middle), Comunidade (apex). `levels` lights up each band
// independently (e.g. to show which pillar has progress today).
export function pyramidMark({ size = 64, levels = [true, true, true], className = '' } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  if (className) svg.setAttribute('class', className);

  const apexY = 8, baseY = 90, gap = 3.2;
  const halfWidthAt = f => 42 * f;
  const yAt = f => apexY + (baseY - apexY) * f;

  function bandPoints(fStart, fEnd) {
    const y0 = yAt(fStart) + (fStart > 0 ? gap / 2 : 0);
    const y1 = yAt(fEnd) - (fEnd < 1 ? gap / 2 : 0);
    const f0 = (y0 - apexY) / (baseY - apexY);
    const f1 = (y1 - apexY) / (baseY - apexY);
    if (fStart === 0) {
      return `50,${apexY} ${50 + halfWidthAt(f1)},${y1} ${50 - halfWidthAt(f1)},${y1}`;
    }
    return `${50 - halfWidthAt(f0)},${y0} ${50 + halfWidthAt(f0)},${y0} ${50 + halfWidthAt(f1)},${y1} ${50 - halfWidthAt(f1)},${y1}`;
  }

  // [comunidade(apex), mente(mid), corpo(base)] — drawn top to bottom.
  const bands = [
    { points: bandPoints(0, 1 / 3), filled: levels[2] },
    { points: bandPoints(1 / 3, 2 / 3), filled: levels[1] },
    { points: bandPoints(2 / 3, 1), filled: levels[0] },
  ];

  bands.forEach(b => {
    svg.appendChild(svgEl('polygon', {
      points: b.points,
      fill: b.filled ? 'currentColor' : 'none',
      stroke: 'currentColor',
      'stroke-width': '3',
      'stroke-linejoin': 'round',
      opacity: b.filled ? '1' : '0.45',
    }));
  });

  return svg;
}

export function icon(name, { size = 24, className = '' } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = PATHS[name] || '';
  return svg;
}
