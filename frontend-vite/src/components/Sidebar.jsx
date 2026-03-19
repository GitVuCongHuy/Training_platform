import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Home, Image, Settings, Download, Layers } from 'lucide-react';

const SIDEBAR_WIDTH = 260;

const menuItems = [
    { text: 'Home', path: '/', icon: <Home size={20} /> },
    { text: 'Gen AI', path: '/gen-ai', icon: <Image size={20} /> },
    { text: 'Train Model', path: '/train-model', icon: <Settings size={20} /> },
    { text: 'Export Model', path: '/model-export', icon: <Download size={20} /> },
];

const Sidebar = () => {
    const location = useLocation();

    return (
        <Box
            sx={{
                width: SIDEBAR_WIDTH,
                flexShrink: 0,
                height: '100vh',
                position: 'fixed',
                background: 'rgba(19, 19, 22, 0.7)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
            }}
        >
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box 
                    sx={{ 
                        width: 36, height: 36, 
                        borderRadius: 2, 
                        background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)'
                    }}
                >
                    <Layers color="#fff" size={20} />
                </Box>
                <Typography variant="h6" className="text-gradient" sx={{ fontWeight: 700, letterSpacing: '0.02em', fontSize: '1.2rem' }}>
                    AI STUDIO
                </Typography>
            </Box>

            <List sx={{ px: 2, flexGrow: 1 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton
                                component={NavLink}
                                to={item.path}
                                sx={{
                                    borderRadius: '10px',
                                    py: 1.2,
                                    px: 2,
                                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                    color: isActive ? '#818cf8' : 'var(--text-secondary)',
                                    transition: 'all 0.2s',
                                    border: '1px solid',
                                    borderColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    '&:hover': {
                                        backgroundColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        color: isActive ? '#a5b4fc' : '#fff'
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText 
                                    primary={item.text} 
                                    primaryTypographyProps={{ 
                                        fontWeight: isActive ? 600 : 500,
                                        fontSize: '0.95rem'
                                    }} 
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
            
            <Box sx={{ p: 3 }}>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                    v1.0.0 Pro Edition
                </Typography>
            </Box>
        </Box>
    );
};

export default Sidebar;
