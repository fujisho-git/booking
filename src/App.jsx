import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Box, AppBar, Toolbar, Typography, Button } from '@mui/material';
import CourseList from './components/CourseList';
import BookingForm from './components/BookingForm';
import AdminPanel from './components/AdminPanel';
import MyBookings from './components/MyBookings';
import { AuthProvider } from './contexts/AuthContext';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// dayjsの日本設定
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('ja');
dayjs.tz.setDefault('Asia/Tokyo');

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily:
      '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily:
            '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
        },
      },
    },
  },
});

// ナビゲーションボタンコンポーネント
const NavigationButtons = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button
        color='inherit'
        onClick={() => navigate('/')}
        variant={location.pathname === '/' ? 'outlined' : 'text'}
      >
        講座一覧
      </Button>
      <Button
        color='inherit'
        onClick={() => navigate('/my-bookings')}
        variant={location.pathname === '/my-bookings' ? 'outlined' : 'text'}
      >
        マイページ
      </Button>
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='ja'>
        <AuthProvider>
          <Router>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
              }}
            >
              <AppBar position='static'>
                <Toolbar>
                  <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
                    研修スケジュール管理システム
                  </Typography>
                  <NavigationButtons />
                </Toolbar>
              </AppBar>

              <Box
                sx={{
                  flexGrow: 1,
                  p: { xs: 2, sm: 3, md: 4 },
                  width: '100%',
                  maxWidth: '100%',
                }}
              >
                <Routes>
                  <Route path='/' element={<CourseList />} />
                  <Route path='/booking/:courseId' element={<BookingForm />} />
                  <Route path='/my-bookings' element={<MyBookings />} />
                  <Route path='/admin' element={<AdminPanel />} />
                </Routes>
              </Box>
            </Box>
          </Router>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
