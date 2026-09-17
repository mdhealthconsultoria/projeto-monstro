// Lightweight, dependency-free SVG line chart for progression views.
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

// points: [{day, value}], already sorted by day ascending, values are real registered numbers only.
export function lineChart(points, { unit = '', color = '#2b8c80', height = 140, title = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'chart';
  if (!points.length) {
    wrap.appendChild(document.createElement('div')).outerHTML =
      `<div class="chart-empty">Sem dados registrados ainda${title ? ' para ' + title : ''}.</div>`;
    return wrap;
  }

  const width = 320;
  const padX = 28;
  const padY = 18;
  const values = points.map(p => p.value);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const range = maxV - minV || 1;

  const xFor = i => padX + (points.length === 1 ? 0 : (i / (points.length - 1)) * (width - padX * 2));
  const yFor = v => height - padY - ((v - minV) / range) * (height - padY * 2);

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': title });

  // gridlines
  for (let g = 0; g <= 2; g++) {
    const y = padY + (g / 2) * (height - padY * 2);
    svg.appendChild(svgEl('line', { x1: padX, x2: width - padX, y1: y, y2: y, class: 'chart-grid' }));
  }

  const pathPoints = points.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(' ');
  const areaPath = `M${xFor(0)},${height - padY} L${pathPoints.split(' ').join(' L')} L${xFor(points.length - 1)},${height - padY} Z`;

  svg.appendChild(svgEl('path', { d: areaPath, fill: color, opacity: '0.12', stroke: 'none' }));
  svg.appendChild(svgEl('polyline', { points: pathPoints, fill: 'none', stroke: color, 'stroke-width': '2.5', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  let bestIdx = 0;
  points.forEach((p, i) => { if (p.value >= points[bestIdx].value) bestIdx = i; });

  points.forEach((p, i) => {
    const isBest = i === bestIdx;
    const r = isBest ? 4.5 : 3;
    svg.appendChild(svgEl('circle', { cx: xFor(i), cy: yFor(p.value), r, fill: isBest ? '#4fd1c5' : color, class: isBest ? 'chart-dot-best' : 'chart-dot' }));
  });

  wrap.appendChild(svg);

  const labels = document.createElement('div');
  labels.className = 'chart-labels';
  const first = points[0], last = points[points.length - 1];
  const best = points[bestIdx];
  labels.innerHTML = `
    <span>Dia ${first.day}: <strong>${first.value}${unit}</strong></span>
    <span class="chart-best">Melhor — Dia ${best.day}: <strong>${best.value}${unit}</strong></span>
    <span>Dia ${last.day}: <strong>${last.value}${unit}</strong></span>
  `;
  wrap.appendChild(labels);

  return wrap;
}
