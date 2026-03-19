// frontend-vite/src/pages/TrainModelPage/tabs/TestModelTab.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { startTestSession, getTrainingHistory, getTrainingMetrics, validatePath } from '../../../api';
import {
  Alert, Paper, Grid, Stack, TextField, Button, Typography,
  Chip, LinearProgress, Box, Autocomplete, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Badge, Collapse, CircularProgress
} from '@mui/material';
import {
  Science as ScienceIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ErrorOutline as ErrorOutlineIcon
} from '@mui/icons-material';

import { useTestStatus } from '../hooks/useTestStatus';
import { getStatusChipColor } from '../utils/getStatusChipColor';
import RenderMetrics from '../components/RenderMetrics';
import ConfusionMatrixHeatmap from '../components/ConfusionMatrixHeatmap';

export default function TestModelTab() {
  const [historyList, setHistoryList] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(true);

  const [datasetPath, setDatasetPath] = useState(
    'D:\\huyvc1\\Fight\\Model_2D\\classification\\4_data_to_train\\v1\\no_talking\\test'
  );
  const [pathError, setPathError] = useState('');
  const [isValidatingPath, setIsValidatingPath] = useState(false);

  const [testId, setTestId] = useState(null);
  const { statusData, testMetrics, testCm, setStatusData } = useTestStatus(testId);
  const isRunning = statusData?.status === 'running';

  const validateDatasetPath = async (path) => {
    if (!path.trim()) {
      setPathError('Path cannot be empty');
      return false;
    }
    setIsValidatingPath(true);
    setPathError('');
    try {
      const res = await validatePath(path);
      if (!res.data.exists) {
        setPathError('Directory does not exist');
        return false;
      }
      return true;
    } catch (err) {
      console.error("Path validation error", err);
      // Assume valid if API fails to prevent blocking user incorrectly
      return true;
    } finally {
      setIsValidatingPath(false);
    }
  };

  // Initial validation
  useEffect(() => {
    validateDatasetPath(datasetPath);
  }, []);

  async function loadTrainHistory() {
    try {
      const res = await getTrainingHistory();
      const sessions = res.data?.sessions || [];
      setHistoryList(sessions);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadTrainHistory();
  }, []);

  const finishedSessions = useMemo(
    () => historyList.filter(s => s.status === 'finished'),
    [historyList]
  );

  function resolveModelPath(s) {
    if (!s) return '';
    return (
      s.checkpoint_path ||
      s.best_pt_path ||
      s.best_model_path ||
      s.best_path ||
      s.artifacts?.best_pt ||
      s.artifacts?.best ||
      ''
    );
  }

  const modelPath = resolveModelPath(selectedDetail);

  async function handleStartTest() {
    if (!selectedSession) return;

    if (!modelPath) {
      alert("Session này không có checkpoint_path. Hãy mở Training History xem session có artifact chưa.");
      return;
    }

    setTestId(null);
    try {
      const payload = {
        model_path: modelPath,
        dataset_path: datasetPath,
        session_name: selectedSession.session_name,
        training_id: selectedSession.id,
      };

      const res = await startTestSession(payload);
      const body = res.data ? res.data : res;

      setStatusData({
        ...body,
        status: 'running',
        percent: 0,
        task_type: selectedSession.task_type,
        session_name: selectedSession.session_name,
      });
      setTestId(body.test_id);
      setStatusDialogOpen(true); // Auto open dialog
    } catch (err) {
      console.error(err);
      alert('Failed to start test');
    }
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>
            🧪 Test Model Configuration
          </Typography>
          <IconButton onClick={loadTrainHistory} size="small" disabled={isRunning} color="primary">
            <RefreshIcon />
          </IconButton>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Select a trained model and test dataset to evaluate performance
        </Typography>

        <Stack spacing={3}>
          {/* Select Trained Session */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom textAlign="left">
              Select Trained Model
            </Typography>
            <Autocomplete
              fullWidth
              options={finishedSessions}
              value={selectedSession}
              onChange={async (e, v) => {
                setSelectedSession(v);
                setSelectedDetail(null);

                if (v?.id) {
                  try {
                    const res = await getTrainingMetrics(v.id);
                    setSelectedDetail(res.data || res);
                  } catch (err) {
                    console.error(err);
                    alert("Cannot get session details to find checkpoint.");
                  }
                }
              }}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              getOptionLabel={(opt) => opt?.session_name || ""}
              renderOption={(props, opt) => (
                <Box component="li" {...props}>
                  <Box sx={{ width: "100%", py: 0.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>
                        {opt.session_name}
                      </Typography>
                      <Chip
                        size="small"
                        label={opt.task_type}
                        color={opt.task_type === "detection" ? "success" : "primary"}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <Chip 
                        size="small" 
                        label={opt.model_arch} 
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      #{opt.id} • {new Date(opt.created_at).toLocaleString("vi-VN")}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select a finished training session..."
                  helperText="Only finished training sessions are shown"
                />
              )}
            />
          </Box>

          <Divider />

          {/* Model Path */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom textAlign="left">
              Model Checkpoint Path
            </Typography>
            <TextField
              fullWidth
              value={modelPath}
              InputProps={{ 
                readOnly: true,
                sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
              }}
              helperText="Automatically extracted from training session"
              placeholder="No model selected yet..."
            />
          </Box>

          {/* Dataset Path */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom textAlign="left">
              Test Dataset Path
            </Typography>
            <TextField
              fullWidth
              value={datasetPath}
              error={!!pathError}
              onChange={(e) => {
                const val = e.target.value;
                setDatasetPath(val);
                setPathError(''); // clear error while typing
              }}
              onBlur={() => validateDatasetPath(datasetPath)}
              placeholder="Path to your test dataset"
              sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
              helperText={
                pathError ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ErrorOutlineIcon fontSize="small" /> {pathError}
                  </span>
                ) : isValidatingPath ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CircularProgress size={12} /> Checking path...
                  </span>
                ) : "Directory containing test images"
              }
            />
          </Box>

          <Divider />

          {/* Action Buttons */}
          <Grid container spacing={2}>
            <Grid item xs={testId ? 6 : 12}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleStartTest}
                disabled={isRunning || !selectedSession || !!pathError || !datasetPath.trim()}
                startIcon={<ScienceIcon />}
                color="success"
                sx={{ py: 1.5, fontWeight: 600}}
              >
                {isRunning ? 'Testing in Progress...' : 'Start Testing'}
              </Button>
            </Grid>
            {testId && (
              <Grid item xs={6}>
                <Badge
                  badgeContent={isRunning ? "●" : ""}
                  color={isRunning ? "success" : "default"}
                  sx={{
                    width: '100%',
                    '& .MuiBadge-badge': {
                      animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
                    },
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                >
                  <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    color="primary"
                    onClick={() => setStatusDialogOpen(true)}
                    startIcon={<VisibilityIcon />}
                    sx={{ py: 1.5, fontWeight: 600 }}
                  >
                    View Results
                  </Button>
                </Badge>
              </Grid>
            )}
          </Grid>
        </Stack>
      </Paper>

      {/* Test Results Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh',
            overflowY: 'auto',
            maxWidth: '800px',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
        }}>
          <Typography variant="h6" fontWeight={700}>
            🧪 Test Results
          </Typography>
          <IconButton
            onClick={() => setStatusDialogOpen(false)}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {!testId && !statusData && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Test Session
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Start a test to see results here
              </Typography>
            </Box>
          )}

          {statusData && (
            <Stack spacing={3}>
              {/* Status Overview */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderWidth: 2,
                  borderColor: statusData.status === 'running'
                    ? 'primary.main'
                    : statusData.status === 'finished'
                      ? 'success.main'
                      : 'error.main',
                  backgroundColor: statusData.status === 'running'
                    ? 'rgba(25, 118, 210, 0.05)'
                    : statusData.status === 'finished'
                      ? 'rgba(46, 125, 50, 0.05)'
                      : 'rgba(211, 47, 47, 0.05)',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    Test Status
                  </Typography>
                  <Chip
                    label={statusData.status.toUpperCase()}
                    color={getStatusChipColor(statusData.status)}
                    sx={{ fontWeight: 700 }}
                    icon={statusData.status === 'finished' ? <CheckCircleIcon /> : statusData.status === 'failed' ? <WarningIcon /> : undefined}
                  />
                </Box>

                {statusData.session_name && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Session:</strong> {statusData.session_name}
                  </Typography>
                )}

                {statusData.task_type && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Task:</strong> {statusData.task_type}
                  </Typography>
                )}

                {(statusData.message || statusData.error_message) && (
                  <Alert 
                    severity={statusData.error_message ? "error" : "info"} 
                    sx={{ mb: 2 }}
                  >
                    {statusData.message || statusData.error_message}
                  </Alert>
                )}

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Progress
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {statusData.percent || 0}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={statusData.percent || 0}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: 'rgba(0,0,0,0.08)',
                    }}
                  />
                </Box>
              </Paper>

              {/* Metrics - Only show when finished */}
              {statusData.status === 'finished' && testMetrics && (
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      p: 2,
                      backgroundColor: 'success.50',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => setMetricsExpanded(!metricsExpanded)}
                  >
                    <Typography variant="subtitle1" fontWeight={700}>
                      📊 Performance Metrics
                    </Typography>
                    <IconButton size="small">
                      {metricsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  
                  <Collapse in={metricsExpanded}>
                    <Box sx={{ p: 2.5 }}>
                      <RenderMetrics metrics={testMetrics} taskType={statusData.task_type} />

                      {!!testCm?.length && (
                        <Box sx={{ mt: 3 }}>
                          <Divider sx={{ mb: 2 }} />
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                            📈 Confusion Matrix
                          </Typography>
                          <Box sx={{ 
                            overflowX: 'auto', 
                            pb: 2,
                            '&::-webkit-scrollbar': {
                              height: 8,
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              borderRadius: 4,
                            },
                          }}>
                            <ConfusionMatrixHeatmap
                              matrix={testCm}
                              classes={testMetrics?.class_names}
                            />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Paper>
              )}

              {/* Failed State */}
              {statusData.status === 'failed' && (
                <Alert severity="error" sx={{ fontSize: '0.95rem' }}>
                  <strong>Test Failed:</strong> {statusData.message || statusData.error_message}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>

        {statusData?.status === 'finished' && (
          <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setStatusDialogOpen(false)}
            >
              Close
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
}