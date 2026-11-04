function isoWeek(date) {
  const thursday = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 4 - (date.getUTCDay() || 7),
  ));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function newestPerPeriod(bundles, period, limit) {
  const groups = new Map();
  for (const bundle of bundles) {
    const key = period(bundle);
    const current = groups.get(key);
    if (!current) groups.set(key, bundle);
  }
  return [...groups.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, limit);
}

export function planBackupRetention(bundles, policy = { daily: 7, weekly: 4, monthly: 12 }) {
  const sorted = bundles
    .map(bundle => {
      const time = Date.parse(bundle.createdAt);
      if (!Number.isFinite(time) || new Date(time).toISOString() !== bundle.createdAt)
        throw new Error(`Invalid backup creation timestamp: ${bundle.name}`);
      return { ...bundle, time, date: new Date(time) };
    })
    .sort((left, right) => right.time - left.time || left.name.localeCompare(right.name));

  for (const [period, count] of Object.entries(policy)) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error(`Invalid ${period} retention count`);
  }

  const reasons = new Map(sorted.map(bundle => [bundle.name, []]));
  const tiers = [
    ['daily', bundle => bundle.date.toISOString().slice(0, 10)],
    ['weekly', bundle => isoWeek(bundle.date)],
    ['monthly', bundle => bundle.date.toISOString().slice(0, 7)],
  ];
  for (const [tier, period] of tiers) {
    for (const [key, bundle] of newestPerPeriod(sorted, period, policy[tier])) {
      reasons.get(bundle.name).push(`${tier}:${key}`);
    }
  }

  const retained = [];
  const candidates = [];
  for (const bundle of sorted) {
    const result = {
      name: bundle.name,
      createdAt: bundle.createdAt,
      keepReasons: reasons.get(bundle.name),
    };
    (result.keepReasons.length ? retained : candidates).push(result);
  }
  return { retained, candidates };
}
