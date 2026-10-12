import { formatDate } from './i18n.js';

export async function mountAdminCertificates({ app, api, t, e, notify, locale }) {
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('adminCertificatesTitle')}</h1><section><form id="certificate-search" class="user-filters"><label>${t('adminCertificatesSearch')}<input name="q" type="search" maxlength="100"></label><label>${t('adminUsersStatus')}<select name="status"><option value="">${t('adminCertificatesAllStates')}</option><option value="valid">${t('certificateStatusValid')}</option><option value="revoked">${t('certificateStatusRevoked')}</option></select></label><button type="submit">${t('adminUsersSearchAction')}</button></form><p id="certificate-summary" role="status" aria-live="polite"></p><div id="certificate-list" aria-busy="true"></div></section>`;

  const search = app.querySelector('#certificate-search');
  const list = app.querySelector('#certificate-list');
  const summary = app.querySelector('#certificate-summary');
  const dateLabel = value => {
    return formatDate(locale, value) ?? t('valueUnavailable');
  };

  async function load() {
    list.setAttribute('aria-busy', 'true');
    list.innerHTML = `<p>${t('adminCertificatesLoading')}</p>`;
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      const values = new FormData(search);
      if (values.get('q')) params.set('q', values.get('q'));
      if (values.get('status')) params.set('status', values.get('status'));
      const result = await api(`/admin/certificates?${params}`);
      summary.textContent = t('adminCertificatesCount', { count: result.total });
      list.replaceChildren();
      if (!result.items.length) list.innerHTML = `<p>${t('adminCertificatesEmpty')}</p>`;
      for (const certificate of result.items) {
        const item = document.createElement('article');
        item.className = 'card admin-certificate';
        item.innerHTML = `<h2>${e(certificate.course_title || t('certificateCourseTitle'))}</h2><p>${e(certificate.email)} · ${e(certificate.confirmed_name)}</p><p>${t('adminCertificateCode')}: <code>${e(certificate.public_code)}</code></p><p>${t('certificateStatusLabel')}: ${e(t(certificate.revoked_at ? 'certificateStatusRevoked' : 'certificateStatusValid'))} · ${t('certificatePdfLabel')}: ${e(t(`certificatePdf${certificate.pdf_status}`))}</p><p>${t('certificateIssuedAt')}: ${e(dateLabel(certificate.issued_at))}</p>${certificate.reason ? `<p>${t('adminCertificatePrivateReason')}: ${e(certificate.reason)}</p>` : ''}${certificate.supersedes_id ? `<p>${t('adminCertificateSupersedes')}: <code>${e(certificate.supersedes_id)}</code></p>` : ''}${certificate.successor_id ? `<p>${t('adminCertificateSuccessor')}: <code>${e(certificate.successor_id)}</code></p>` : ''}<div class="actions">${!certificate.revoked_at ? `<button type="button" class="secondary" data-revoke>${t('adminCertificateRevoke')}</button>` : ''}${certificate.revoked_at && !certificate.successor_id ? `<button type="button" class="secondary" data-reissue>${t('adminCertificateReissue')}</button>` : ''}<a href="/certificates/verify/${encodeURIComponent(certificate.public_code)}">${t('certificateViewVerification')}</a><details><summary>${t('adminCertificateHistory')}</summary><div class="certificate-history">${t('adminCertificatesLoading')}</div></details></div>`;

        item.querySelector('[data-revoke]')?.addEventListener('click', async event => {
          const reason = prompt(t('adminCertificateRevokePrompt'));
          if (reason === null) return;
          if (reason.trim().length < 5) {
            notify(t('adminCertificateReasonInvalid'));
            return;
          }
          event.currentTarget.disabled = true;
          try {
            await api(`/admin/certificates/${certificate.id}/revoke`, 'PATCH', { reason });
            notify(t('adminCertificateRevokedNotice'));
            await load();
          } catch (error) {
            notify(error);
            event.currentTarget.disabled = false;
          }
        });
        item.querySelector('[data-reissue]')?.addEventListener('click', async event => {
          const reason = prompt(t('adminCertificateReissuePrompt'));
          if (reason === null) return;
          if (reason.trim().length < 5) {
            notify(t('adminCertificateReasonInvalid'));
            return;
          }
          event.currentTarget.disabled = true;
          try {
            await api(`/admin/certificates/${certificate.id}/reissue`, 'POST', { reason });
            notify(t('adminCertificateReissuedNotice'));
            await load();
          } catch (error) {
            notify(error);
            event.currentTarget.disabled = false;
          }
        });

        const history = item.querySelector('details');
        history.addEventListener('toggle', async () => {
          if (!history.open || history.dataset.loaded) return;
          const content = history.querySelector('.certificate-history');
          try {
            const result = await api(`/admin/certificates/${certificate.id}/history`);
            content.innerHTML = result.items.length || result.events.length
              ? `${result.items.length ? `<ol>${result.items.map(entry => `<li id="certificate-history-${e(entry.id)}"><strong>${e(entry.confirmed_name)}</strong> · <a href="/certificates/verify/${encodeURIComponent(entry.public_code)}"><code>${e(entry.public_code)}</code></a> · ${e(dateLabel(entry.issued_at))} · ${e(t(entry.revoked_at ? 'certificateStatusRevoked' : 'certificateStatusValid'))}${entry.reason ? `<p>${t('adminCertificatePrivateReason')}: ${e(entry.reason)}</p>` : ''}${entry.supersedes_id ? `<p>${t('adminCertificateSupersedes')}: <a href="#certificate-history-${e(entry.supersedes_id)}"><code>${e(entry.supersedes_id)}</code></a></p>` : ''}${entry.successor_id ? `<p>${t('adminCertificateSuccessor')}: <a href="#certificate-history-${e(entry.successor_id)}"><code>${e(entry.successor_id)}</code></a></p>` : ''}</li>`).join('')}</ol>` : ''}${result.events.length ? `<h3>${t('adminCertificateEvents')}</h3><ol>${result.events.map(entry => { let metadata = {}; try { metadata = JSON.parse(entry.metadata); } catch {} const label = entry.action === 'certificate.revoke' ? 'adminCertificateRevoke' : entry.action === 'certificate.reissue' ? 'adminCertificateReissue' : 'adminCertificateLineageEvent'; return `<li><strong>${t(label)}</strong> · ${e(dateLabel(entry.occurred_at))}${entry.actor_id ? ` · ${t('adminCertificateActor')}: ${e(entry.actor_id)}` : ''}${metadata.reason ? `<p>${t('adminCertificatePrivateReason')}: ${e(metadata.reason)}</p>` : ''}</li>`; }).join('')}</ol>` : ''}`
              : `<p>${t('adminCertificateNoHistory')}</p>`;
            history.dataset.loaded = 'true';
          } catch (error) {
            content.textContent = error.message || t('genericError');
          }
        });
        list.append(item);
      }
    } catch (error) {
      summary.textContent = '';
      list.innerHTML = `<p role="alert">${e(error.message || t('genericError'))}</p><button type="button" id="retry-certificates">${t('retry')}</button>`;
      list.querySelector('#retry-certificates').addEventListener('click', () => load().catch(notify));
    } finally {
      list.setAttribute('aria-busy', 'false');
    }
  }

  search.addEventListener('submit', event => {
    event.preventDefault();
    load().catch(notify);
  });
  await load();
}
