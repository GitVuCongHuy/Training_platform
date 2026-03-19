import React from 'react';
import { Box } from '@mui/material';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index} // <-- Thẻ div này đã lo việc ẩn/hiện rồi
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {/* BỎ ĐIỀU KIỆN (value === index && ...) 
        ĐỂ COMPONENT CON KHÔNG BAO GIỜ BỊ UNMOUNT KHI CHUYỂN TAB 
      */}
      <Box sx={{ pt: 3 }}>
        {children}
      </Box>
    </div>
  );
}

export default TabPanel;