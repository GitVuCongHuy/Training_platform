import React, { useState } from 'react';
import { Container, Typography, Box, Tabs, Tab, Paper } from '@mui/material';
import TabPanel from '../../components/TabPanel'; 

import GenAiTab from './tabs/GenAiTab';
import ChangeBgTab from './tabs/ChangeBgTab';
import ModelStatusOverlay from '../../components/ModelStatusOverlay';

const GenAiPage = () => {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        minHeight: '100%',
        pb: 4,
      }}
    >
      <Container maxWidth="xl" className="animate-fade-in delay-1">
        <Box sx={{ mb: 4, mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box 
                sx={{ 
                    width: '4px', height: 32, 
                    borderRadius: 2, 
                    background: 'linear-gradient(to bottom, #6366f1, #ec4899)'
                }}
            />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              AI Generation & Background Tools
            </Typography>
        </Box>
        <Paper className="glass-panel" elevation={0} sx={{ overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
            <Tabs 
                value={currentTab} 
                onChange={handleTabChange} 
                sx={{ 
                    minHeight: 56,
                    '& .MuiTabs-indicator': { backgroundColor: '#818cf8', height: 3 },
                    '& .MuiTab-root': { fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.95rem', textTransform: 'none' },
                    '& .Mui-selected': { color: '#818cf8 !important' }
                }}
            >
              <Tab label="Prompt Generation" />
              <Tab label="Background Removal & Segmentation" />
            </Tabs>
          </Box>

          <TabPanel value={currentTab} index={0}>
            <GenAiTab />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <ModelStatusOverlay>
                <ChangeBgTab />
            </ModelStatusOverlay>
          </TabPanel>
          
        </Paper>
      </Container>
    </Box>
  );
};

export default GenAiPage;