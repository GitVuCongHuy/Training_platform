// frontend-vite/src/pages/TrainModelPage/components/LossChart.jsx
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Typography, Box, Paper } from '@mui/material';

export default function LossChart({ 
  taskType, 
  trainLoss, 
  valLoss, 
  valAcc, 
  detectionMetrics 
}) {
  if (!trainLoss || trainLoss.length === 0) {
    return (
      <Box
        sx={{ 
          p: 4, 
          textAlign: 'center',
          bgcolor: 'grey.50',
          borderRadius: 1,
          border: 1,
          borderColor: 'grey.200',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No training data available yet
        </Typography>
      </Box>
    );
  }

  const isClassification = taskType === 'classification';
  const metricName = isClassification ? 'Val Acc (%)' : 'mAP@0.5';
  const metricKey = isClassification ? 'val_acc' : 'val_metric';

  const data = trainLoss.map((loss, idx) => {
    const entry = {
      epoch: idx + 1,
      train_loss: loss,
      val_loss: valLoss?.[idx] || null,
    };
    
    if (isClassification) {
      entry.val_acc = valAcc?.[idx] ? valAcc[idx] * 100 : null;
    } else {
      entry.val_metric = detectionMetrics?.[idx] ? detectionMetrics[idx] * 100 : null;
    }
    
    return entry;
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Paper
          elevation={4}
          sx={{
            p: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.98)',
            border: 1,
            borderColor: 'grey.300',
            borderRadius: 1,
            minWidth: 140,
          }}
        >
          <Typography 
            variant="body2" 
            fontWeight="600" 
            sx={{ mb: 0.5, color: 'text.primary' }}
          >
            Epoch {payload[0].payload.epoch}
          </Typography>
          {payload.map((entry, index) => (
            <Box 
              key={index}
              sx={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1.5,
                mt: 0.5,
              }}
            >
              <Typography 
                variant="caption"
                sx={{ 
                  color: entry.color,
                  fontWeight: 500,
                }}
              >
                {entry.name}:
              </Typography>
              <Typography 
                variant="caption"
                fontWeight="600"
                sx={{ color: entry.color }}
              >
                {entry.value?.toFixed(4)}
              </Typography>
            </Box>
          ))}
        </Paper>
      );
    }
    return null;
  };

  const totalEpochs = data.length;
  const xAxisTicks = totalEpochs > 20 
    ? Array.from({ length: 6 }, (_, i) => Math.floor((totalEpochs / 5) * i) || 1)
    : undefined;

  return (
    <Box sx={{ width: '100%', height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data}
          margin={{ top: 10, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e0e0e0" 
            opacity={0.6} 
          />
          <XAxis
            dataKey="epoch"
            label={{ 
              value: 'Epoch', 
              position: 'insideBottom', 
              offset: -5,
              style: { 
                fontSize: '12px', 
                fontWeight: '600', 
                fill: '#666' 
              }
            }}
            ticks={xAxisTicks}
            tick={{ fontSize: 11, fill: '#666' }}
            stroke="#999"
            tickLine={{ stroke: '#999' }}
          />
          <YAxis
            yAxisId="left"
            label={{ 
              value: 'Loss', 
              angle: -90, 
              position: 'insideLeft',
              style: { 
                fontSize: '12px', 
                fontWeight: '600', 
                fill: '#666' 
              }
            }}
            tick={{ fontSize: 11, fill: '#666' }}
            stroke="#999"
            tickLine={{ stroke: '#999' }}
            domain={['auto', 'auto']}
            width={45}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ 
              value: metricName, 
              angle: 90, 
              position: 'insideRight',
              style: { 
                fontSize: '12px', 
                fontWeight: '600', 
                fill: '#666' 
              }
            }}
            tick={{ fontSize: 11, fill: '#666' }}
            stroke="#999"
            tickLine={{ stroke: '#999' }}
            domain={[0, 100]}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ 
              paddingTop: '12px',
              fontSize: '12px',
            }}
            iconType="line"
            iconSize={16}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="train_loss"
            stroke="#ef5350"
            strokeWidth={2.5}
            name="Train Loss"
            dot={totalEpochs <= 15 ? { r: 3, fill: '#ef5350', strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: '#ef5350', strokeWidth: 2, stroke: '#fff' }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="val_loss"
            stroke="#ff9800"
            strokeWidth={2.5}
            name="Val Loss"
            dot={totalEpochs <= 15 ? { r: 3, fill: '#ff9800', strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: '#ff9800', strokeWidth: 2, stroke: '#fff' }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={metricKey}
            stroke="#66bb6a"
            strokeWidth={2.5}
            name={metricName}
            dot={totalEpochs <= 15 ? { r: 3, fill: '#66bb6a', strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: '#66bb6a', strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}