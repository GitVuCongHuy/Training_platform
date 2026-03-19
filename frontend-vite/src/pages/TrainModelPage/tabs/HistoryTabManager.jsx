import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import TabPanel from '../../../components/TabPanel'; 
import TrainingHistoryTab from './TrainingHistoryTab';
import TestingHistoryTab from './TestingHistoryTab';

export default function HistoryTabManager() {
  const [historyTabIndex, setHistoryTabIndex] = useState(0);
  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={historyTabIndex}
          onChange={(e, newValue) => setHistoryTabIndex(newValue)}
        >
          <Tab label="Training History" />
          <Tab label="Testing History" />
        </Tabs>
      </Box>
      <TabPanel value={historyTabIndex} index={0}>
        <TrainingHistoryTab />
      </TabPanel>
      <TabPanel value={historyTabIndex} index={1}>
        <TestingHistoryTab />
      </TabPanel>
    </Box>
  );
}