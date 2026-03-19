import React, { useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent,
  IconButton, Box, Chip, Stack, Typography,
  Card, CardContent
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";

function parseSessionName(name) {
  if (!name || typeof name !== "string") return null;
  const regex = /(.*?)_v(?:ersion)?(\d+)_(cls|det)$/i;
  const m = name.match(regex);
  if (!m) return null;

  return {
    domain: m[1],
    version: Number(m[2]),
    type: m[3].toLowerCase(), // cls | det
  };
}

function calcF1(p, r) {
  if (p == null || r == null) return null;
  const denom = p + r;
  if (denom <= 0) return 0;
  return (2 * p * r) / denom;
}

/**
 * Resolve metric with SAME "mean-level" reference:
 * - classification: prefer *_macro, fallback *_weighted, then raw
 * - detection: use raw precision/recall mean, compute f1 if missing
 */
function resolveMetric(metrics, metricKey, taskType) {
  if (!metrics) return null;

  if (taskType === "classification") {
    if (metricKey === "f1") {
      return (
        metrics.f1_macro ??
        metrics.f1_weighted ??
        metrics.f1 ??
        metrics.f1_score ??
        null
      );
    }
    if (metricKey === "precision") {
      return (
        metrics.precision_macro ??
        metrics.precision_weighted ??
        metrics.precision ??
        null
      );
    }
    if (metricKey === "recall") {
      return (
        metrics.recall_macro ??
        metrics.recall_weighted ??
        metrics.recall ??
        null
      );
    }
  }

  if (taskType === "detection") {
    const p = metrics.precision ?? null;
    const r = metrics.recall ?? null;

    if (metricKey === "precision") return p;
    if (metricKey === "recall") return r;

    if (metricKey === "f1") {
      return (
        metrics.f1_score ??
        metrics.f1 ??
        calcF1(p, r)
      );
    }
  }

  return metrics[metricKey] ?? null;
}

export default function OverallImprovementDialog({
  open,
  onClose,
  historyList = [],
}) {
  const [metric, setMetric] = useState("f1");

  const grouped = useMemo(() => {
    const groups = {};

    historyList.forEach((row) => {
      const info = parseSessionName(row?.session_name);
      if (!info) return;

      if (row.status && row.status !== "finished") return;
      if (!row.metrics) return;

      const key = `${info.domain}_${info.type}`; // fight_cls, fight_det
      if (!groups[key]) groups[key] = [];

      groups[key].push({
        version: info.version,
        task_type: row.task_type,
        f1: resolveMetric(row.metrics, "f1", row.task_type),
        precision: resolveMetric(row.metrics, "precision", row.task_type),
        recall: resolveMetric(row.metrics, "recall", row.task_type),
      });
    });

    Object.keys(groups).forEach((k) => {
      groups[k] = groups[k]
        .filter(e => e.version != null)
        .sort((a, b) => a.version - b.version);
    });

    return groups;
  }, [historyList]);

  const seriesKeys = Object.keys(grouped);

  const chartData = useMemo(() => {
    if (!seriesKeys.length) return [];

    const allVersions = new Set();
    seriesKeys.forEach((k) => {
      grouped[k].forEach((e) => allVersions.add(e.version));
    });

    const versionList = [...allVersions].sort((a, b) => a - b);

    return versionList.map((v) => {
      const row = { version: v };
      seriesKeys.forEach((key) => {
        const match = grouped[key].find((x) => x.version === v);
        row[key] = match ? match[metric] : null;
      });
      return row;
    });
  }, [grouped, metric, seriesKeys]);

  const colorPool = [
    "#ff6b6b", "#4dabf7", "#8e44ad",
    "#f1c40f", "#1abc9c", "#e67e22",
    "#2ecc71", "#e84393", "#3498db"
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between" }}>
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={700}>
            Overall Improvement
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Trends across model versions
          </Typography>
        </Stack>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {["f1", "precision", "recall"].map((m) => (
            <Chip
              key={m}
              label={m.toUpperCase()}
              color={metric === m ? "primary" : "default"}
              onClick={() => setMetric(m)}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>

        {!seriesKeys.length && (
          <Typography color="text.secondary">
            No valid session name found (_vX_cls / _vX_det) or no metrics available.
          </Typography>
        )}

        {!!seriesKeys.length && (
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="version" tickFormatter={(v) => `v${v}`} />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />

                {seriesKeys.map((key, idx) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colorPool[idx % colorPool.length]}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

{!!seriesKeys.length && (
  <Stack direction="row" spacing={2} sx={{ mt: 3, flexWrap: "wrap" }}>
    {seriesKeys.map((key) => {
      const list = grouped[key];
      if (!list || list.length === 0) return null;

      const last = list[list.length - 1][metric];
      if (last == null) return null;

      const hasPrev = list.length >= 2;
      const prev = hasPrev ? list[list.length - 2][metric] : null;

      const delta = hasPrev && prev != null ? last - prev : null;

      return (
        <Card key={key} sx={{ minWidth: 200, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700}>
              {key}
            </Typography>

            <Typography sx={{ mt: 0.5 }}>
              Latest: {last.toFixed(3)}
            </Typography>

            {delta == null ? (
              <Typography color="text.secondary" fontWeight={700}>
                — NEW
              </Typography>
            ) : (
              <Typography
                sx={{
                  fontWeight: 800,
                  color: delta >= 0 ? "success.main" : "error.main",
                }}
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(3)}
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary">
              {delta == null ? "first version" : "vs previous version"}
            </Typography>
          </CardContent>
        </Card>
      );
    })}
  </Stack>
)}

      </DialogContent>
    </Dialog>
  );
}
