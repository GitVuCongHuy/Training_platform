import React, { useState, useRef, useEffect } from 'react';
import { getImageUrl } from '../../../api';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
  Slider,
  Button,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

const EditModal = ({ isOpen, onClose, onSave, imagePath, maskPath, bgPath }) => {
  const initialParams = {
    scale: 1.0,
    pitch: 0.0,
    yaw: 0.0,
    roll: 0.0,
    translateX: 0.0,
    translateY: 0.0,
  };
  const [params, setParams] = useState(initialParams);
  const [applyAll, setApplyAll] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const maskImgRef = useRef(null);
  const containerRef = useRef(null);

  // Reset params khi mở modal
  useEffect(() => {
    if (isOpen) {
      setParams(initialParams);
      setNaturalSize({ w: 0, h: 0 });
    }
  }, [isOpen]);

  // Đo container size khi mount và resize
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: rect.width - 32, h: rect.height - 32 }); // trừ padding
      }
    };

    measureContainer();
    window.addEventListener('resize', measureContainer);
    return () => window.removeEventListener('resize', measureContainer);
  }, [isOpen]);

  // Đo kích thước thật của mask
  const handleMaskLoadedInner = (imgEl) => {
    if (!imgEl) return;
    const nw = imgEl.naturalWidth;
    const nh = imgEl.naturalHeight;
    if (!nw || !nh) return;
    setNaturalSize({ w: nw, h: nh });
  };

  const handleMaskLoaded = (e) => {
    handleMaskLoadedInner(e.target);
  };

  // Check cache
  useEffect(() => {
    if (!isOpen) return;
    const el = maskImgRef.current;
    if (el && el.complete && naturalSize.w === 0 && naturalSize.h === 0) {
      handleMaskLoadedInner(el);
    }
  }, [isOpen, maskPath, naturalSize.w, naturalSize.h]);

  if (!isOpen || !imagePath) return null;

  const handleParamChange = (name, value) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(params, applyAll);
  };

  // Tính toán kích thước preview fit container
  const effectiveW = naturalSize.w > 0 ? naturalSize.w : 512;
  const effectiveH = naturalSize.h > 0 ? naturalSize.h : 512;
  const aspectRatio = effectiveW / effectiveH;

  // Tính display size để fit container
  let displayW = containerSize.w;
  let displayH = containerSize.h;

  if (containerSize.w > 0 && containerSize.h > 0) {
    const containerAspect = containerSize.w / containerSize.h;
    if (aspectRatio > containerAspect) {
      // Image wider than container
      displayW = containerSize.w;
      displayH = containerSize.w / aspectRatio;
    } else {
      // Image taller than container
      displayH = containerSize.h;
      displayW = containerSize.h * aspectRatio;
    }
    // Cap at max 100% of natural size
    if (displayW > effectiveW) {
      displayW = effectiveW;
      displayH = effectiveH;
    }
  }

  // Scale factor để translate từ pixel thật sang display
  const scaleFactor = displayW / effectiveW;

  const canvasWrapperStyle = {
    position: 'relative',
    width: displayW,
    height: displayH,
    backgroundColor: '#000',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  };

  const imgBaseStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  // Mask với transform người dùng (scale translate theo display size)
  const maskStyle = {
    ...imgBaseStyle,
    objectFit: 'contain',
    transformOrigin: 'center center',
    transform: `
      translateX(${params.translateX * scaleFactor}px)
      translateY(${params.translateY * scaleFactor}px)
      scale(${params.scale})
      rotateX(${params.pitch}deg)
      rotateY(${params.yaw}deg)
      rotateZ(${params.roll}deg)
    `,
    transition: 'transform 0.1s ease-out',
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0,0,0,0.5)',
        zIndex: 1300,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '95vw',
          maxWidth: 1200,
          height: '90vh',
          maxHeight: 800,
          display: 'flex',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Panel chỉnh thông số bên trái */}
        <Box
          sx={{
            width: 280,
            flexShrink: 0,
            p: 2,
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Settings
          </Typography>

          <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto' }}>
            <Box>
              <Typography gutterBottom variant="caption" fontWeight={600}>
                Scale: {params.scale.toFixed(2)}x
              </Typography>
              <Slider
                value={params.scale}
                onChange={(e, v) => handleParamChange('scale', v)}
                min={0.1}
                max={3.0}
                step={0.05}
                size="small"
              />
            </Box>

            <Box>
              <Typography gutterBottom variant="caption" fontWeight={600}>
                Pitch: {params.pitch.toFixed(0)}°
              </Typography>
              <Slider
                value={params.pitch}
                onChange={(e, v) => handleParamChange('pitch', v)}
                min={-90}
                max={90}
                step={1}
                size="small"
              />
            </Box>

            <Box>
              <Typography gutterBottom variant="caption" fontWeight={600}>
                Yaw: {params.yaw.toFixed(0)}°
              </Typography>
              <Slider
                value={params.yaw}
                onChange={(e, v) => handleParamChange('yaw', v)}
                min={-90}
                max={90}
                step={1}
                size="small"
              />
            </Box>

            <Box>
              <Typography gutterBottom variant="caption" fontWeight={600}>
                Roll: {params.roll.toFixed(0)}°
              </Typography>
              <Slider
                value={params.roll}
                onChange={(e, v) => handleParamChange('roll', v)}
                min={-180}
                max={180}
                step={1}
                size="small"
              />
            </Box>

            <Divider />

            <Box>
              <Typography gutterBottom variant="caption" fontWeight={600}>
                Translate X: {params.translateX.toFixed(0)}px
              </Typography>
              <Slider
                value={params.translateX}
                onChange={(e, v) => handleParamChange('translateX', v)}
                min={-500}
                max={500}
                step={5}
                size="small"
              />
            </Box>

            <Box>
              <Typography gutterBottom variant="caption" fontWeight={600}>
                Translate Y: {params.translateY.toFixed(0)}px
              </Typography>
              <Slider
                value={params.translateY}
                onChange={(e, v) => handleParamChange('translateY', v)}
                min={-500}
                max={500}
                step={5}
                size="small"
              />
            </Box>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={applyAll}
                  onChange={(e) => setApplyAll(e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="body2">Apply to all</Typography>}
            />

            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              fullWidth
              sx={{ mt: 1 }}
            >
              {applyAll ? 'Apply all' : 'Save'}
            </Button>

            <Button
              variant="outlined"
              color="inherit"
              onClick={onClose}
              fullWidth
              sx={{ mt: 1 }}
            >
              Close
            </Button>
          </Box>
        </Box>

        {/* Khu preview bên phải */}
        <Box
          ref={containerRef}
          sx={{
            flex: 1,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2,
            minWidth: 0,
          }}
        >
          {containerSize.w > 0 && (
            <Box style={canvasWrapperStyle}>
              {/* Background */}
              {bgPath && (
                <img
                  src={getImageUrl(bgPath)}
                  style={imgBaseStyle}
                  alt="Background"
                />
              )}

              {/* Mask */}
              {maskPath ? (
                <img
                  ref={maskImgRef}
                  src={getImageUrl(maskPath)}
                  style={maskStyle}
                  onLoad={handleMaskLoaded}
                  alt="Mask"
                />
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#fff',
                    fontStyle: 'italic',
                  }}
                >
                  Mask not found
                </Typography>
              )}

              {/* Loading indicator */}
              {naturalSize.w === 0 && naturalSize.h === 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    bgcolor: 'rgba(0,0,0,0.5)',
                  }}
                >
                  <Typography variant="body2" color="white">
                    Loading preview...
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default EditModal;
