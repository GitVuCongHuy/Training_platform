// TrainModelPage/utils/metrics.js

export function calcF1(p, r) {
  if (p == null || r == null) return null;
  const denom = p + r;
  if (denom <= 0) return 0;
  return (2 * p * r) / denom;
}

export function resolveMeanMetric(metrics, key, taskType) {
  if (!metrics) return null;

  if (taskType === "classification") {
    const p =
      metrics.precision_macro ??
      metrics.precision_weighted ??
      metrics.precision ??
      null;

    const r =
      metrics.recall_macro ??
      metrics.recall_weighted ??
      metrics.recall ??
      null;

    if (key === "precision") return p;
    if (key === "recall") return r;
    if (key === "f1") {
      return (
        metrics.f1_macro ??
        metrics.f1_weighted ??
        metrics.f1 ??
        metrics.f1_score ??
        calcF1(p, r)
      );
    }
  }

  if (taskType === "detection") {
    const p = metrics.precision ?? null;
    const r = metrics.recall ?? null;

    if (key === "precision") return p;
    if (key === "recall") return r;
    if (key === "f1") {
      return (
        metrics.f1_score ??
        metrics.f1 ??
        calcF1(p, r)
      );
    }
  }

  return metrics[key] ?? null;
}

export function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return (Number(v) * 100).toFixed(2) + "%";
}

export function formatDate(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return isoString;
  }
}

export function renderBestMetric(metrics, taskType) {
  if (!metrics) return '-';
  if (taskType === 'classification') {
    return metrics.accuracy_top1 != null
      ? `${(metrics.accuracy_top1 * 100).toFixed(2)}%`
      : "-";
  }
  if (taskType === 'detection') {
    return metrics.map50 != null
      ? `${(metrics.map50 * 100).toFixed(2)}%`
      : "-";
  }
  return '-';
}

export function enrichTestingHistoryRows(historyList, { getSessionName, parseName }) {
  const rows = historyList.map((r) => {
    const session_name = getSessionName(r);
    const info = parseName(session_name);

    const f1 = resolveMeanMetric(r.metrics, "f1", r.task_type);
    const precision = resolveMeanMetric(r.metrics, "precision", r.task_type);
    const recall = resolveMeanMetric(r.metrics, "recall", r.task_type);

    return { ...r, session_name, info, f1, precision, recall };
  });

  const groups = {};
  rows.forEach((r) => {
    if (!r.info) return;
    const key = `${r.info.domain}_${r.info.type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  Object.values(groups).forEach((list) => {
    list.sort((a, b) => a.info.version - b.info.version);

    for (let i = 0; i < list.length; i++) {
      let j = i - 1;
      while (j >= 0) {
        const cand = list[j];
        const ok =
          cand.status === "finished" &&
          Number.isFinite(Number(cand.f1)) &&
          Number.isFinite(Number(cand.precision)) &&
          Number.isFinite(Number(cand.recall));
        if (ok) break;
        j--;
      }
      const prev = j >= 0 ? list[j] : null;

      list[i].prev_f1 = prev?.f1 ?? null;
      list[i].prev_precision = prev?.precision ?? null;
      list[i].prev_recall = prev?.recall ?? null;
    }
  });

  return rows;
}
