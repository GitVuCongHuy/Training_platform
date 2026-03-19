import React, { useState } from 'react';
import {
  selectFolder,
  uploadImage,
  cancelTask,
  startMaskExtractionTask,
  startCompositingTask,
  listImages,
  getImageUrl,
  updateImageTransform,
  updateAllImages,
} from '../../../api';
import {
  TextField,
  Button,
  LinearProgress,
  Paper,
  Grid,
  Stack,
  Alert,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import RefreshIcon from '@mui/icons-material/Refresh';

import EditModal from '../components/EditModal';
import { useChangeBgTaskStatus } from '../hooks/useChangeBgTaskStatus';

const ChangeBgTab = () => {
  // State Bước 1
  const [maskInputPath, setMaskInputPath] = useState('');
  const [maskOutputPath, setMaskOutputPath] = useState('');
  const [maskIsLoading, setMaskIsLoading] = useState(false);
  const [maskMessage, setMaskMessage] = useState('');
  const [maskTaskId, setMaskTaskId] = useState(null);
  const [maskProgress, setMaskProgress] = useState({
    progress: 0,
    total: 1,
    message: '',
  });

  // State Bước 2
  const [compositeMaskPath, setCompositeMaskPath] = useState('');
  const [backgroundImagePath, setBackgroundImagePath] = useState('');
  const [compositeOutputPath, setCompositeOutputPath] = useState('');
  const [compositeIsLoading, setCompositeIsLoading] = useState(false);
  const [compositeMessage, setCompositeMessage] = useState('');
  const [compositeTaskId, setCompositeTaskId] = useState(null);
  const [compositeProgress, setCompositeProgress] = useState({
    progress: 0,
    total: 1,
    message: '',
  });

  // State Bước 3
  const [galleryImages, setGalleryImages] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // State cho Apply All (tách riêng khỏi bước 2)
  const [applyAllTaskId, setApplyAllTaskId] = useState(null);
  const [applyAllIsLoading, setApplyAllIsLoading] = useState(false);
  const [applyAllProgress, setApplyAllProgress] = useState({
    progress: 0,
    total: 1,
    message: '',
  });

  // Callback khi Bước 1 thành công
  const onMaskSuccess = () => {
    setCompositeMaskPath(maskOutputPath);
    setMaskMessage('Mask extracted successfully! Ready for Step 2.');
  };

  // Callback khi Bước 2 thành công
  const onCompositeSuccess = () => {
    setCompositeMessage('Compositing successful! Ready for Step 3.');
    handleLoadGallery(compositeOutputPath);
  };

  // Callback khi Apply All thành công
  const onApplyAllSuccess = () => {
    setCompositeMessage('Transform applied to all images!');
    handleLoadGallery(compositeOutputPath);
  };

  // Hook cho Bước 1
  useChangeBgTaskStatus(
    maskTaskId,
    setMaskProgress,
    setMaskIsLoading,
    setMaskTaskId,
    onMaskSuccess
  );

  // Hook cho Bước 2
  useChangeBgTaskStatus(
    compositeTaskId,
    setCompositeProgress,
    setCompositeIsLoading,
    setCompositeTaskId,
    onCompositeSuccess
  );

  // Hook cho Apply All (Bước 3)
  useChangeBgTaskStatus(
    applyAllTaskId,
    setApplyAllProgress,
    setApplyAllIsLoading,
    setApplyAllTaskId,
    onApplyAllSuccess
  );

  // --- CÁC HÀM XỬ LÝ ---

  const handleSelectFolder = async (setter) => {
    try {
      const response = await selectFolder();
      if (response.data && response.data.path) setter(response.data.path);
    } catch (error) {
      alert('Error selecting folder. See console for details.');
      console.error('Folder selection error:', error);
    }
  };

  const handleCancelTask = async (taskId, setMessage) => {
    if (!taskId) return;
    try {
      await cancelTask(taskId);
      setMessage('Cancellation request sent.');
    } catch (error) {
      setMessage('Error sending cancellation request.');
    }
  };

  const handleSubmitMaskExtraction = async () => {
    if (!maskInputPath || !maskOutputPath) {
      alert('Please select Input and Output folders.');
      return;
    }
    setMaskIsLoading(true);
    setMaskProgress({ progress: 0, total: 1, message: 'Starting...' });
    setMaskMessage('');
    try {
      const payload = {
        input_path: maskInputPath,
        output_path: maskOutputPath,
      };
      const response = await startMaskExtractionTask(payload);
      setMaskMessage(response.data.message);
      setMaskTaskId(response.data.task_id);
    } catch (error) {
      setMaskMessage(`Error: ${error.response?.data?.detail || error.message}`);
      setMaskIsLoading(false);
    }
  };

  const handleBackgroundFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setCompositeMessage(`Uploading image "${file.name}"...`);
      try {
        const response = await uploadImage(file);
        setBackgroundImagePath(response.data.path);
        setCompositeMessage(`Background image "${file.name}" is ready.`);
      } catch (error) {
        setCompositeMessage(
          `Upload error: ${error.response?.data?.detail || error.message}`
        );
        setBackgroundImagePath('');
      }
    }
  };

  const handleSubmitCompositing = async () => {
    if (!compositeMaskPath || !backgroundImagePath || !compositeOutputPath) {
      alert('Please fill all 3 fields for Step 2.');
      return;
    }
    setCompositeIsLoading(true);
    setCompositeProgress({ progress: 0, total: 1, message: 'Starting...' });
    setCompositeMessage('');
    try {
      const payload = {
        mask_path: compositeMaskPath,
        background_image_path: backgroundImagePath,
        output_path: compositeOutputPath,
      };
      const response = await startCompositingTask(payload);
      setCompositeMessage(response.data.message);
      setCompositeTaskId(response.data.task_id);
    } catch (error) {
      setCompositeMessage(
        `Error: ${error.response?.data?.detail || error.message}`
      );
      setCompositeIsLoading(false);
    }
  };

  const handleLoadGallery = async (path = null) => {
    const targetPath = path || compositeOutputPath;
    if (!targetPath) {
      alert("Please fill 'Final Output Folder' in Step 2 first.");
      return;
    }
    if (!compositeMaskPath || !backgroundImagePath) {
      alert(
        "Please fill both 'Mask Folder' and 'Background Image' in Step 2 to enable editing."
      );
      return;
    }

    try {
      const response = await listImages(targetPath);
      setGalleryImages(response.data);
      if (response.data.length === 0) {
        alert(
          'No images found in the selected folder. Please check the path.'
        );
      }
    } catch (error) {
      alert(
        'Error loading image list: ' +
        (error.response?.data?.detail || error.message)
      );
      console.error(error);
    }
  };

  const handleImageClick = (imagePath) => {
    setSelectedImage(imagePath);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  const handleSaveTransform = async (params, applyAll = false) => {
    if (!compositeMaskPath || !backgroundImagePath || !compositeOutputPath) {
      alert('Missing path information for saving.');
      return;
    }

    const finalParams = { ...params, gauss_sigma: 1.0 };

    try {
      if (!applyAll) {
        const imageName = selectedImage.split(/[\\/]/).pop();
        const maskName = imageName.replace(/\.[^/.]+$/, '.png');
        const maskImagePath = `${compositeMaskPath}/${maskName}`;

        const payloadSingle = {
          mask_image_path: maskImagePath,
          background_image_path: backgroundImagePath,
          output_image_path: selectedImage,
          params: finalParams,
        };

        await updateImageTransform(payloadSingle);

        alert('Image saved successfully!');
        handleModalClose();
        handleLoadGallery();
      } else {
        const payloadAll = {
          mask_dir: compositeMaskPath,
          background_image_path: backgroundImagePath,
          output_dir: compositeOutputPath,
          params: finalParams,
        };

        const res = await updateAllImages(payloadAll);

        const newTaskId = res.data.task_id;
        if (newTaskId) {
          setApplyAllTaskId(newTaskId);
          setApplyAllIsLoading(true);
          setApplyAllProgress({
            progress: 0,
            total: 1,
            message: 'Applying transform to all images...',
          });
          handleModalClose();
        } else {
          alert('Batch processing request sent!');
          handleModalClose();
          handleLoadGallery();
        }
      }
    } catch (error) {
      alert('Error saving: ' + (error.response?.data?.detail || error.message));
    }
  };

  // --- JSX ---

  return (
    <Grid container justifyContent="center">
      <Grid item xs={12} md={10} lg={8}>
        <Paper elevation={0} className="glass-panel" sx={{ p: 3 }}>
          {/* BƯỚC 1: TÁCH MASK */}
          <Box p={2} border="1px solid var(--border-subtle)" borderRadius={2} sx={{ background: 'rgba(0,0,0,0.2)' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Step 1: Extract Mask
            </Typography>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  onClick={() => handleSelectFolder(setMaskInputPath)}
                  startIcon={<FolderOpenIcon />}
                >
                  Input
                </Button>
                <TextField
                  value={maskInputPath}
                  placeholder="Folder containing original images..."
                  readOnly
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => handleSelectFolder(setMaskOutputPath)}
                  startIcon={<FolderOpenIcon />}
                >
                  Output
                </Button>
                <TextField
                  value={maskOutputPath}
                  placeholder="Folder to save masks (.png)..."
                  readOnly
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Stack>
              {!maskIsLoading ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleSubmitMaskExtraction}
                  startIcon={<PlayArrowIcon />}
                >
                  Start Extraction
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  fullWidth
                  onClick={() => handleCancelTask(maskTaskId, setMaskMessage)}
                  startIcon={<StopIcon />}
                >
                  Stop
                </Button>
              )}
              {maskIsLoading && (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography sx={{ mb: 1 }} variant="body2">
                    {maskProgress.message}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      maskProgress.total > 0
                        ? (maskProgress.progress / maskProgress.total) * 100
                        : 0
                    }
                  />
                  <Typography align="right" variant="caption">
                    {maskProgress.progress || 0} / {maskProgress.total || 0}
                  </Typography>
                </Box>
              )}
              {maskMessage && !maskIsLoading && (
                <Alert
                  severity={maskMessage.startsWith('Error') ? 'error' : 'info'}
                >
                  {maskMessage}
                </Alert>
              )}
            </Stack>
          </Box>

          <Divider sx={{ my: 4, borderColor: 'var(--border-subtle)' }} />

          {/* BƯỚC 2: GHÉP NỀN */}
          <Box p={2} border="1px solid var(--border-subtle)" borderRadius={2} sx={{ background: 'rgba(0,0,0,0.2)' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Step 2: Compositing
            </Typography>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  onClick={() => handleSelectFolder(setCompositeMaskPath)}
                  startIcon={<FolderOpenIcon />}
                >
                  Mask
                </Button>
                <TextField
                  value={compositeMaskPath}
                  placeholder="Folder containing masks from Step 1..."
                  readOnly
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<UploadFileIcon />}
                >
                  Background
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleBackgroundFileChange}
                  />
                </Button>
                <TextField
                  value={
                    backgroundImagePath
                      ? `...${backgroundImagePath.slice(-30)}`
                      : ''
                  }
                  placeholder="Select a background image..."
                  readOnly
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => handleSelectFolder(setCompositeOutputPath)}
                  startIcon={<FolderOpenIcon />}
                >
                  Output
                </Button>
                <TextField
                  value={compositeOutputPath}
                  placeholder="Folder to save composited images..."
                  readOnly
                  fullWidth
                  variant="outlined"
                  size="small"
                />
              </Stack>
              {!compositeIsLoading ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleSubmitCompositing}
                  startIcon={<PlayArrowIcon />}
                  sx={{ py: 1.5 }}
                >
                  Start Compositing
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  fullWidth
                  onClick={() =>
                    handleCancelTask(compositeTaskId, setCompositeMessage)
                  }
                  startIcon={<StopIcon />}
                >
                  Stop
                </Button>
              )}
              {compositeIsLoading && (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography sx={{ mb: 1 }} variant="body2">
                    {compositeProgress.message}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      compositeProgress.total > 0
                        ? (compositeProgress.progress /
                          compositeProgress.total) *
                        100
                        : 0
                    }
                  />
                  <Typography align="right" variant="caption">
                    {compositeProgress.progress || 0} /{' '}
                    {compositeProgress.total || 0}
                  </Typography>
                </Box>
              )}
              {compositeMessage && !compositeIsLoading && (
                <Alert
                  severity={
                    compositeMessage.startsWith('Error') ? 'error' : 'info'
                  }
                >
                  {compositeMessage}
                </Alert>
              )}
            </Stack>
          </Box>

          <Divider sx={{ my: 4, borderColor: 'var(--border-subtle)' }} />

          {/* BƯỚC 3: XEM VÀ CHỈNH SỬA */}
          <Box p={2} border="1px solid var(--border-subtle)" borderRadius={2} width="100%" sx={{ background: 'rgba(0,0,0,0.2)' }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Step 3: Review and Edit
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => handleLoadGallery()}
                disabled={!compositeOutputPath}
              >
                Load images for editing
              </Button>
            </Stack>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 2 }}
            >
              Tip: To edit an existing folder, fill all 3 paths in Step 2, then click "Load images for editing".
            </Typography>

            {/* Progress bar cho Apply All */}
            {applyAllIsLoading && (
              <Box sx={{ width: '100%', mb: 2 }}>
                <Alert severity="info" sx={{ mb: 1 }}>
                  {applyAllProgress.message || 'Applying transform to all images...'}
                </Alert>
                <LinearProgress
                  variant="determinate"
                  value={
                    applyAllProgress.total > 0
                      ? (applyAllProgress.progress / applyAllProgress.total) * 100
                      : 0
                  }
                />
                <Typography align="right" variant="caption">
                  {applyAllProgress.progress || 0} / {applyAllProgress.total || 0}
                </Typography>
              </Box>
            )}

            <Paper
              variant="outlined"
              sx={{ 
                maxHeight: '500px',  // Giảm xuống 500px
                minHeight: '200px',
                overflowY: 'auto',
                p: 2, 
                backgroundColor: 'rgba(0,0,0,0.4)',
                borderColor: 'var(--border-subtle)',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.2)',
                  },
                },
              }}
            >
              {galleryImages.length > 0 ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    📸 Total: {galleryImages.length} images
                  </Typography>
                  
                  {/* ← ĐẢM BẢO CÓ container Ở ĐÂY */}
                  <Grid container spacing={1.5}>
                    {galleryImages.map((imgPath, index) => (
                      <Grid item xs={6} sm={6} md={6} key={index}>
                        <Box
                          onClick={() => handleImageClick(imgPath)}
                          sx={{
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                            },
                            borderRadius: 2,
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          }}
                        >
                          <img
                            src={`${getImageUrl(imgPath)}&t=${new Date().getTime()}`}
                            style={{
                              width: '100%',
                              height: '380px', 
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            alt={`Image ${index}`}
                          />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </>
              ) : (
                <Typography color="text.secondary" textAlign="center" sx={{ pt: 5 }}>
                  Complete Step 2 and click "Load images" to see the results here.
                </Typography>
              )}
            </Paper>
          </Box>
        </Paper>
      </Grid>

      {/* MODAL (Component con) */}
      <EditModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveTransform}
        imagePath={selectedImage}
        maskPath={
          selectedImage && compositeMaskPath
            ? `${compositeMaskPath}/${selectedImage
              .split(/[\\/]/)
              .pop()
              .replace(/\.[^/.]+$/, '.png')}`
            : ''
        }
        bgPath={backgroundImagePath}
      />
    </Grid>
  );
};

export default ChangeBgTab;