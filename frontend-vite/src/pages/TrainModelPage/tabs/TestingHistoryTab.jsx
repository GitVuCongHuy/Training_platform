// TrainModelPage/tabs/TestingHistoryTab.jsx
import React, { useMemo } from "react";
import { Paper, Grid, Button, Typography, Box, Dialog, DialogTitle, DialogContent, IconButton, Stack, Card, CardContent, Chip } from "@mui/material";
import { Refresh as RefreshIcon, Close as CloseIcon } from "@mui/icons-material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import RenderMetrics from "../components/RenderMetrics";
import ConfusionMatrixHeatmap from "../components/ConfusionMatrixHeatmap";
import OverallImprovementDialog from "../components/OverallImprovementDialog";
import TestingHistoryTable from "../components/TestingHistoryTable";

import { useTestingHistory } from "../hooks/useTestingHistory";
import { getRowSessionName, parseSessionName } from "../utils/sessionName";
import { resolveMeanMetric } from "../utils/metrics";

export default function TestingHistoryTab() {
  const {
    historyList,
    selectedMetrics,
    openDialog,
    openImprovement,
    setOpenImprovement,
    loadHistory,
    handleViewMetrics,
    handleCloseDialog,
    handleDeleteSession,
  } = useTestingHistory();

  const historyForChart = useMemo(() => {
    return historyList.map((r) => {
      const sn = getRowSessionName(r);
      return { ...r, session_name: sn };
    });
  }, [historyList]);

  const enrichedRows = useMemo(() => {
    const rows = historyList
      .map((r) => {
        const session_name = getRowSessionName(r);
        const info = parseSessionName(session_name);

        const f1 = resolveMeanMetric(r.metrics, "f1", r.task_type);
        const precision = resolveMeanMetric(r.metrics, "precision", r.task_type);
        const recall = resolveMeanMetric(r.metrics, "recall", r.task_type);

        return { ...r, session_name, info, f1, precision, recall };
      })
      .filter((r) => r.info != null);

    const groups = {};
    rows.forEach((r) => {
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
            Number(cand.f1) > 0 &&
            Number(cand.precision) > 0 &&
            Number(cand.recall) > 0;
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
  }, [historyList]);

  return (
    <Box sx={{ width: "100%" }}>
      <Grid container spacing={2}>
        <Grid item xs={12} size={12}>
          <Paper elevation={2} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="h6" fontWeight="600">Testing History</Typography>

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="contained" startIcon={<TrendingUpIcon />} onClick={() => setOpenImprovement(true)} size="small">
                  Overall Improvement
                </Button>
                <Button onClick={loadHistory} startIcon={<RefreshIcon />} variant="outlined" size="small">
                  Refresh
                </Button>
              </Box>
            </Box>

            <TestingHistoryTable
              rows={enrichedRows}
              onView={handleViewMetrics}
              onDelete={handleDeleteSession}
            />
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh" } }}>
        {selectedMetrics && (
          <>
            <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "background.default", borderBottom: 1, borderColor: "divider", py: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight="700">Test Results</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Chip label={selectedMetrics.task_type} size="small" color="primary" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">Session #{selectedMetrics.id}</Typography>
                </Stack>
              </Box>
              <IconButton onClick={handleCloseDialog} size="small"><CloseIcon /></IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                {/* Paths Info */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="700">Model Path</Typography>
                        <Typography variant="body2" sx={{ wordBreak: "break-all", mt: 0.5, fontFamily: "monospace", fontSize: '0.8rem' }}>
                          {selectedMetrics.model_path}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="700">Dataset Path</Typography>
                        <Typography variant="body2" sx={{ wordBreak: "break-all", mt: 0.5, fontFamily: "monospace", fontSize: '0.8rem' }}>
                          {selectedMetrics.dataset_path}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" fontWeight="800" sx={{ mb: 2, color: "text.secondary" }}>
                      Performance Metrics
                    </Typography>
                    <RenderMetrics metrics={selectedMetrics.metrics} taskType={selectedMetrics.task_type} />
                  </CardContent>
                </Card>

                {/* Confusion Matrix */}
                {selectedMetrics.confusion_matrix?.length > 0 && (
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="subtitle2" fontWeight="800" sx={{ mb: 2, color: "text.secondary" }}>
                        Confusion Matrix
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <ConfusionMatrixHeatmap matrix={selectedMetrics.confusion_matrix} classes={selectedMetrics.metrics?.class_names} />
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>

      <OverallImprovementDialog open={openImprovement} onClose={() => setOpenImprovement(false)} historyList={historyForChart} />
    </Box>
  );
}
