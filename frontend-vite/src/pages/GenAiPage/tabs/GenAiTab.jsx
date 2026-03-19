import React, { useState, useEffect } from 'react';
import {
  getHistory,
  deleteHistoryItem,
  selectFolder,
  startGenAiTask,
  cancelTask,
} from '../../../api'; // Giả sử api ở src/api/index.js
import {
  TextField,
  Button,
  Paper,
  Stack,
  Alert,
  Box,
  Typography,
  InputAdornment,
  IconButton,
  Link,
  Collapse,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import KeyIcon from '@mui/icons-material/Key';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// Import các component con và hook
import GenAiProgressDisplay from '../components/GenAiProgressDisplay';
import GenAiHistoryList from '../components/GenAiHistoryList';
import { useGenAiTaskStatus } from '../hooks/useGenAiTaskStatus';

const GenAiTab = () => {
  const [numClasses, setNumClasses] = useState(1);
  const [classData, setClassData] = useState([{ name: '', prompt: '' }]);
  const [numImagesPerClass, setNumImagesPerClass] = useState(500);
  const [genOutputPath, setGenOutputPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);
  const [history, setHistory] = useState([]);
  const [genMessage, setGenMessage] = useState('');
  const [genTaskId, setGenTaskId] = useState(null);

  // Sử dụng custom hook để polling
  const { genProgress, genIsLoading, setGenIsLoading, taskIsDone } =
    useGenAiTaskStatus(genTaskId);

  useEffect(() => {
    fetchHistory();
    // Restore API key from sessionStorage (survives page refresh, not tab close)
    const savedKey = sessionStorage.getItem('pollinations_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Khi hook báo hiệu task đã xong, ta fetch lại history
  useEffect(() => {
    if (taskIsDone) {
      setTimeout(fetchHistory, 1000); // Đợi 1s cho DB cập nhật
      setGenTaskId(null); // Reset task ID
    }
  }, [taskIsDone]);

  const fetchHistory = async () => {
    try {
      const response = await getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử:', error);
    }
  };

  const handleNumClassesChange = (e) => {
    const count = Math.max(1, parseInt(e.target.value, 10) || 1);
    setNumClasses(count);

    const newClassData = Array.from(
      { length: count },
      (_, i) => classData[i] || { name: '', prompt: '' }
    );
    setClassData(newClassData);
  };

  const handleClassDataChange = (index, field, value) => {
    const newClassData = [...classData];
    newClassData[index][field] = value;
    setClassData(newClassData);
  };

  const handleApiKeyChange = (e) => {
    const key = e.target.value;
    setApiKey(key);
    // Save to sessionStorage (not localStorage for better security)
    if (key) {
      sessionStorage.setItem('pollinations_api_key', key);
    } else {
      sessionStorage.removeItem('pollinations_api_key');
    }
  };

  const handleSelectFolder = async (setter) => {
    try {
      const response = await selectFolder();
      if (response.data && response.data.path) setter(response.data.path);
    } catch (error) {
      alert('Error selecting folder. See Console (F12) for details.');
      console.error('Folder selection error:', error);
    }
  };

  const handleCancelTask = async () => {
    if (!genTaskId) return;
    try {
      await cancelTask(genTaskId);
      setGenMessage('Cancellation request sent.');
      // Hook sẽ tự động nhận diện
    } catch (error) {
      setGenMessage('Error sending cancellation request.');
    }
  };

  const handleSubmitGenAI = async () => {
    if (!apiKey) {
      alert('Please enter your Pollinations API key.');
      return;
    }
    if (!genOutputPath) {
      alert('Please select an output folder.');
      return;
    }

    setGenMessage('');

    const payload = {
      classes: classData.filter((c) => c.name && c.prompt),
      output_path: genOutputPath,
      num_images_per_class: numImagesPerClass,
      api_key: apiKey,
    };

    if (payload.classes.length === 0) {
      alert('Please enter at least one class.');
      return;
    }

    try {
      const response = await startGenAiTask(payload);
      setGenMessage(response.data.message);
      setGenTaskId(response.data.task_id); // Kích hoạt hook
    } catch (error) {
      setGenMessage(`Error: ${error.response?.data?.detail || error.message}`);
      setGenIsLoading(false);
    }
  };

  const handleUseHistory = (item) => {
    setNumClasses(item.classes_data.length);
    setClassData(item.classes_data);
    setGenOutputPath(item.output_path);
  };

  const handleDeleteHistory = async (id) => {
    try {
      await deleteHistoryItem(id);
      fetchHistory();
    } catch (error) {
      console.error('Lỗi khi xóa lịch sử:', error);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 4,
        p: 2,
      }}
    >
      {/* Div 1: Cấu hình Gen AI */}
      <Box sx={{ width: { xs: '95%', sm: '80%', md: '70%', lg: '50%' } }}>
        <Paper elevation={0} className="glass-panel" sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
            📝 Generation Settings
          </Typography>

          <Stack spacing={3}>
            {/* API Key Section */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                background: 'rgba(0,0,0,0.15)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <KeyIcon sx={{ color: 'var(--primary-light)', fontSize: 20 }} />
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, color: 'var(--primary-light)' }}
                  >
                    Pollinations API Key
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
                    sx={{ color: 'var(--text-secondary)' }}
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>

                <Collapse in={showApiKeyHelp}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    <Typography variant="body2" gutterBottom>
                      Để sử dụng tính năng gen ảnh, bạn cần có API key từ Pollinations.
                    </Typography>
                    <Typography variant="body2" component="div">
                      <strong>Hướng dẫn:</strong>
                      <ol style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                        <li>
                          Truy cập{' '}
                          <Link
                            href="https://enter.pollinations.ai"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontWeight: 600 }}
                          >
                            enter.pollinations.ai
                          </Link>
                        </li>
                        <li>Đăng nhập bằng GitHub</li>
                        <li>Bấm <strong>"+ API Key"</strong> để tạo key mới (loại Secret - bắt đầu bằng <code>sk_</code>)</li>
                        <li>
                          <strong style={{ color: '#ff9800' }}>⚠️ Quan trọng:</strong> Ở phần <strong>Permissions → Model</strong>, 
                          bấm <strong>"Allow all"</strong> hoặc chọn thêm image model (flux, zimage, seedream...) để key có quyền gen ảnh
                        </li>
                        <li>Save key, copy và dán vào ô bên dưới</li>
                      </ol>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      🔒 Key chỉ được lưu tạm trong session trình duyệt, không lưu vào server.
                    </Typography>
                  </Alert>
                </Collapse>

                <TextField
                  label="API Key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="sk_xxxxxxxxxxxxxxxx"
                  variant="outlined"
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowApiKey(!showApiKey)}
                          edge="end"
                          size="small"
                        >
                          {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
            </Paper>

            {/* Image Count & Class Count */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Number of classes"
                type="number"
                value={numClasses}
                onChange={handleNumClassesChange}
                InputProps={{ inputProps: { min: 1 } }}
                variant="outlined"
                fullWidth
              />
              <TextField
                label="Images per class"
                type="number"
                value={numImagesPerClass}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setNumImagesPerClass('');
                  } else {
                    setNumImagesPerClass(parseInt(raw, 10));
                  }
                }}
                onBlur={() => {
                  const val = parseInt(numImagesPerClass, 10);
                  if (!val || val < 1) setNumImagesPerClass(1);
                  else if (val > 10000) setNumImagesPerClass(10000);
                }}
                InputProps={{ inputProps: { min: 1, max: 10000 } }}
                variant="outlined"
                fullWidth
                helperText="Số lượng ảnh gen cho mỗi class"
              />
            </Stack>

            <Box sx={{ maxHeight: '40vh', overflowY: 'auto', pr: 1 }}>
              <Stack spacing={2}>
                {classData.map((cls, index) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{ p: 2, background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border-subtle)' }}
                  >
                    <Stack spacing={2}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, color: 'var(--primary-light)' }}
                      >
                        Class {index + 1}
                      </Typography>

                      <TextField
                        label="Class name (folder name)"
                        value={cls.name}
                        onChange={(e) =>
                          handleClassDataChange(index, 'name', e.target.value)
                        }
                        variant="outlined"
                        fullWidth
                      />

                      <TextField
                        label="Prompt for this class"
                        value={cls.prompt}
                        onChange={(e) =>
                          handleClassDataChange(
                            index,
                            'prompt',
                            e.target.value
                          )
                        }
                        variant="outlined"
                        multiline
                        rows={3}
                        fullWidth
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                onClick={() => handleSelectFolder(setGenOutputPath)}
                startIcon={<FolderOpenIcon />}
              >
                Output Folder
              </Button>
              <TextField
                value={genOutputPath}
                placeholder="Path to output folder..."
                readOnly
                fullWidth
                variant="outlined"
                size="small"
              />
            </Stack>

            <Box>
              {!genIsLoading ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleSubmitGenAI}
                  startIcon={<PlayArrowIcon />}
                  disabled={!apiKey}
                  sx={{ py: 1.5 }}
                >
                  Start Generation
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  fullWidth
                  onClick={handleCancelTask}
                  startIcon={<StopIcon />}
                  sx={{ py: 1.5 }}
                >
                  Stop Generation
                </Button>
              )}
            </Box>

            {/* Dùng component con */}
            {genIsLoading && <GenAiProgressDisplay progress={genProgress} />}

            {genMessage && !genIsLoading && (
              <Alert
                severity={genMessage.startsWith('Error') ? 'error' : 'success'}
              >
                {genMessage}
              </Alert>
            )}
          </Stack>
        </Paper>
      </Box>

      {/* Div 2: Lịch sử Gen (Dùng component con) */}
      <GenAiHistoryList
        history={history}
        onUseHistory={handleUseHistory}
        onDeleteHistory={handleDeleteHistory}
      />
    </Box>
  );
};

export default GenAiTab;