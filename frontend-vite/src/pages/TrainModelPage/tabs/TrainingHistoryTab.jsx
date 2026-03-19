// frontend-vite/src/pages/TrainModelPage/tabs/TrainingHistoryTab.jsx
import React, { useState, useEffect } from 'react';
import {
  getTrainingHistory,
  getTrainingMetrics,
  deleteTrainingSession,
  downloadModel,
} from '../../../api';
import {
  Paper, Grid, Button, Typography, Chip, Box,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Tooltip, Stack, Card, CardContent, Dialog, DialogTitle, DialogContent,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { getStatusChipColor } from '../utils/getStatusChipColor';
import LossChart from '../components/LossChart';
import ConfusionMatrixHeatmap from '../components/ConfusionMatrixHeatmap';

function formatDate(isoString) {
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

function formatModelArch(modelArch) {
  if (!modelArch) return '';
  const parts = modelArch.split('_');
  if (parts.length < 3) return modelArch;

  const family = parts[0].toUpperCase();
  const version = parts[1];
  const size = parts[2];
  return `${family}${version}-${size}`;
}

export default function TrainingHistoryTab() {
  const [historyList, setHistoryList] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  // ===== NEW: dataset stats dialog =====
  const [openDatasetDialog, setOpenDatasetDialog] = useState(false);
  const [datasetStats, setDatasetStats] = useState(null);
  const [datasetSessionName, setDatasetSessionName] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const res = await getTrainingHistory();
      setHistoryList(res.data?.sessions || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleViewMetrics(id) {
    try {
      const res = await getTrainingMetrics(id);
      setSelectedMetrics(res.data || res);
      setOpenDialog(true);
    } catch (err) {
      console.error(err);
    }
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setTimeout(() => setSelectedMetrics(null), 200);
  }

  async function handleDeleteSession(id) {
    if (!confirm('Delete this training session?')) return;
    try {
      await deleteTrainingSession(id);
      loadHistory();
      if (selectedMetrics?.id === id) handleCloseDialog();
    } catch (err) {
      console.error(err);
    }
  }

  // ===== NEW: open dataset stats dialog =====
  function handleOpenDatasetStats(row) {
    setDatasetStats(row.dataset_stats_json || null);
    setDatasetSessionName(row.session_name || "");
    setOpenDatasetDialog(true);
  }

  const renderBestMetric = (row) => {
    if (row.status !== 'finished') return '-';
    if (row.task_type === 'classification') {
      return row.val_acc != null
        ? `${(row.val_acc * 100).toFixed(2)}%`
        : '-';
    }
    if (row.task_type === 'detection') {
      return row.best_map50 != null
        ? `${(row.best_map50 * 100).toFixed(2)}%`
        : '-';
    }
    return '-';
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={2}>
        <Grid item xs={12} size={12}>
          <Paper
            elevation={2}
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2.5,
                bgcolor: 'background.default',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight="600">
                Training History
              </Typography>
              <Button
                onClick={loadHistory}
                startIcon={<RefreshIcon />}
                variant="outlined"
                size="small"
              >
                Refresh
              </Button>
            </Box>

            <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 60, fontWeight: 700, bgcolor: 'background.paper' }}>
                      ID
                    </TableCell>

                    <TableCell sx={{ minWidth: 280, fontWeight: 700, bgcolor: 'background.paper' }}>
                      Session Details
                    </TableCell>

                    <TableCell sx={{ width: 110, fontWeight: 700, bgcolor: 'background.paper' }}>
                      Status
                    </TableCell>

                    <TableCell align="right" sx={{ width: 120, fontWeight: 700, bgcolor: 'background.paper' }}>
                      Best Metric
                    </TableCell>

                    {/* ===== NEW COLS ===== */}
                    <TableCell align="right" sx={{ width: 90, fontWeight: 700, bgcolor: 'background.paper' }}>
                      Epochs
                    </TableCell>

                    <TableCell align="right" sx={{ width: 110, fontWeight: 700, bgcolor: 'background.paper' }}>
                      GPU Max
                    </TableCell>

                    <TableCell align="center" sx={{ width: 130, fontWeight: 700, bgcolor: 'background.paper' }}>
                      Dataset
                    </TableCell>

                    <TableCell align="center" sx={{ width: 120, fontWeight: 700, bgcolor: 'background.paper' }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {historyList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          No training sessions found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyList.map((row) => (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="600">
                            #{row.id}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Stack spacing={0.8} sx={{ py: 0.5 }}>
                            <Typography
                              variant="body2"
                              fontWeight="700"
                              sx={{ lineHeight: 1.3 }}
                            >
                              {row.session_name}
                            </Typography>

                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                label={row.task_type === 'detection' ? 'Detection' : 'Classification'}
                                color={row.task_type === 'detection' ? 'success' : 'primary'}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 500 }}
                              />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                {formatModelArch(row.model_arch)}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <ScheduleIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                {formatDate(row.created_at)}
                              </Typography>
                            </Stack>
                          </Stack>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={row.status}
                            color={getStatusChipColor(row.status)}
                            size="small"
                            sx={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.75rem' }}
                          />
                        </TableCell>

                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight="700"
                            color={row.status === 'finished' ? 'primary' : 'text.secondary'}
                          >
                            {renderBestMetric(row)}
                          </Typography>
                        </TableCell>

                        {/* ===== NEW CELLS ===== */}
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="700">
                            {row.epochs ?? "-"}
                          </Typography>
                        </TableCell>

                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="700">
                            {row.gpu_mem_max != null
                              ? `${Number(row.gpu_mem_max).toFixed(2)} GB`
                              : "-"}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenDatasetStats(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            View
                          </Button>
                        </TableCell>

                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="View Metrics">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleViewMetrics(row.id)}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title={row.checkpoint_path ? "Download Model" : "No model available"}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  disabled={!row.checkpoint_path}
                                  onClick={() => downloadModel(row.checkpoint_path)}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>

                            <Tooltip title="Delete Session">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteSession(row.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* ===== Dialog metrics (cũ) ===== */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, maxHeight: '90vh' }
        }}
      >
        {selectedMetrics && (
          <>
            <DialogTitle
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: 'background.default',
                borderBottom: 1,
                borderColor: 'divider',
                py: 2,
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight="600">
                  {selectedMetrics.session_name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Chip
                    label={selectedMetrics.task_type}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Session #{selectedMetrics.id}
                  </Typography>
                </Stack>
              </Box>
              <IconButton onClick={handleCloseDialog} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8} size={7}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Typography
                        variant="subtitle2"
                        fontWeight="600"
                        sx={{
                          mb: 2,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: 'text.secondary',
                          fontSize: '0.75rem',
                          marginBottom: 15,
                        }}
                      >
                        Training Progress
                      </Typography>
                      <LossChart
                        taskType={selectedMetrics.task_type}
                        epochs={selectedMetrics.epochs}
                        trainLoss={(selectedMetrics.train_loss_history || []).slice(0, selectedMetrics.epochs)}
                        valLoss={(selectedMetrics.val_loss_history || []).slice(0, selectedMetrics.epochs)}
                        valAcc={(selectedMetrics.val_acc_history || []).slice(0, selectedMetrics.epochs)}
                        detectionMetrics={(selectedMetrics.detection_metrics_history_json || []).slice(0, selectedMetrics.epochs)}
                      />
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4} size={5}>
                  {selectedMetrics.confusion_matrix &&
                    selectedMetrics.confusion_matrix.length > 0 && (
                      <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight="600"
                            sx={{
                              mb: 2,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                            }}
                          >
                            Confusion Matrix
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <ConfusionMatrixHeatmap
                              matrix={selectedMetrics.confusion_matrix || []}
                              classes={selectedMetrics.class_names || []}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    )}
                </Grid>
              </Grid>
            </DialogContent>
          </>
        )}
      </Dialog>

      <Dialog
        open={openDatasetDialog}
        onClose={() => setOpenDatasetDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Dataset Statistics
            </Typography>
            {!!datasetSessionName && (
              <Typography variant="caption" color="text.secondary">
                {datasetSessionName}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setOpenDatasetDialog(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {!datasetStats ? (
            <Typography color="text.secondary">
              No dataset statistics available for this session.
            </Typography>
          ) : (
            <Stack spacing={2}>
              <Typography fontWeight={700}>
                Num classes: {datasetStats.num_classes ?? "-"}
              </Typography>

              {["train", "val", "test"].map((split) => {
                const s = datasetStats.splits?.[split];
                if (!s) return null;

                const perClass = s.per_class || {};
                const total = s.total ?? Object.values(perClass).reduce((a, b) => a + b, 0);

                return (
                  <Card key={split} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {split.toUpperCase()} — total: {total}
                      </Typography>

                      <Table size="small" sx={{ mt: 1 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Class</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Images</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.keys(perClass).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2}>
                                <Typography variant="body2" color="text.secondary">
                                  No per-class data.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            Object.entries(perClass).map(([cls, cnt]) => (
                              <TableRow key={cls}>
                                <TableCell>{cls}</TableCell>
                                <TableCell align="right">{cnt}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
