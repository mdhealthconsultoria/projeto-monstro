import { h, mount, uid, todayISO, formatDateShort } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';
import { store } from '../store.js';
import { toast, confirmDialog } from '../ui.js';
import { HEALTH_MEASUREMENT_TYPES, healthTypeInfo, areaFor } from '../model.js';

const SAUDE_COLOR = (areaFor('saude') || {}).color || '#e5484d';

function field(label, controlEl) {
  return h('div', { className: 'field' }, h('label', {}, label), controlEl);
}

function perfilCard(profile) {
  const conditionInput = h('input', { type: 'text', placeholder: 'Ex: pressão alta, diabetes tipo 2...' });

  const sexSelect = h('select', { onChange: e => {
    const v = e.target.value;
    store.mutate(s => { s.healthProfile.sex = v || null; });
  } },
    h('option', { value: '', selected: profile.sex == null }, 'Prefiro não informar'),
    h('option', { value: 'F', selected: profile.sex === 'F' }, 'Feminino'),
    h('option', { value: 'M', selected: profile.sex === 'M' }, 'Masculino')
  );

  const yearInput = h('input', {
    type: 'number', inputMode: 'numeric', placeholder: 'Ex: 1990',
    min: '1920', max: String(new Date().getFullYear()),
    value: profile.birthYear || '',
    onChange: e => {
      const v = Number(e.target.value);
      store.mutate(s => { s.healthProfile.birthYear = v || null; });
    },
  });

  const smokerSelect = h('select', { onChange: e => {
    const v = e.target.value;
    store.mutate(s => { s.healthProfile.smoker = v === '' ? null : v === 'yes'; });
  } },
    h('option', { value: '', selected: profile.smoker == null }, 'Prefiro não informar'),
    h('option', { value: 'no', selected: profile.smoker === false }, 'Não fumo'),
    h('option', { value: 'yes', selected: profile.smoker === true }, 'Fumo')
  );

  const alcoholSelect = h('select', { onChange: e => {
    const v = e.target.value;
    store.mutate(s => { s.healthProfile.alcoholLevel = v || null; });
  } },
    h('option', { value: '', selected: !profile.alcoholLevel }, 'Prefiro não informar'),
    h('option', { value: 'none', selected: profile.alcoholLevel === 'none' }, 'Não bebo'),
    h('option', { value: 'moderate', selected: profile.alcoholLevel === 'moderate' }, 'Moderado'),
    h('option', { value: 'high', selected: profile.alcoholLevel === 'high' }, 'Alto')
  );

  return h('div', { className: 'card stack' },
    h('div', { className: 'section-title' }, 'PERFIL DE SAÚDE'),
    h('p', { className: 'text-faint', style: { fontSize: '11px', marginTop: '-6px' } },
      'Só você vê estes dados. Nada aqui aparece na comunidade.'),
    h('div', { className: 'row' }, field('Sexo biológico', sexSelect), field('Ano de nascimento', yearInput)),
    h('div', { className: 'row' }, field('Tabagismo', smokerSelect), field('Consumo de álcool', alcoholSelect)),
    h('hr', { className: 'divider' }),
    h('div', { className: 'field' },
      h('label', {}, 'Condições relevantes (autorrelatado)'),
      h('div', { className: 'row' },
        conditionInput,
        h('button', { className: 'btn btn-outline btn-sm', onClick: () => {
          const text = conditionInput.value.trim();
          if (!text) return;
          store.mutate(s => { s.healthProfile.conditions.push(text); });
        } }, icon('plus', { size: 14 }))
      )
    ),
    profile.conditions.length
      ? h('div', { className: 'chip-row' }, profile.conditions.map((c, i) =>
          h('span', { className: 'chip' }, c, h('button', {
            className: 'icon-btn-sm', style: { marginLeft: '4px' }, 'aria-label': 'Remover',
            onClick: () => store.mutate(s => { s.healthProfile.conditions.splice(i, 1); }),
          }, icon('close', { size: 11 })))
        ))
      : h('p', { className: 'text-faint', style: { fontSize: '12px' } }, 'Nenhuma condição informada.')
  );
}

