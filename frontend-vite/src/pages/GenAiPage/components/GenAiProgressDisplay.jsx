import React from 'react';
import {
  Paper,
  Stack,
  Box,
  Typography,
  LinearProgress,
  Chip,
} from '@mui/material';

// Component hiển thị tiến trình dành riêng cho GenAI
const GenAiProgressDisplay = ({ progress }) => {
  if (!progress || !progress.total_classes) {
    return null;
  }
  const numPerClass = progress.num_images_per_class || 500;
  const completed = Object.entries(progress.completed_classes || {});
  const overallPercentage =
    progress.overall_total > 0
      ? (progress.overall_progress / progress.overall_total) * 100
      : 0;

  return (
    <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="body1" gutterBottom>
            {progress.message}: {progress.current_class_index || 0} /{' '}
            {progress.total_classes} classes
          </Typography>
          <LinearProgress variant="determinate" value={overallPercentage} />
        </Box>

        {progress.current_class_name && (
          <Typography variant="body2" color="text.secondary">
            Processing class: <strong>{progress.current_class_name}</strong> (
            {progress.current_class_progress} / {numPerClass} ảnh)
          </Typography>
        )}

        {completed.length > 0 && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Đã hoàn thành:
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {completed.map(([name, count]) => (
                <Chip
                  key={name}
                  label={`${name} (${count}/${numPerClass})`}
                  color="success"
                  size="small"
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default GenAiProgressDisplay;