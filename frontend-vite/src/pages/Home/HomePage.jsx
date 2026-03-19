import React from 'react';
import { Link } from 'react-router-dom';
import { 
    Container, 
    Typography, 
    Card, 
    CardActionArea, 
    CardContent,
    Box,
    Chip
} from '@mui/material';
import { Image, Settings, Download, Sparkles } from 'lucide-react';

const HomePage = () => {
    const tools = [
        {
            to: "/gen-ai",
            title: "AI Generation & Background",
            description: "Edit backgrounds and extract objects using the power of Segment Anything & YOLO.",
            icon: <Image size={32} color="#818cf8" />,
            status: "Ready",
            delay: "delay-1"
        },
        {
            to: "/train-model",
            title: "Train AI Models",
            description: "Train classification or object detection (YOLO) models directly in your browser.",
            icon: <Settings size={32} color="#ec4899" />,
            status: "Beta",
            delay: "delay-2"
        },
        {
            to: "/model-export",
            title: "Export Models",
            description: "Package and export trained models to optimized formats like ONNX or TensorRT.",
            icon: <Download size={32} color="#a5b4fc" />,
            status: "Beta",
            delay: "delay-3"
        }
    ];

    return (
        <Box sx={{ flexGrow: 1, minHeight: '100%', pt: 4, pb: 8 }}>
            <Container maxWidth="lg">
                
                {/* Hero Section */}
                <Box 
                    className="glass-panel animate-fade-in"
                    sx={{ 
                        textAlign: 'center', 
                        py: 8, 
                        px: 4, 
                        mb: 8,
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <Box 
                        sx={{ 
                            position: 'absolute', 
                            top: '-50%', left: '-10%', 
                            width: '400px', height: '400px', 
                            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                            borderRadius: '50%',
                            zIndex: 0
                        }} 
                    />
                    
                    <Box sx={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Sparkles color="#ec4899" size={28} />
                        <Typography variant="h2" component="h1" className="text-gradient" sx={{ fontWeight: 800 }}>
                            AI Tool Suite
                        </Typography>
                    </Box>
                    <Typography variant="h6" sx={{ color: 'var(--text-secondary)', maxWidth: '600px', mx: 'auto', mb: 2, fontWeight: 400 }}>
                        Professional Computer Vision training & image processing platform, optimized for your hardware.
                    </Typography>
                </Box>
                
                {/* Tools Grid */}
                <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
                    Integrated Tools
                </Typography>
                
                <Box 
                    sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, 
                        gap: 4 
                    }}
                >
                    {tools.map((tool) => (
                        <Box key={tool.title}>
                            <Card
                                className={`glass-card animate-fade-in ${tool.delay}`}
                                sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                            >
                                <CardActionArea component={Link} to={tool.to} sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 3 }}>
                                        <Box 
                                            sx={{ 
                                                p: 1.5, 
                                                borderRadius: 2, 
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            {tool.icon}
                                        </Box>
                                        <Chip 
                                            label={tool.status} 
                                            size="small"
                                            sx={{ 
                                                background: tool.status === "Ready" ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.1)',
                                                color: tool.status === "Ready" ? '#a5b4fc' : 'var(--text-secondary)',
                                                fontWeight: 600,
                                                borderColor: 'transparent'
                                            }} 
                                        />
                                    </Box>

                                    <CardContent sx={{ p: 0, textAlign: 'left', flexGrow: 1 }}>
                                        <Typography gutterBottom variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>
                                            {tool.title}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                            {tool.description}
                                        </Typography>
                                    </CardContent>
                                    
                                </CardActionArea>
                            </Card>
                        </Box>
                    ))}
                </Box>
            </Container>
        </Box>
    );
};

export default HomePage;