// Single-use token results are retained only in memory across language changes.
let state;
let context;
export function mountEmailVerification(ctx) {
  context = ctx;
  const token = new URLSearchParams(location.search).get('token');
  if (!state || state.token !== token)
    state = /^[a-f0-9]{64}$/.test(token || '')
      ? { token, status: 'idle' }
      : { token, status: 'error', code: 'AUTH_TOKEN_INVALID' };
  render();
}
function render() {
  const { app, t } = context;
  const result =
    state.status === 'success'
      ? 'EMAIL_VERIFIED'
      : state.status === 'error'
        ? state.code
        : state.status === 'pending'
          ? 'emailVerifying'
          : 'emailVerifyHelp';
  app.innerHTML = `<h1>${t('emailVerifyTitle')}</h1><p id="verification-result" role="status" aria-live="polite"></p>${state.status === 'idle' || state.status === 'pending' || state.retry ? `<button id="verify-email" ${state.status === 'pending' ? 'disabled' : ''}>${t('emailVerifyAction')}</button>` : ''}<p><a href="/auth/login">${t('signIn')}</a></p>`;
  app.querySelector('#verification-result').textContent = t(result);
  const button = app.querySelector('#verify-email');
  if (button)
    button.onclick = async () => {
      if (state.status === 'pending') return;
      state.status = 'pending';
      state.retry = false;
      render();
      try {
        await context.api('/auth/verify-email', 'POST', { token: state.token });
        state.status = 'success';
      } catch (error) {
        state.status = 'error';
        state.code = error.code || 'genericError';
        state.retry = !error.status || error.status === 429 || error.status >= 500;
      }
      render();
    };
}
