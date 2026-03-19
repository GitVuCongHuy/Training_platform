// frontend-vite/src/pages/TrainModelPage/components/RenderMetrics.jsx
import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

export default function RenderMetrics({ metrics, taskType, compact = false }) {
  if (!metrics) {
    return (
      <Box sx={{ textAlign: 'center', py: compact ? 1.5 : 3 }}>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          No metrics calculated yet
        </Typography>
      </Box>
    );
  }

  const formatPct = (v) => (v != null ? (v * 100).toFixed(2) + '%' : '-');
  const formatNum = (v) => (v != null ? v.toFixed(4) : '-');

  const items = [];

  if (taskType === 'classification') {
    items.push({
      label: 'Accuracy (Top-1)',
      value: formatPct(metrics.accuracy_top1),
      icon: <CheckCircleIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#34d399',
      glow: 'rgba(52, 211, 153, 0.15)',
      border: 'rgba(52, 211, 153, 0.25)',
    });
    items.push({
      label: 'Accuracy (Top-5)',
      value: formatPct(metrics.accuracy_top5),
      icon: <CheckCircleIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#4ade80',
      glow: 'rgba(74, 222, 128, 0.15)',
      border: 'rgba(74, 222, 128, 0.25)',
    });
    items.push({
      label: 'Precision (Macro)',
      value: formatNum(metrics.precision_macro),
      icon: <TrendingUpIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#60a5fa',
      glow: 'rgba(96, 165, 250, 0.15)',
      border: 'rgba(96, 165, 250, 0.25)',
    });
    items.push({
      label: 'Recall (Macro)',
      value: formatNum(metrics.recall_macro),
      icon: <TrendingUpIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#818cf8',
      glow: 'rgba(129, 140, 248, 0.15)',
      border: 'rgba(129, 140, 248, 0.25)',
    });
    items.push({
      label: 'F1-Score (Macro)',
      value: formatNum(metrics.f1_macro),
      icon: <SpeedIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#fbbf24',
      glow: 'rgba(251, 191, 36, 0.15)',
      border: 'rgba(251, 191, 36, 0.25)',
    });
    items.push({
      label: 'F1-Score (Weighted)',
      value: formatNum(metrics.f1_weighted),
      icon: <SpeedIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#fb923c',
      glow: 'rgba(251, 146, 60, 0.15)',
      border: 'rgba(251, 146, 60, 0.25)',
    });
  } else if (taskType === 'detection') {
    items.push({ 
      label: 'mAP50', 
      value: formatNum(metrics.map50),
      icon: <AssessmentIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#34d399',
      glow: 'rgba(52, 211, 153, 0.15)',
      border: 'rgba(52, 211, 153, 0.25)',
    });
    items.push({ 
      label: 'mAP (0.5:0.95)', 
      value: formatNum(metrics.map),
      icon: <AssessmentIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#4ade80',
      glow: 'rgba(74, 222, 128, 0.15)',
      border: 'rgba(74, 222, 128, 0.25)',
    });
    items.push({ 
      label: 'Precision', 
      value: formatNum(metrics.precision),
      icon: <TrendingUpIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#60a5fa',
      glow: 'rgba(96, 165, 250, 0.15)',
      border: 'rgba(96, 165, 250, 0.25)',
    });
    items.push({ 
      label: 'Recall', 
      value: formatNum(metrics.recall),
      icon: <TrendingUpIcon sx={{ fontSize: compact ? 16 : 20 }} />,
      color: '#fbbf24',
      glow: 'rgba(251, 191, 36, 0.15)',
      border: 'rgba(251, 191, 36, 0.25)',
    });
  }

  return (
    <Box>
      <Grid container spacing={compact ? 1 : 1.5}>
        {items.length === 0 && (
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', textAlign: 'center', py: 2 }}>
              No metrics available for this task type
            </Typography>
          </Grid>
        )}
        
        {items.map((item) => (
          <Grid item xs={6} sm={4} md={compact ? 3 : 4} key={item.label}>
            <Box
              sx={{
                p: compact ? 1.5 : 2,
                background: item.glow,
                border: '1px solid',
                borderColor: item.border,
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: item.color,
                  boxShadow: `0 0 16px ${item.glow}`,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: compact ? 0.5 : 1 }}>
                <Box sx={{ color: item.color, display: 'flex' }}>
                  {item.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{ 
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    fontSize: compact ? '0.6rem' : '0.7rem',
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
              <Typography 
                variant={compact ? "h6" : "h5"}
                fontWeight={700}
                sx={{ color: item.color }}
              >
                {item.value}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}