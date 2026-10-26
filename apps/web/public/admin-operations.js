const workerStatusKeys = {
  healthy: 'adminOpsWorkerHealthy',
  stale: 'adminOpsWorkerStale',
  stopped: 'adminOpsWorkerStopped',
};
const alertKeys = {
  WORKER_MISSING: 'adminOpsAlertWorkerMissing',
  WORKER_NOT_HEALTHY: 'adminOpsAlertWorkerNotHealthy',
  MEDIA_JOB_STUCK: 'adminOpsAlertMediaStuck',
  MEDIA_JOB_FAILED: 'adminOpsAlertMediaFailed',
  OUTBOX_EXHAUSTED: 'adminOpsAlertOutboxExhausted',
  STORAGE_LOW: 'adminOpsAlertStorageLow',
};
const playbackResourceKeys = {
  mp4: 'adminOpsPlaybackMp4',
  poster: 'adminOpsPlaybackPoster',
  caption: 'adminOpsPlaybackCaption',
  hls_playlist: 'adminOpsPlaybackPlaylist',
  hls_segment: 'adminOpsPlaybackSegment',
};
const playbackStatusKeys = {
  1: 'adminOpsPlaybackInformational',
  2: 'adminOpsPlaybackSuccess',
  3: 'adminOpsPlaybackRedirect',
  4: 'adminOpsPlaybackClientError',
  5: 'adminOpsPlaybackServerError',
};

export async function mountAdminOperations({ app, api, t, e, locale }) {
  app.innerHTML = `<a href="/admin">${t('administer')}</a><h1>${t('adminOperationsTitle')}</h1><div class="actions"><button type="button" id="ops-refresh">${t('adminOpsRefresh')}</button><a href="/admin/media">${t('adminMediaTitle')}</a><a href="/admin/orders">${t('adminOrdersTitle')}</a></div><p id="ops-updated" role="status" aria-live="polite"></p><p id="ops-error" role="alert"></p><section class="ops-section"><h2>${t('adminOpsWorkers')}</h2><div id="ops-workers"></div></section><section class="ops-section"><h2>${t('adminOpsMedia')}</h2><dl id="ops-media" class="ops-grid"></dl></section><section class="ops-section"><h2>${t('adminOpsOutbox')}</h2><dl id="ops-outbox" class="ops-grid"></dl></section><section class="ops-section"><h2>${t('adminOpsPayments')}</h2><dl id="ops-payments" class="ops-grid"></dl></section><section class="ops-section"><h2>${t('adminOpsStorage')}</h2><dl id="ops-storage" class="ops-grid"></dl></section><section class="ops-section"><h2>${t('adminOpsAlerts')}</h2><ul id="ops-alerts"></ul></section><section class="ops-section"><h2>${t('adminOpsPlayback')}</h2><p id="ops-playback-total"></p><dl id="ops-playback" class="ops-grid"></dl></section>`;

  const refresh = app.querySelector('#ops-refresh');
  const playbackSection = app.querySelector('#ops-playback').parentElement;
  const statusHeading = document.createElement('h3');
  statusHeading.textContent = t('adminOpsPlaybackStatus');
  const statusExplanation = document.createElement('p');
  statusExplanation.textContent = t('adminOpsPlaybackStatusExplanation');
  const statusCounts = document.createElement('dl');
  statusCounts.id = 'ops-playback-status';
  statusCounts.className = 'ops-grid';
  playbackSection.append(statusHeading, statusExplanation, statusCounts);
  const number = value => new Intl.NumberFormat(locale).format(Number(value) || 0);
  const fact = (label, value) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`;
  const formatBytes = value => `${number(value / 1024 ** 3)} GiB`;

  async function load() {
    refresh.disabled = true;
    app.querySelector('#ops-error').textContent = '';
    try {
      const summary = await api('/admin/operations');
      const workers = app.querySelector('#ops-workers');
      workers.replaceChildren();
      if (!summary.workers.length) {
        workers.textContent = t('adminOpsNoWorkers');
      } else {
        for (const worker of summary.workers) {
          const row = document.createElement('p');
          row.className = `ops-worker ops-${e(worker.status)}`;
          row.textContent = `${t(workerStatusKeys[worker.status] || 'adminOpsWorkerMissing')} · ${t('adminOpsLastSeen', { time: new Date(worker.lastSeenAt).toLocaleString(locale) })}`;
          workers.append(row);
        }
      }

      const media = Object.entries(summary.media.byStatus).map(([status, count]) =>
        fact(t(`video${status}`), number(count)));
      media.push(fact(t('adminOpsMediaStuck'), number(summary.media.stuck)));
      app.querySelector('#ops-media').innerHTML = media.join('');

      app.querySelector('#ops-outbox').innerHTML = [
        fact(t('adminOpsOutboxPending'), number(summary.outbox.pending)),
        fact(t('adminOpsOutboxExhausted'), number(summary.outbox.exhausted)),
        fact(t('adminOpsEmailPending'), number(summary.outbox.emailPending)),
        fact(t('adminOpsEmailExhausted'), number(summary.outbox.emailExhausted)),
      ].join('');

      const paymentEntries = Object.entries(summary.payments);
      app.querySelector('#ops-payments').innerHTML = paymentEntries.length
        ? paymentEntries.map(([state, count]) => fact(state, number(count))).join('')
        : fact(t('adminOpsNoPayments'), number(0));

      const storage = summary.storage;
      app.querySelector('#ops-storage').innerHTML = storage
        ? [
            fact(t('adminOpsStorageAvailable'), formatBytes(storage.availableBytes)),
            fact(t('adminOpsStorageTotal'), formatBytes(storage.totalBytes)),
          ].join('')
        : fact(t('adminOpsStorageUnknown'), '');

      app.querySelector('#ops-playback-total').textContent = t('adminOpsPlaybackTotal', {
        count: number(summary.playback.requests),
        days: number(summary.playback.windowDays),
      });
      app.querySelector('#ops-playback').innerHTML = Object.entries(summary.playback.byResource)
        .map(([resource, count]) => fact(t(playbackResourceKeys[resource] || 'genericError'), number(count)))
        .join('') + [
          fact(t('adminOpsPlaybackMeasured'), number(summary.playback.responseDuration.measuredRequests)),
          fact(t('adminOpsPlaybackDuration'), summary.playback.responseDuration.averageMs === null
            ? t('adminOpsPlaybackUnmeasured')
            : t('adminOpsPlaybackMilliseconds', { value: number(summary.playback.responseDuration.averageMs) })),
        ].join('');
      statusCounts.innerHTML = Object.entries(playbackStatusKeys)
        .map(([statusClass, key]) => fact(t(key), number(summary.playback.byStatusClass[statusClass] ?? 0)))
        .join('');

      const alerts = app.querySelector('#ops-alerts');
      alerts.replaceChildren();
      if (!summary.alerts.length) {
        alerts.textContent = t('adminOpsNoAlerts');
      } else {
        for (const code of summary.alerts) {
          const item = document.createElement('li');
          item.textContent = t(alertKeys[code] || 'genericError');
          alerts.append(item);
        }
      }
      app.querySelector('#ops-updated').textContent = t('adminOpsUpdated', {
        time: new Date(summary.generatedAt).toLocaleString(locale),
      });
    } catch (error) {
      app.querySelector('#ops-error').textContent = error.message || t('genericError');
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', () => load().catch(() => {}));
  await load();
}