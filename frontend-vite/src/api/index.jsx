import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
    baseURL: API_URL,
});

// --- API cho Gen AI ---
export const startGenAiTask = (data) => api.post('/gen-ai/start-generation', data);
export const getHistory = () => api.get('/gen-ai/history');
export const deleteHistoryItem = (id) => api.delete(`/gen-ai/history/${id}`);

// --- API Chung ---
export const selectFolder = () => api.get('/select-folder');
export const uploadImage = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload-image', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};
export const cancelTask = (taskId) => api.post(`/cancel-task/${taskId}`);
export const getTaskStatus = (taskId) => api.get(`/task-status/${taskId}`);

// --- API CHO CHANGE BACKGROUND ---
export const startMaskExtractionTask = (payload) => api.post('/change-bg/extract-masks', payload);
export const startCompositingTask = (payload) => api.post('/change-bg/composite-images', payload);
export const listImages = (folderPath) =>
    api.get('/change-bg/list-images', { params: { folder_path: folderPath } });
export const updateImageTransform = (payload) =>
    api.post('/change-bg/update-image', payload);
export const getImageUrl = (filePath) =>
    `${API_URL}/change-bg/get-image?path=${encodeURIComponent(filePath)}`;
export const updateAllImages = (payload) =>
    api.post('/change-bg/update-all-images', payload);
// =========================
//  API CHO PAGE 2 - TRAIN
// =========================
export const startTrainingSession = (payload) =>
    api.post('/train/start', payload);

export const getTrainingStatus = (trainingId) =>
    api.get(`/train/status/${trainingId}`);

export const stopTrainingSession = (trainingId) =>
    api.post(`/train/stop/${trainingId}`);

// ========== API MỚI: HISTORY + METRICS ==========
export const getTrainingHistory = (skip = 0, limit = 50) =>
    api.get('/train/history', { params: { skip, limit } });

export const getTrainingMetrics = (trainingId) =>
    api.get(`/train/metrics/${trainingId}`);

export const deleteTrainingSession = (trainingId) =>
    api.delete(`/train/history/${trainingId}`);

export const downloadModel = (modelPath) =>
    window.open(`${API_URL}/train/download-model?path=${encodeURIComponent(modelPath)}`, '_blank');

export const validatePath = (path) => 
    api.get(`/train/validate-path`, { params: { path } });

// ========== 🚀 CÁC HÀM API MỚI CHO TEST 🚀 ==========

export const startTestSession = (payload) => {
    // payload: { model_path: "...", dataset_path: "..." }
    return api.post("/train/test/start", payload);
};

export const getTestStatus = (testId) => {
    return api.get(`/train/test/status/${testId}`);
};

export const getTestHistory = () => {
    return api.get("/train/test/history");
};

export const getTestMetrics = (testId) => {
    return api.get(`/train/test/metrics/${testId}`);
};

export const deleteTestSession = (testId) => {
    return api.delete(`/train/test/history/${testId}`);
};

// ========== API CHO EXPORT MODEL ==========
export const getExportFormats = () => api.get('/export/formats');
export const exportModelByUpload = (formData) => api.post('/export/by-upload', formData);