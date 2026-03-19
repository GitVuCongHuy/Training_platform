import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';

import theme from './theme';
import Sidebar from './components/Sidebar';
import HomePage from './pages/Home/HomePage';
import GenAiPage from './pages/GenAiPage';
import TrainModelPage from './pages/TrainModelPage';
import ExportModelPage from './pages/ExportPage/ExportModelPage';

function App() { 
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar Area */}
          <Sidebar />
          
          {/* Main Content Area */}
          <Box 
            component="main" 
            sx={{ 
              flexGrow: 1, 
              marginLeft: '260px', /* Sidebar width */
              padding: { xs: 2, sm: 4, md: 6 },
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/gen-ai/*" element={<GenAiPage />} />
              <Route path="/train-model/*" element={<TrainModelPage />} />
              <Route path="/model-export/*" element={<ExportModelPage />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;