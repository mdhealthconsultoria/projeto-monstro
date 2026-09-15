import { h, mount } from '../utils.js';
import { icon, pyramidMark } from '../icons.js';
import { openModal, toast } from '../ui.js';
import * as auth from '../services/auth.js';

function field(label, inputProps) {
  const err = h('div', { className: 'field-error' });
  const input = h('input', { id: inputProps.autocomplete ? `f-${inputProps.autocomplete}-${inputProps.type}` : undefined, name: inputProps.autocomplete, ...inputProps });
  return { node: h('div', { className: 'field' }, h('label', {}, label), input, err), input, err };
}

function authShell(...children) {
  return h('div', { className: 'auth-screen' },
    h('div', { className: 'auth-brand' },
      pyramidMark({ size: 56 }),
      h('div', {},
        h('div', { className: 'auth-brand-name' }, 'SKEELO EVOLUTION'),
        h('div', { className: 'auth-brand-tag' }, 'Construa sua base. Evolua todos os dias.')
      )
    ),
    ...children
  );
}

export function renderLogin(viewEl, params, nav) {
  const emailF = field('E-mail', { type: 'email', autocomplete: 'email', inputMode: 'email' });
  const passF = field('Senha', { type: 'password', autocomplete: 'current-password' });
  const formError = h('div', { className: 'field-error text-center' });
  const submitBtn = h('button', { type: 'submit', className: 'btn btn-primary btn-huge btn-block' }, 'Entrar');

  async function submit() {
    submitBtn.disabled = true;
    formError.textContent = '';
    try {
      await auth.signIn({ email: emailF.input.value, password: passF.input.value });
      nav.navigateTo('boot');
    } catch (e) {
      formError.textContent = (e && e.message) || 'Não foi possível entrar.';
    } finally {
      submitBtn.disabled = false;
    }
  }

  const form = h('form', { className: 'stack', onSubmit: e => { e.preventDefault(); submit(); } },
    emailF.node,
    passF.node,
    formError,
    submitBtn
  );

  const screen = authShell(
    h('h1', { className: 'auth-title' }, 'Entrar'),
    form,
    h('div', { className: 'stack' },
      h('button', { type: 'button', className: 'btn btn-ghost btn-block', onClick: () => openForgotPassword(emailF.input.value) }, 'Esqueci minha senha'),
      h('div', { className: 'auth-switch' }, 'Não tem conta? ', h('button', { type: 'button', className: 'link-btn', onClick: () => nav.navigateTo('signup') }, 'Criar conta'))
    )
  );
  mount(viewEl, screen);
}

function openForgotPassword(prefillEmail) {
  const emailInput = h('input', { type: 'email', inputMode: 'email', placeholder: 'seu@email.com', value: prefillEmail || '' });
  const msg = h('div', { className: 'field-error' });
  const content = h('div', { className: 'stack' },
    h('p', { className: 'text-dim' }, 'Vamos te enviar um link por e-mail para você criar uma nova senha.'),
    h('div', { className: 'field' }, h('label', {}, 'E-mail'), emailInput),
    msg,
    h('button', {
      className: 'btn btn-primary btn-block',
      onClick: async () => {
        if (!emailInput.value.trim()) { msg.textContent = 'Informe seu e-mail.'; return; }
        try {
          await auth.requestPasswordReset(emailInput.value);
          toast('Link enviado — confira seu e-mail', { iconName: 'check' });
          close();
        } catch (e) {
          msg.textContent = (e && e.message) || 'Não foi possível enviar o link agora.';
        }
      },
    }, 'Enviar link de recuperação')
  );
  const close = openModal(content, { title: 'Recuperar senha' });
}

export function renderSignup(viewEl, params, nav) {
  const nameF = field('Nome', { type: 'text', autocomplete: 'name' });
  const nicknameF = field('Apelido', { type: 'text', autocomplete: 'nickname', placeholder: 'Como quer ser chamado' });
  const emailF = field('E-mail', { type: 'email', autocomplete: 'email', inputMode: 'email' });
  const passF = field('Senha', { type: 'password', autocomplete: 'new-password', placeholder: 'Mínimo 6 caracteres' });
  const confirmF = field('Confirmar senha', { type: 'password', autocomplete: 'new-password' });
  const formError = h('div', { className: 'field-error text-center' });
  const submitBtn = h('button', { type: 'submit', className: 'btn btn-primary btn-huge btn-block' }, 'Criar conta');

  async function submit() {
    formError.textContent = '';
    if (!nameF.input.value.trim()) { formError.textContent = 'Informe seu nome.'; return; }
    if (!emailF.input.value.trim()) { formError.textContent = 'Informe seu e-mail.'; return; }
    if (passF.input.value.length < 6) { formError.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    if (passF.input.value !== confirmF.input.value) {
      formError.textContent = 'As senhas não coincidem.';
      return;
    }
    submitBtn.disabled = true;
    try {
      const result = await auth.signUp({
        name: nameF.input.value,
        nickname: nicknameF.input.value,
        email: emailF.input.value,
        password: passF.input.value,
      });
      if (result.needsEmailConfirmation) {
        showConfirmEmailScreen(viewEl, emailF.input.value, nav);
        return;
      }
      nav.navigateTo('boot');
    } catch (e) {
      formError.textContent = (e && e.message) || 'Não foi possível criar a conta.';
      submitBtn.disabled = false;
    }
  }

  const form = h('form', { className: 'stack', onSubmit: e => { e.preventDefault(); submit(); } },
    nameF.node,
    nicknameF.node,
    emailF.node,
    passF.node,
    confirmF.node,
    formError,
    submitBtn
  );

  const screen = authShell(
    h('h1', { className: 'auth-title' }, 'Criar conta'),
    h('p', { className: 'text-dim auth-disclaimer' },
      icon('lock', { size: 16 }),
      ' Sua conta é protegida e sincronizada — dá pra entrar de outro aparelho depois.'),
    form,
    h('div', { className: 'auth-switch' }, 'Já tem conta? ', h('button', { type: 'button', className: 'link-btn', onClick: () => nav.navigateTo('login') }, 'Entrar'))
  );
  mount(viewEl, screen);
}

function showConfirmEmailScreen(viewEl, email, nav) {
  const screen = authShell(
    h('div', { className: 'card stack text-center' },
      icon('checkCircle', { size: 36, className: 'text-dim' }),
      h('h2', { style: { fontSize: '18px' } }, 'Confirme seu e-mail'),
      h('p', { className: 'text-dim' }, `Mandamos um link de confirmação para ${email}. Abra o e-mail e toque no link para ativar sua conta — depois é só voltar aqui e entrar.`),
      h('button', { className: 'btn btn-outline btn-block', onClick: () => nav.navigateTo('login') }, 'Já confirmei, ir para o login')
    )
  );
  mount(viewEl, screen);
}
