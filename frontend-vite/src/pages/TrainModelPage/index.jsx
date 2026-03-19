import React, { useState } from 'react';
import { Container, Typography, Tabs, Tab, Box } from '@mui/material';
import TabPanel from '../../components/TabPanel';

import TrainNewModelTab from './tabs/TrainNewModelTab';
import TestModelTab from './tabs/TestModelTab';
import HistoryTabManager from './tabs/HistoryTabManager';

export default function TrainModelPage() {
  const [tabIndex, setTabIndex] = useState(0);
  return (
    <Container maxWidth="xl" className="animate-fade-in delay-1" sx={{ p: 4 }}>
      <Box sx={{ mb: 4, mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box 
              sx={{ 
                  width: '4px', height: 32, 
                  borderRadius: 2, 
                  background: 'linear-gradient(to bottom, #ec4899, #8b5cf6)'
              }}
          />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Training & Testing Studio
          </Typography>
      </Box>
      <Box className="glass-panel" sx={{ overflow: 'hidden', mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
          <Tabs
            value={tabIndex}
            onChange={(e, newValue) => setTabIndex(newValue)}
            sx={{ 
                minHeight: 56,
                '& .MuiTabs-indicator': { backgroundColor: '#ec4899', height: 3 },
                '& .MuiTab-root': { fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.95rem', textTransform: 'none' },
                '& .Mui-selected': { color: '#ec4899 !important' }
            }}
          >
            <Tab label="Train New Model" />
            <Tab label="Test Model" />
            <Tab label="Activity History" />
          </Tabs>
        </Box>
      <TabPanel value={tabIndex} index={0}>
        <TrainNewModelTab />
      </TabPanel>
      <TabPanel value={tabIndex} index={1}>
        <TestModelTab />
      </TabPanel>
      <TabPanel value={tabIndex} index={2}>
        <HistoryTabManager />
      </TabPanel>
      </Box>
    </Container>
  );
}