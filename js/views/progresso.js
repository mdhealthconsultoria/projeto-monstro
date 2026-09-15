import { h, mount, todayISO, formatDateShort } from '../utils.js';
import { icon } from '../icons.js';
import { store } from '../store.js';
import { renderEvolucao } from './evolucao.js';
import { renderFotos } from './fotos.js';
import { lineChart } from '../charts.js';
import { toast } from '../ui.js';

const TABS = [
  { key: 'evolucao', label: 'Evolução', icon: 'evolution' },
  { key: 'fotos', label: 'Fotos', icon: 'photos' },
  { key: 'imc', label: 'IMC', icon: 'scale' },
];

function imcCategory(imc) {
  if (imc < 18.5) return { label: 'Abaixo do peso', tone: 'pill-orange' };
  if (imc < 25) return { label: 'Peso normal', tone: 'pill-green' };
  if (imc < 30) return { label: 'Sobrepeso', tone: 'pill-orange' };
  return { label: 'Obesidade', tone: 'pill-red' };
}

function renderImc(container) {
  function draw() {
    const state = store.state;
    const metrics = state.bodyMetrics;
    const lastWeight = metrics.weights[metrics.weights.length - 1] || null;
    const imc = (metrics.heightCm && lastWeight) ? lastWeight.kg / ((metrics.heightCm / 100) ** 2) : null;

    const heightInput = h('input', { type: 'number', inputMode: 'decimal', min: '50', max: '250', placeholder: 'cm', value: metrics.heightCm || '' });
    const weightInput = h('input', { type: 'number', inputMode: 'decimal', min: '20', max: '400', step: '0.1', placeholder: 'kg' });

    const points = metrics.weights.map(w => ({ day: formatDateShort(w.date), value: w.kg }));

    mount(container, h('div', { className: 'stack' },
      h('p', { className: 'text-dim', style: { fontSize: '13px' } },
        'O IMC é uma referência simples (peso ÷ altura²), não um diagnóstico médico. Use como acompanhamento pessoal.'),
      h('div', { className: 'card stack' },
        h('div', { className: 'field' }, h('label', {}, 'Altura (cm)'), heightInput),
        h('button', { className: 'btn btn-outline btn-sm', onClick: () => {
          const cm = Number(heightInput.value);
          if (!cm || cm < 50 || cm > 250) { toast('Informe uma altura válida.', { iconName: 'alert' }); return; }
          store.mutate(s => { s.bodyMetrics.heightCm = cm; });
        } }, 'Salvar altura'),
        h('hr', { className: 'divider' }),
        h('div', { className: 'field' }, h('label', {}, 'Registrar peso de hoje'), weightInput),
        h('button', { className: 'btn btn-primary btn-sm', onClick: () => {
          const kg = Number(weightInput.value);
          if (!kg || kg < 20 || kg > 400) { toast('Informe um peso válido.', { iconName: 'alert' }); return; }
          store.mutate(s => { s.bodyMetrics.weights.push({ date: todayISO(), kg }); });
          toast('Peso registrado', { iconName: 'check' });
        } }, 'Registrar peso')
      ),
      imc ? h('div', { className: 'card row-between' },
        h('div', {},
          h('div', { className: 'section-title' }, 'IMC ATUAL'),
          h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--orange-2)' } }, imc.toFixed(1)),
          h('div', { className: 'text-faint', style: { fontSize: '12px' } }, `Atualizado em ${formatDateShort(lastWeight.date)}`)
        ),
        h('span', { className: `pill ${imcCategory(imc).tone}` }, imcCategory(imc).label)
      ) : h('div', { className: 'empty-state' }, 'Informe altura e peso para calcular seu IMC.'),
      h('div', { className: 'card stack' },
        h('div', { className: 'section-title' }, 'HISTÓRICO DE PESO'),
        lineChart(points, { unit: 'kg', title: 'Peso' })
      )
    ));
  }
  draw();
  return store.subscribe(draw);
}

export function renderProgresso(viewEl, params, nav) {
  let activeTab = params.tab || 'evolucao';
  let innerCleanup = null;

  function drawShell() {
    const tabsRow = h('div', { className: 'photo-day-tabs' }, TABS.map(t =>
      h('button', {
        className: `photo-day-tab ${activeTab === t.key ? 'active' : ''}`,
        onClick: () => { activeTab = t.key; drawShell(); },
      }, icon(t.icon, { size: 14 }), ' ', t.label)
    ));

    const inner = h('div', {});
    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('h1', {}, 'Progresso'),
      tabsRow,
      inner
    ));

    if (innerCleanup) { try { innerCleanup(); } catch { /* ignore */ } innerCleanup = null; }
    if (activeTab === 'evolucao') innerCleanup = renderEvolucao(inner, {}, nav);
    else if (activeTab === 'fotos') innerCleanup = renderFotos(inner, {}, nav);
    else if (activeTab === 'imc') innerCleanup = renderImc(inner);
  }

  drawShell();
  return () => { if (innerCleanup) innerCleanup(); };
}
