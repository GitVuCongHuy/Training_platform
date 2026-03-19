import React from 'react';
import {
  Paper,
  Stack,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';

const GenAiHistoryList = ({ history, onUseHistory, onDeleteHistory }) => {
  return (
    <Box sx={{ width: { xs: '95%', sm: '80%', md: '70%', lg: '50%' }, mt: 4 }}>
      <Paper elevation={0} className="glass-panel" sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
          📋 Generation History
        </Typography>

        {history.length === 0 ? (
          <Alert severity="info">No history available.</Alert>
        ) : (
          <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Stack spacing={1}>
              {history.map((item) => (
                <Accordion key={item.id}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack sx={{ width: '100%' }}>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(item.created_at).toLocaleString()}
                      </Typography>
                      <Typography noWrap>
                        <strong>{item.classes_data.length} classes:</strong>{' '}
                        {item.classes_data.map((c) => c.name).join(', ')}
                      </Typography>
                    </Stack>
                  </AccordionSummary>

                  <AccordionDetails>
                    <List dense>
                      {item.classes_data.map((c, i) => (
                        <ListItem key={i}>
                          <ListItemText
                            primary={<strong>{c.name}</strong>}
                            secondary={c.prompt}
                          />
                        </ListItem>
                      ))}
                    </List>

                    <Typography
                      variant="caption"
                      display="block"
                      gutterBottom
                      sx={{ wordBreak: 'break-all' }}
                    >
                      Output: {item.output_path}
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ReplayIcon />}
                        onClick={() => onUseHistory(item)}
                      >
                        Reuse
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => onDeleteHistory(item.id)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default GenAiHistoryList;