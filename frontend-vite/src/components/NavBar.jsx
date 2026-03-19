import React from 'react';
import { NavLink as RouterNavLink } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

// Tinh chỉnh NavLinkButton (Giữ nguyên style)
const NavLinkButton = styled(Button)(({ theme }) => ({
    color: '#f2f2f2', 
    padding: '22px 16px', 
    textTransform: 'none',
    fontSize: '17px',
    borderRadius: 0,
    minWidth: 'auto',
    height: '60px', 

    '&:hover': {
        backgroundColor: '#ddd', 
        color: 'black',
    },

    '&.active': {
        backgroundColor: '#007bff', 
        color: 'white',
        '&:hover': {
            backgroundColor: '#007bff', 
            color: 'white',
        }
    },
}));


const NavBar = () => {
    return (
        <AppBar 
            position="static"
            sx={{ 
                backgroundColor: '#333', 
                boxShadow: 'none', 
                height: 60,
            }}
        >
            <Toolbar 
                // Sử dụng flex và space-between để Logo và Links cách nhau tối đa.
                sx={{ 
                    height: 60, 
                    padding: '0 20px', 
                    // Thay đổi: Dùng flex-start để không gian trống nằm ở cuối
                    justifyContent: 'flex-start', 
                }}
            >
                
                {/* 1. THẺ DIV BÊN TRÁI: Logo */}
                <Typography 
                    variant="h6" 
                    noWrap 
                    component={RouterNavLink}
                    to="/" 
                    sx={{ 
                        color: 'inherit', 
                        textDecoration: 'none',
                        fontWeight: 'bold',
                        fontSize: '1.5rem', 
                        alignSelf: 'center', 
                        // Thêm margin-right để tạo khoảng cách giữa logo và links
                        mr: 4 
                    }}
                >
                    AI TOOL SUITE
                </Typography>

                {/* 2. KHOẢNG TRỐNG TỰ ĐỘNG: Đẩy nhóm links sang phải */}
                {/* Thẻ Box này sẽ chiếm hết khoảng trống giữa Logo và Links */}
                <Box sx={{ flexGrow: 1 }} /> 


                {/* 3. THẺ DIV Ở GIỮA: Container cho các links */}
                <Box sx={{ display: 'flex', height: '100%', alignItems: 'stretch' }}>
                    
                    <NavLinkButton 
                        component={RouterNavLink}
                        to="/" 
                        end 
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Trang chủ
                    </NavLinkButton>
                    
                    <NavLinkButton 
                        component={RouterNavLink}
                        to="/gen-ai" 
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Gen AI
                    </NavLinkButton>
                    
                    <NavLinkButton 
                        component={RouterNavLink}
                        to="/train-model" 
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Train Model
                    </NavLinkButton>
                    
                    <NavLinkButton 
                        component={RouterNavLink}
                        to="/model-export" 
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Export Model
                    </NavLinkButton>

                </Box>

            </Toolbar>
        </AppBar>
    );
};

export default NavBar;