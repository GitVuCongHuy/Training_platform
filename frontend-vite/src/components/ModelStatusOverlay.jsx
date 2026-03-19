import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Paper } from '@mui/material';
import { Cpu, HardDrive, MemoryStick, CheckCircle, AlertTriangle } from 'lucide-react';

const ModelStatusOverlay = ({ children }) => {
    const [status, setStatus] = useState(null);
    const [hardware, setHardware] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [pollingMessage, setPollingMessage] = useState("");
    const [progress, setProgress] = useState(0);

    const checkStatus = async () => {
        try {
            setLoadingInfo(true);
            const resStatus = await fetch('http://127.0.0.1:8000/models/status');
            const dataStatus = await resStatus.json();
            setStatus(dataStatus);

            if (!dataStatus.all_loaded) {
                const resHard = await fetch('http://127.0.0.1:8000/models/hardware-check');
                const dataHard = await resHard.json();
                setHardware(dataHard);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingInfo(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const handleLoadModels = async () => {
        try {
            const res = await fetch('http://127.0.0.1:8000/models/load', { method: 'POST' });
            const data = await res.json();
            if (data.task_id) {
                setIsPolling(true);
                pollTask(data.task_id);
            }
        } catch (err) {
            console.error("Error calling load models API", err);
        }
    };

    const pollTask = async (taskId) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`http://127.0.0.1:8000/task-status/${taskId}`);
                const data = await res.json();
                
                if (data.message) setPollingMessage(data.message);
                if (data.progress) setProgress(data.progress);

                if (data.status === 'completed' || data.status === 'failed') {
                    clearInterval(interval);
                    setIsPolling(false);
                    checkStatus(); // re-check after completion
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        }, 1500);
    };

    if (loadingInfo) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress color="primary" />
            </Box>
        );
    }

    if (status && status.all_loaded) {
        return children;
    }

    // Nếu chưa load Xong
    return (
        <Box 
            className="glass-panel animate-fade-in" 
            sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 4, textAlign: 'center' }}
        >
            <Box sx={{ mb: 3, display: 'inline-flex', p: 2, borderRadius: '50%', background: 'rgba(99,102,241,0.1)' }}>
                <Cpu size={48} color="#818cf8" />
            </Box>
            
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                AI Models Required
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 4 }}>
                The background removal and object detection features require loading YOLO (110MB) and Segment Anything Model (SAM, 2.4GB) into memory. This action will consume system resources.
            </Typography>

            {hardware && (
                <Box sx={{ textAlign: 'left', mb: 4 }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, color: 'var(--primary-light)' }}>
                        Your System Specs:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Paper sx={{ p: 2, background: 'rgba(0,0,0,0.2)', display: 'flex', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', gap: 2 }}>
                            <MemoryStick size={24} color="#a5b4fc" />
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>RAM (System Memory)</Typography>
                                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                                    Free {hardware.hardware.ram.available_mb?.toFixed(0)}MB / {hardware.hardware.ram.total_mb?.toFixed(0)}MB
                                </Typography>
                            </Box>
                            {hardware.hardware.ram.available_mb > 4000 ? <CheckCircle size={20} color="#4ade80" /> : <AlertTriangle size={20} color="#fbbf24" />}
                        </Paper>
                        
                        <Paper sx={{ p: 2, background: 'rgba(0,0,0,0.2)', display: 'flex', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', gap: 2 }}>
                            <Cpu size={24} color="#ec4899" />
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>GPU (Graphics Card)</Typography>
                                {hardware.hardware.gpu.available ? (
                                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                                        {hardware.hardware.gpu.name} • Free VRAM {hardware.hardware.gpu.free_vram_mb?.toFixed(0)}MB
                                    </Typography>
                                ) : (
                                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>CUDA Not Supported (Using CPU)</Typography>
                                )}
                            </Box>
                            {(hardware.hardware.gpu.free_vram_mb > 2000 || !hardware.hardware.gpu.available) ? <CheckCircle size={20} color="#4ade80" /> : <AlertTriangle size={20} color="#fbbf24" />}
                        </Paper>
                        
                        {!status.models_exist_on_disk && (
                            <Paper sx={{ p: 2, background: 'rgba(0,0,0,0.2)', display: 'flex', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', gap: 2 }}>
                                <HardDrive size={24} color="#fcd34d" />
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Storage</Typography>
                                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                                        Requires ~2.5GB for initial download. Free space: {hardware.hardware.disk.free_mb?.toFixed(0)}MB
                                    </Typography>
                                </Box>
                                {hardware.hardware.disk.free_mb > 3000 ? <CheckCircle size={20} color="#4ade80" /> : <AlertTriangle size={20} color="#fbbf24" />}
                            </Paper>
                        )}
                    </Box>

                    {hardware.warnings && hardware.warnings.length > 0 && (
                        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {hardware.warnings.map((w, idx) => (
                                <Alert severity="warning" key={idx} sx={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                    {w}
                                </Alert>
                            ))}
                        </Box>
                    )}
                </Box>
            )}

            {isPolling ? (
                <Box>
                    <CircularProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
                    <Typography>{pollingMessage || "Loading data..."}</Typography>
                </Box>
            ) : (
                <Button 
                    variant="contained" 
                    size="large" 
                    onClick={handleLoadModels}
                    sx={{ px: 4, py: 1.5, fontWeight: 600 }}
                >
                    Initialize Models
                </Button>
            )}
        </Box>
    );
};

export default ModelStatusOverlay;
