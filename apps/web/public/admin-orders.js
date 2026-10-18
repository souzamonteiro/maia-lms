import { formatDate } from './i18n.js';

function amountMinor(value) {
  if (value === '') return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return NaN;
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}

const orderStatusKeys = {
  CREATED: 'orderStatusCreated',
  CHECKOUT_PENDING: 'orderStatusPending',
  PAID: 'orderStatusPaid',
  EXPIRED: 'orderStatusExpired',
  CANCELED: 'orderStatusCanceled',
  PARTIALLY_REFUNDED: 'orderStatusPartiallyRefunded',
  REFUNDED: 'orderStatusRefunded',
  CHARGEBACK: 'orderStatusChargeback',
};
const receiptStatusKeys = {
  not_queued: 'adminReceiptNotQueued',
  queued: 'adminReceiptQueued',
  retrying: 'adminReceiptRetrying',
  sent: 'adminReceiptSent',
};

export async function mountAdminOrders({ app, api, t, e, notify, locale }) {
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('adminOrdersTitle')}</h1><form id="order-search" class="user-filters"><label>${t('adminOrdersSearch')}<input name="q" type="search" maxlength="100"></label><label>${t('adminOrdersStatus')}<select name="state"><option value="">${t('adminOrdersAllStates')}</option>${Object.entries(orderStatusKeys).map(([state, key]) => `<option value="${state}">${t(key)}</option>`).join('')}</select></label><button type="submit">${t('adminUsersSearchAction')}</button></form><p id="order-summary" role="status" aria-live="polite"></p><div id="order-list" aria-busy="true"></div>`;
  const search = app.querySelector('#order-search');
  const summary = app.querySelector('#order-summary');
  const list = app.querySelector('#order-list');
  const formatDateLabel = value => formatDate(locale, value) ?? t('valueUnavailable');

  async function load() {
    list.setAttribute('aria-busy', 'true');
    list.textContent = t('adminOrdersLoading');
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      const filters = new FormData(search);
      if (filters.get('q')) params.set('q', filters.get('q'));
      if (filters.get('state')) params.set('state', filters.get('state'));
      const result = await api(`/admin/orders?${params}`);
      summary.textContent = t('adminOrdersCount', { count: result.total });
      list.replaceChildren();
      if (!result.items.length) list.innerHTML = `<p>${t('adminOrdersEmpty')}</p>`;
      for (const order of result.items) {
        const item = document.createElement('article');
        item.className = 'card admin-order';
        const total = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: order.currency,
        }).format(order.price_snapshot / 100);
        const refunded = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: order.currency,
        }).format(order.refunded_minor / 100);
        const pending = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: order.currency,
        }).format(order.pending_refund_minor / 100);
        item.innerHTML = `<h2>${e(order.course_title_snapshot)}</h2><p>${e(order.email)} · <code>${e(order.id)}</code></p><p>${t('orderStatusLabel')}: ${e(t(orderStatusKeys[order.state] || 'valueUnavailable'))} · ${e(total)}</p><p>${t('adminRefundedAmount')}: ${e(refunded)} · ${t('adminPendingRefundAmount')}: ${e(pending)}</p><p>${t('adminReceiptStatus')}: ${e(t(receiptStatusKeys[order.receipt_status] || 'valueUnavailable'))} · ${t('adminOrderCreated')}: ${e(formatDateLabel(order.created_at))}</p>${order.access_terms_snapshot ? `<p class="plain-content">${e(order.access_terms_snapshot)}</p>` : ''}<details class="admin-refund-details"><summary>${t('adminOrderRefundAction')}</summary><form class="admin-refund-form"><label>${t('adminRefundReason')}<input name="reason" minlength="5" maxlength="1000" required></label><label>${t('adminRefundAmount')}<input name="amount" type="number" min="0.01" step="0.01" max="${order.price_snapshot / 100}" placeholder="${t('adminRefundFullPlaceholder')}"></label><button type="submit" ${['PAID','PARTIALLY_REFUNDED'].includes(order.state) ? '' : 'disabled'}>${t('adminRefundSubmit')}</button></form></details><div class="actions">${['PAID','PARTIALLY_REFUNDED'].includes(order.state) ? `<details><summary>${t('adminChargebackAction')}</summary><form class="admin-chargeback-form"><label>${t('adminRefundReason')}<textarea name="reason" minlength="5" maxlength="1000" required></textarea></label><button type="submit">${t('adminChargebackSubmit')}</button></form></details>` : ''}<details><summary>${t('adminOrderHistory')}</summary><div class="order-history">${t('adminOrdersLoading')}</div></details></div>`;
        const refundForm = item.querySelector('.admin-refund-form');
        const refundReason = refundForm.querySelector('[name=reason]');
        const refundAmount = refundForm.querySelector('[name=amount]');
        const refundSubmit = refundForm.querySelector('button[type=submit]');
        const refundDetails = item.querySelector('.admin-refund-details');
        const storageKey = `maia-admin-refund:${order.id}`;
        let refundAttempt = null;
        try {
          refundAttempt = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        } catch {
          sessionStorage.removeItem(storageKey);
        }
        if (refundAttempt) {
          refundReason.value = refundAttempt.reason;
          refundAmount.value = refundAttempt.amount;
          refundReason.disabled = true;
          refundAmount.disabled = true;
          refundSubmit.textContent = t('adminRefundRetry');
          refundDetails.open = true;
        }
        refundForm.addEventListener('submit', async event => {
          event.preventDefault();
          const data = new FormData(refundForm);
          if (!refundAttempt) {
            refundAttempt = {
              idempotencyKey: crypto.randomUUID(),
              reason: String(data.get('reason') || ''),
              amount: String(data.get('amount') || ''),
            };
          }
          const minor = amountMinor(refundAttempt.amount);
          if (Number.isNaN(minor)) {
            notify(t('adminRefundAmountInvalid'));
            return;
          }
          sessionStorage.setItem(storageKey, JSON.stringify(refundAttempt));
          refundReason.disabled = true;
          refundAmount.disabled = true;
          refundSubmit.disabled = true;
          try {
            const response = await api(`/admin/orders/${order.id}/refunds`, 'POST', {
              idempotencyKey: refundAttempt.idempotencyKey,
              reason: refundAttempt.reason,
              ...(minor === null ? {} : { amountMinor: minor }),
            });
            if (response.status === 'pending') {
              refundSubmit.textContent = t('adminRefundRetry');
              notify(t('adminRefundPending'));
            } else {
              sessionStorage.removeItem(storageKey);
              notify(response.status === 'rejected' ? t('adminRefundRejected') : t('adminRefundSubmitted'));
            }
            await load();
          } catch (error) {
            notify(error);
            refundSubmit.disabled = false;
            refundSubmit.textContent = t('adminRefundRetry');
            refundDetails.open = true;
          }
        });
        item.querySelector('.admin-chargeback-form')?.addEventListener('submit', async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const reason = new FormData(form).get('reason');
          const submit = form.querySelector('button[type=submit]');
          submit.disabled = true;
          try {
            await api(`/admin/orders/${order.id}/chargeback`, 'POST', { reason });
            notify(t('adminChargebackSaved'));
            await load();
          } catch (error) {
            notify(error);
            submit.disabled = false;
          }
        });
        const history = item.querySelector('.order-history').parentElement;
        history.addEventListener('toggle', async () => {
          if (!history.open || history.dataset.loaded) return;
          const content = history.querySelector('.order-history');
          try {
            const result = await api(`/admin/orders/${order.id}/history`);
            content.innerHTML = result.items.length
              ? `<ol>${result.items.map(entry => `<li>${e(t(entry.action === 'order.refund' ? 'adminOrderEventRefund' : entry.action === 'order.chargeback' ? 'adminOrderEventChargeback' : entry.action === 'certificate.revoke' ? 'adminOrderEventCertificateRevoke' : 'adminOrderEventRefund'))} · ${e(formatDateLabel(entry.occurred_at))}${entry.metadata?.reason ? `<p>${e(entry.metadata.reason)}</p>` : ''}</li>`).join('')}</ol>`
              : `<p>${t('adminOrderHistoryEmpty')}</p>`;
            history.dataset.loaded = 'true';
          } catch (error) {
            content.textContent = error.message || t('genericError');
          }
        });
        list.append(item);
      }
    } catch (error) {
      summary.textContent = '';
      list.innerHTML = `<p role="alert">${e(error.message || t('genericError'))}</p><button type="button" id="retry-orders">${t('retry')}</button>`;
      list.querySelector('#retry-orders').addEventListener('click', () => load().catch(notify));
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