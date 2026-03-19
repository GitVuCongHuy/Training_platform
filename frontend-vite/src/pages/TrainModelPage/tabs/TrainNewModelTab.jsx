// frontend-vite/src/pages/TrainModelPage/tabs/TrainNewModelTab.jsx
import React, { useState, useMemo } from 'react';
import {
  startTrainingSession,
  stopTrainingSession,
} from '../../../api'; 
import {
  Paper, Grid, Stack, TextField, FormControl, InputLabel,
  Select, MenuItem, Button, Typography, Chip, LinearProgress, Box,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Divider, Badge, Collapse
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTrainingStatus } from '../hooks/useTrainingStatus';
import { useSessionNameSuggestion } from '../hooks/useSessionNameSuggestion';
import { getStatusChipColor } from '../utils/getStatusChipColor';

export default function TrainNewModelTab() {
  const [datasetPath, setDatasetPath] = useState('D:\\huyvc1\\Fight\\Model_2D\\classification\\4_data_to_train\\v1\\no_talking\\train');
  const [taskType, setTaskType] = useState('classification');
  const [modelFamily, setModelFamily] = useState('yolo');
  const [modelVersion, setModelVersion] = useState('v8');
  const [modelSize, setModelSize] = useState('n');
  const [augPreset, setAugPreset] = useState('none');
  const [epochs, setEpochs] = useState(30);
  const [lr, setLr] = useState(0.001);
  const [batchSize, setBatchSize] = useState(16);
  const [imgWidth, setImgWidth] = useState(640);
  const [imgHeight, setImgHeight] = useState(640);
  const [splitTrainRatio, setSplitTrainRatio] = useState(0.7);
  const [splitValRatio, setSplitValRatio] = useState(0.2);
  const [splitTestRatio, setSplitTestRatio] = useState(0.1);
  const [trainingId, setTrainingId] = useState(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [polledStatusData, setStatusData] = useTrainingStatus(trainingId);
  const statusData = polledStatusData; 
  const isRunning = statusData?.status === 'running';
  
  const {
    sessionName,
    rawSessionName,
    isDuplicateName,
    suggestedName,
    isSuffixInvalid,
    handleSessionNameChange,
    applySuggestedName,
  } = useSessionNameSuggestion(taskType);
  
  const augOptions = useMemo(() => {
    if (taskType === 'classification') {
      return [
        { value: 'none', label: 'No Augmentation' },
        { value: 'basic_cls', label: 'Basic (flip/color)' },
        { value: 'heavy_cls', label: 'Heavy (crop/blur)' },
      ];
    }
    return [
      { value: 'none', label: 'No Augmentation' },
      { value: 'light_det', label: 'Light Detection' },
      { value: 'mosaic_det', label: 'Mosaic/HSV Detection' },
    ];
  }, [taskType]);

  async function handleStartTraining() {
    try {
      const payload = {
        session_name: sessionName || null,
        dataset_path: datasetPath,
        task_type: taskType,
        model_family: modelFamily,
        model_version: modelVersion,
        model_size: modelSize,
        aug_preset: augPreset,
        epochs: Number(epochs),
        lr: Number(lr),
        batch_size: Number(batchSize),
        img_width: Number(imgWidth),
        img_height: Number(imgHeight),
        split_train_ratio: Number(splitTrainRatio),
        split_val_ratio: Number(splitValRatio),
        split_test_ratio: Number(splitTestRatio),
      };
      const res = await startTrainingSession(payload);
      const body = res.data ? res.data : res;
      
      setStatusData({
        ...body,
        status: 'running',
        current_epoch: 0,
        total_epochs: payload.epochs,
        task_type: payload.task_type, 
      });
      setTrainingId(body.training_id);
      setStatusDialogOpen(true); // Auto open dialog when training starts
    } catch (err) {
      console.error(err);
      alert('Failed to start training');
    }
  }

  async function handleManualRefresh() {
    if (!trainingId) return;
    try {
      console.log("Refreshing status...");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStopTraining() {
    if (!trainingId) return;
    try {
      await stopTrainingSession(trainingId);
    } catch (err) {
      console.error(err);
      alert('Failed to stop training');
    }
  }

  let progressPct = 0;
  if (statusData?.current_epoch != null && statusData?.total_epochs) {
    const cur = Number(statusData.current_epoch);
    const tot = Number(statusData.total_epochs);
    if (tot > 0) {
      progressPct = Math.min(100, (cur / tot) * 100);
    }
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom sx={{ mb: 3 }}>
           Training Configuration
        </Typography>
        
        <Stack spacing={3}>
          {/* Session Name */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom textAlign="left">
              Session Name
            </Typography>
            <TextField
              fullWidth
              value={rawSessionName}
              onChange={handleSessionNameChange}
              placeholder="e.g. fight_v3 or fight_version3"
              variant="outlined"
              error={!sessionName.trim() || isDuplicateName || isSuffixInvalid}
              helperText={
                !sessionName.trim()
                  ? "⚠️ Session name is required"
                  : isDuplicateName
                    ? "⚠️ Session name already exists"
                    : isSuffixInvalid
                      ? "⚠️ Name must end with _vX or _versionX (e.g. fight_v2)"
                      : "✓ Auto-suffix will be added based on task type"
              }
            />
            {suggestedName && (
              <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  💡 Suggestion:
                </Typography>
                <Chip
                  label={suggestedName}
                  size="small"
                  color="info"
                  variant="outlined"
                  onClick={applySuggestedName}
                  clickable
                />
              </Box>
            )}
          </Box>

          {/* Dataset Path */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom textAlign="left">
              Dataset Path
            </Typography>
            <TextField
              fullWidth
              value={datasetPath}
              onChange={(e) => setDatasetPath(e.target.value)}
              placeholder="Path to your training dataset"
              sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />
          </Box>

          <Divider />

          {/* Task Type & Model */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Task Type
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={taskType}
                  onChange={(e) => {
                    setTaskType(e.target.value);
                    setAugPreset("none");
                  }}
                >
                  <MenuItem value="classification">Classification</MenuItem>
                  <MenuItem value="detection">Detection</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Data Augmentation
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={augPreset}
                  onChange={(e) => setAugPreset(e.target.value)}
                >
                  {augOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Model Architecture */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom textAlign="left" sx={{ mb: 2 }}>
              Model Architecture
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Family</InputLabel>
                  <Select value={modelFamily} label="Family">
                    <MenuItem value="yolo">YOLO</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Version</InputLabel>
                  <Select
                    value={modelVersion}
                    label="Version"
                    onChange={(e) => setModelVersion(e.target.value)}
                  >
                    <MenuItem value="v8">YOLOv8</MenuItem>
                    <MenuItem value="v11">YOLOv11</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Size</InputLabel>
                  <Select
                    value={modelSize}
                    label="Size"
                    onChange={(e) => setModelSize(e.target.value)}
                  >
                    <MenuItem value="n">Nano</MenuItem>
                    <MenuItem value="s">Small</MenuItem>
                    <MenuItem value="m">Medium</MenuItem>
                    <MenuItem value="l">Large</MenuItem>
                    <MenuItem value="x">XLarge</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Training Parameters */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom textAlign="left" sx={{ mb: 2 }}>
              Training Parameters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Epochs"
                  value={epochs}
                  onChange={(e) => setEpochs(e.target.value)}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Batch Size"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  size="small"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Learning Rate"
                  value={lr}
                  onChange={(e) => setLr(e.target.value)}
                  inputProps={{ step: "0.0001" }}
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Advanced Settings */}
          <Box>
            <Button
              fullWidth
              onClick={() => setAdvancedOpen(!advancedOpen)}
              endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ justifyContent: 'space-between', color: 'text.secondary' }}
            >
              Advanced Settings
            </Button>
            <Collapse in={advancedOpen}>
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Image Width"
                      value={imgWidth}
                      onChange={(e) => setImgWidth(e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Image Height"
                      value={imgHeight}
                      onChange={(e) => setImgHeight(e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Dataset Split Ratios (if not pre-split)
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Train"
                      value={splitTrainRatio}
                      onChange={(e) => setSplitTrainRatio(e.target.value)}
                      inputProps={{ step: "0.1" }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Validation"
                      value={splitValRatio}
                      onChange={(e) => setSplitValRatio(e.target.value)}
                      inputProps={{ step: "0.1" }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Test"
                      value={splitTestRatio}
                      onChange={(e) => setSplitTestRatio(e.target.value)}
                      inputProps={{ step: "0.1" }}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Box>

          <Divider />

          {/* Action Buttons */}
          <Grid container spacing={2}>
            <Grid item xs={trainingId ? 6 : 12}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                color={isRunning ? "error" : "success"}
                onClick={isRunning ? handleStopTraining : handleStartTraining}
                startIcon={isRunning ? <StopIcon /> : <PlayArrowIcon />}
                disabled={isRunning || isDuplicateName || isSuffixInvalid || !sessionName.trim()}
                sx={{ py: 1.5, fontWeight: 600 }}
              >
                {isRunning ? "Stop Training" : "Start Training"}
              </Button>
            </Grid>
            {trainingId && (
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
                    View Status
                  </Button>
                </Badge>
              </Grid>
            )}
          </Grid>
        </Stack>
      </Paper>

      {/* Training Status Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh',
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
            📊 Training Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={handleManualRefresh}
              disabled={!trainingId}
              size="small"
              color="primary"
            >
              <RefreshIcon />
            </IconButton>
            <IconButton
              onClick={() => setStatusDialogOpen(false)}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {!trainingId && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Active Training
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Start a training session to see progress
              </Typography>
            </Box>
          )}

          {trainingId && statusData && (
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
                    Current Status
                  </Typography>
                  <Chip
                    label={statusData.status.toUpperCase()}
                    color={getStatusChipColor(statusData.status)}
                    sx={{ fontWeight: 700 }}
                  />
                </Box>

                {statusData.error_message && (
                  <Typography variant="body2" color="error.main" sx={{ mb: 2 }}>
                    ⚠️ {statusData.error_message}
                  </Typography>
                )}

                {statusData.best_metric_note && !statusData.error_message && (
                  <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
                    ✓ {statusData.best_metric_note}
                  </Typography>
                )}

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Training Progress
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      Epoch {statusData.current_epoch || 0} / {statusData.total_epochs || 0}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progressPct}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: 'rgba(0,0,0,0.08)',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
                    {progressPct.toFixed(1)}% Complete
                  </Typography>
                </Box>
              </Paper>

              {/* Metrics */}
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mb: 2 }}>
                  📈 Performance Metrics
                </Typography>
                <Grid container spacing={2}>
                  {[
                    {
                      label: "Train Loss",
                      value: statusData.train_loss,
                      format: (v) => v.toFixed(4),
                      color: 'error.main',
                    },
                    {
                      label: "Val Loss",
                      value: statusData.val_loss,
                      format: (v) => v.toFixed(4),
                      color: 'warning.main',
                    },
                    ...(statusData.task_type === 'classification' ? [{
                      label: "Val Accuracy",
                      value: statusData.val_acc,
                      format: (v) => (v * 100).toFixed(2) + "%",
                      color: 'success.main',
                    }] : []),
                    ...(statusData.task_type === 'detection' ? [{
                      label: "mAP@0.5",
                      value: statusData.best_map50,
                      format: (v) => v.toFixed(4),
                      color: 'info.main',
                    }] : []),
                  ].map((metric) => (
                    <Grid item xs={6} key={metric.label}>
                      <Box sx={{ 
                        p: 1.5, 
                        backgroundColor: 'rgba(12, 194, 21, 0.15)', 
                        borderRadius: 1,
                        textAlign: 'center',
                      }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                          {metric.label}
                        </Typography>
                        <Typography variant="h6" fontWeight={700} sx={{ color: metric.color }}>
                          {metric.value != null ? metric.format(Number(metric.value)) : "-"}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Checkpoint Path */}
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mb: 1.5 }}>
                  📁 Output Files
                </Typography>
                <Box sx={{
                  p: 1.5,
                  backgroundColor: 'rgba(12, 194, 21, 0.15)',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.300',
                }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Checkpoint:
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.7rem',
                      wordBreak: 'break-all',
                      color: statusData.checkpoint_path ? 'text.primary' : 'text.disabled',
                    }}
                  >
                    {statusData.checkpoint_path || "Not available yet"}
                  </Typography>
                </Box>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        {trainingId && isRunning && (
          <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
            <Button
              fullWidth
              variant="contained"
              color="error"
              onClick={handleStopTraining}
              startIcon={<StopIcon />}
              sx={{ py: 1.5, fontWeight: 600 }}
            >
              Stop Training
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
}