function medicoesCard(measurements) {
  const typeSelect = h('select', {}, HEALTH_MEASUREMENT_TYPES.map(t =>
    h('option', { value: t.key }, `${t.label} (${t.unit})`)
  ));
  const valueInput = h('input', { type: 'number', inputMode: 'decimal', step: '0.1', placeholder: 'Valor' });
  const sorted = [...measurements].sort((a, b) => new Date(b.date) - new Date(a.date));

  return h('div', { className: 'card stack' },
    h('div', { className: 'section-title' }, 'REGISTRAR MEDIÇÃO'),
    h('div', { className: 'row' },
      h('div', { className: 'field grow' }, h('label', {}, 'Tipo'), typeSelect),
      h('div', { className: 'field' }, h('label', {}, 'Valor'), valueInput)
    ),
    h('button', { className: 'btn btn-primary btn-sm', onClick: () => {
      const value = Number(valueInput.value);
      if (!value) { toast('Informe um valor válido.', { iconName: 'alert' }); return; }
      store.mutate(s => {
        s.healthProfile.measurements.push({ id: uid(), type: typeSelect.value, value, date: todayISO() });
      });
      toast('Medição registrada', { iconName: 'check' });
    } }, 'Registrar'),
    h('hr', { className: 'divider' }),
    h('div', { className: 'section-title' }, 'HISTÓRICO'),
    sorted.length
      ? h('div', { className: 'stack' }, sorted.slice(0, 30).map(m => {
          const info = healthTypeInfo(m.type);
          return h('div', { className: 'row-between card card-tight' },
            h('div', {},
              h('div', { style: { fontWeight: 700, fontSize: '13px' } }, info ? info.label : m.type),
              h('div', { className: 'text-faint', style: { fontSize: '11px' } }, formatDateShort(m.date))
            ),
            h('div', { className: 'row', style: { alignItems: 'center', gap: '8px' } },
              h('span', { style: { fontFamily: 'var(--font-display)', color: 'var(--orange-2)' } }, `${m.value} ${info ? info.unit : ''}`),
              h('button', { className: 'icon-btn-sm', 'aria-label': 'Excluir', onClick: async () => {
                const ok = await confirmDialog({ title: 'Excluir medição', message: 'Remover este registro do histórico?', confirmLabel: 'Excluir', danger: true });
                if (ok) store.mutate(s => { s.healthProfile.measurements = s.healthProfile.measurements.filter(x => x.id !== m.id); });
              } }, icon('trash', { size: 14 }))
            )
          );
        }))
      : h('div', { className: 'empty-state' }, 'Nenhuma medição registrada ainda.')
  );
}

export function renderSaude(viewEl, params, nav) {
  function draw() {
    const state = store.state;
    const { healthScore } = store.derived;

    mount(viewEl, h('div', { className: 'stack fade-up' },
      h('div', { className: 'row-between' },
        h('button', { className: 'icon-btn', 'aria-label': 'Voltar', onClick: () => nav.navigateTo('areas', { area: 'saude' }) }, icon('chevronLeft', { size: 20 })),
        h('h1', {}, 'Saúde'),
        h('span', { style: { width: '44px' } })
      ),
      h('div', { className: 'montro-hero' },
        h('div', { style: { color: SAUDE_COLOR } }, pyramidMark({ size: 56, fillPercent: healthScore ?? 0 })),
        h('div', {},
          h('div', { className: 'montro-hero-label' }, 'HEALTH SCORE'),
          h('div', { className: 'montro-hero-num', style: { color: SAUDE_COLOR } }, healthScore != null ? healthScore : '—'),
          h('div', { className: 'montro-hero-sub' }, 'Leitura comportamental (sono, atividade, alimentação, tabagismo, álcool). Não é diagnóstico médico nem calculadora de risco clínico.')
        )
      ),
      perfilCard(state.healthProfile),
      medicoesCard(state.healthProfile.measurements)
    ));
  }

  draw();
  const unsub = store.subscribe(draw);
  return () => unsub();
}
