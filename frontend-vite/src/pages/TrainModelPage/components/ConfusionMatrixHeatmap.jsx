// frontend-vite/src/pages/TrainModelPage/components/ConfusionMatrixHeatmap.jsx
import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

export default function ConfusionMatrixHeatmap({ 
  matrix: originalMatrix, 
  classes: originalClasses,
  compact = false,
  maxSize = 560
}) {
  
  const { matrix, classes } = useMemo(() => {
    if (originalClasses && Array.isArray(originalClasses) &&
        originalMatrix && Array.isArray(originalMatrix) &&
        originalMatrix.length > originalClasses.length)
    {
      const realSize = originalClasses.length;
      const newMatrix = originalMatrix
        .slice(0, realSize)
        .map(row => row.slice(0, realSize));
      return { matrix: newMatrix, classes: originalClasses };
    }
    return { matrix: originalMatrix, classes: originalClasses };
  }, [originalMatrix, originalClasses]);

  if (!matrix || matrix.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: compact ? 2 : 3 }}>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          No confusion matrix available
        </Typography>
      </Box>
    );
  }

  const numClasses = matrix.length; 
  const classLabels = useMemo(() => {
    if (classes && classes.length === numClasses) return classes;
    return Array.from({ length: numClasses }, (_, i) => `Class ${i}`);
  }, [classes, numClasses]);

  const cellSize = useMemo(() => {
    if (compact) {
      if (numClasses <= 5) return 48;
      if (numClasses <= 10) return 36;
      if (numClasses <= 15) return 28;
      return 22;
    }
    if (numClasses <= 5) return 64;
    if (numClasses <= 10) return 48;
    if (numClasses <= 15) return 38;
    return 28;
  }, [numClasses, compact]);

  const totalSize = cellSize * numClasses;
  const scale = totalSize > maxSize ? maxSize / totalSize : 1;
  const adjustedCellSize = Math.floor(cellSize * scale);

  const maxVal = Math.max(...matrix.flat());

  // Color interpolation for heatmap
  const getCellColor = (val, isCorrect) => {
    const intensity = maxVal > 0 ? val / maxVal : 0;
    if (isCorrect) {
      // Green diagonal: from dark teal to vivid green
      return `rgba(52, 211, 153, ${Math.max(0.15, intensity * 0.85)})`;
    }
    // Off-diagonal: from transparent to a warm orange-red
    if (val === 0) return 'rgba(255, 255, 255, 0.02)';
    return `rgba(251, 146, 60, ${Math.max(0.1, intensity * 0.7)})`;
  };

  const getTextColor = (val, isCorrect) => {
    const intensity = maxVal > 0 ? val / maxVal : 0;
    if (intensity > 0.6) return '#fff';
    if (isCorrect) return 'rgba(52, 211, 153, 1)';
    if (val === 0) return 'rgba(255,255,255,0.25)';
    return 'rgba(251, 191, 36, 1)';
  };

  const labelGap = compact ? 4 : 8;

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
    }}>
      {/* Axis labels */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        width: '100%', 
        maxWidth: adjustedCellSize * numClasses + 80,
        mb: 1.5,
        px: 1,
      }}>
        <Typography variant="caption" sx={{ 
          color: 'var(--primary-light)', 
          fontWeight: 700, 
          fontSize: compact ? '0.6rem' : '0.7rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          ↓ Actual
        </Typography>
        <Typography variant="caption" sx={{ 
          color: 'var(--primary-light)', 
          fontWeight: 700, 
          fontSize: compact ? '0.6rem' : '0.7rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Predicted →
        </Typography>
      </Box>

      {/* Matrix grid */}
      <Box sx={{
        display: 'inline-grid',
        gap: '2px',
        gridTemplateColumns: `auto repeat(${numClasses}, ${adjustedCellSize}px)`,
        alignItems: 'center',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 2,
        p: 1,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Top-left corner (empty) */}
        <Box />

        {/* Column headers (Predicted) */}
        {classLabels.map((label, i) => (
          <Tooltip key={`header-${i}`} title={label} arrow placement="top">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? '0.55rem' : '0.65rem',
                fontWeight: 600,
                color: 'var(--primary-light)',
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                pb: 0.5,
                height: compact 
                  ? (numClasses <= 5 ? '50px' : '40px')
                  : (numClasses <= 5 ? '70px' : '55px'),
                cursor: 'default',
              }}
            >
              {label.length > 10 ? label.slice(0, 8) + '…' : label}
            </Box>
          </Tooltip>
        ))}

        {/* Matrix rows */}
        {matrix.map((row, i) => (
          <React.Fragment key={`row-${i}`}>
            {/* Row header (Actual) */}
            <Tooltip title={classLabels[i]} arrow placement="left">
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  fontSize: compact ? '0.55rem' : '0.65rem',
                  fontWeight: 600,
                  color: 'var(--primary-light)',
                  pr: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 80,
                  cursor: 'default',
                }}
              >
                {classLabels[i].length > 10 ? classLabels[i].slice(0, 8) + '…' : classLabels[i]}
              </Box>
            </Tooltip>

            {/* Matrix cells */}
            {row.map((val, j) => {
              const isCorrect = i === j;
              return (
                <Tooltip
                  key={`cell-${i}-${j}`}
                  title={`Actual: ${classLabels[i]} → Predicted: ${classLabels[j]} | Count: ${val}`}
                  arrow
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: adjustedCellSize <= 30 ? '0.55rem' : (adjustedCellSize <= 40 ? '0.65rem' : '0.75rem'),
                      fontWeight: 700,
                      color: getTextColor(val, isCorrect),
                      width: adjustedCellSize,
                      height: adjustedCellSize,
                      backgroundColor: getCellColor(val, isCorrect),
                      borderRadius: '4px',
                      border: isCorrect ? '1.5px solid rgba(52, 211, 153, 0.5)' : '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 0.15s ease',
                      cursor: 'default',
                      '&:hover': {
                        transform: 'scale(1.15)',
                        zIndex: 10,
                        boxShadow: isCorrect
                          ? '0 0 12px rgba(52, 211, 153, 0.4)'
                          : '0 0 12px rgba(251, 146, 60, 0.3)',
                        border: isCorrect
                          ? '1.5px solid rgba(52, 211, 153, 0.8)'
                          : '1.5px solid rgba(251, 146, 60, 0.5)',
                      },
                    }}
                  >
                    {val}
                  </Box>
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </Box>

      {/* Color scale legend */}
      {!compact && (
        <Box sx={{ 
          mt: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          maxWidth: adjustedCellSize * numClasses + 80,
          width: '100%',
          px: 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(52, 211, 153, 0.6)', border: '1px solid rgba(52, 211, 153, 0.8)' }} />
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
              Correct
            </Typography>
          </Box>
          <Box sx={{ 
            flex: 3, 
            height: 8, 
            borderRadius: 4,
            background: 'linear-gradient(to right, rgba(251, 146, 60, 0.1), rgba(251, 146, 60, 0.8))',
            border: '1px solid rgba(255,255,255,0.08)',
          }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, justifyContent: 'flex-end' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '3px', background: 'rgba(251, 146, 60, 0.6)', border: '1px solid rgba(251, 146, 60, 0.8)' }} />
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
              Misclassified
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}