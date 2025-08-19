import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  EventAvailable,
  Computer,
  Group,
  CalendarToday,
  School
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { getCourses, getBookingsCount, checkUserBookingExists } from '../utils/firestore';

const CourseList = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookingCounts, setBookingCounts] = useState({});
  const [userBookings, setUserBookings] = useState(new Set());
  const [userInfo, setUserInfo] = useState({ companyName: '', fullName: '' });
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    // ローカルストレージからユーザー情報を取得
    const savedUserInfo = localStorage.getItem('userInfo');
    if (savedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(savedUserInfo);
        setUserInfo(parsedUserInfo);
        checkUserBookings(parsedUserInfo);
      } catch (error) {
        console.error('ユーザー情報の読み込みエラー:', error);
      }
    }
  }, [courses]);

  const checkUserBookings = async (userInfo) => {
    if (!userInfo.companyName || !userInfo.fullName || courses.length === 0) {
      return;
    }

    try {
      const bookingChecks = await Promise.all(
        courses.map(async (course) => {
          const hasBooking = await checkUserBookingExists(
            course.id, 
            userInfo.companyName, 
            userInfo.fullName
          );
          return { courseId: course.id, hasBooking };
        })
      );

      const bookedCourses = new Set(
        bookingChecks
          .filter(check => check.hasBooking)
          .map(check => check.courseId)
      );
      
      setUserBookings(bookedCourses);
    } catch (error) {
      console.error('申し込み状況確認エラー:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const coursesData = await getCourses();
      setCourses(coursesData);
      
      // 各講座の申し込み状況を取得
      const counts = {};
      for (const course of coursesData) {
        for (const schedule of course.schedules || []) {
          const { totalBookings, pcRentals } = await getBookingsCount(course.id, schedule.id);
          counts[`${course.id}-${schedule.id}`] = { totalBookings, pcRentals };
        }
      }
      setBookingCounts(counts);
    } catch (err) {
      setError('講座の取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  const getAvailabilityStatus = (course, schedule) => {
    const key = `${course.id}-${schedule.id}`;
    const counts = bookingCounts[key] || { totalBookings: 0, pcRentals: 0 };
    
    const isFullyBooked = counts.totalBookings >= schedule.capacity;
    const pcSlotsAvailable = schedule.pcRentalSlots - counts.pcRentals;
    
    return {
      isFullyBooked,
      remainingSlots: schedule.capacity - counts.totalBookings,
      pcSlotsAvailable,
      totalBookings: counts.totalBookings
    };
  };

  const formatDateTime = (schedule) => {
    const date = dayjs(schedule.dateTime.toDate()).format('YYYY年MM月DD日(ddd)');
    const timeRange = schedule.endTime 
      ? `${dayjs(schedule.dateTime.toDate()).format('HH:mm')}～${dayjs(schedule.endTime.toDate()).format('HH:mm')}`
      : `${dayjs(schedule.dateTime.toDate()).format('HH:mm')}～`;
    return `${date} ${timeRange}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ mt: { xs: 4, md: 8 } }}>
      {/* ヘルプテキストとマイページリンク */}
      {userInfo.companyName && userInfo.fullName && (
        <Alert severity="info" sx={{ mb: 4, textAlign: 'center' }}>
          {userInfo.companyName} {userInfo.fullName}さん、こんにちは！
          <Button 
            variant="outlined" 
            size="small" 
            onClick={() => navigate('/my-bookings')}
            sx={{ ml: 2 }}
          >
            マイページで申し込み状況を確認
          </Button>
        </Alert>
      )}
      
      {/* <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
        研修一覧
      </Typography> */}

      <Grid container spacing={6} justifyContent="center" sx={{ px: { xs: 2, md: 4 } }}>
        {courses.map((course) => (
          <Grid item xs={12} md={6} lg={4} key={course.id}>
            <Card sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              transition: 'all 0.3s ease-in-out',
              boxShadow: 4,
              border: '3px solid',
              borderColor: 'primary.light',
              borderRadius: 4,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: { xs: 300, md: 350 },
              '&:hover': {
                transform: 'translateY(-12px) scale(1.02)',
                boxShadow: 8,
                borderColor: 'primary.main',
                '& .course-icon': {
                  transform: 'rotate(360deg) scale(1.2)',
                  color: 'primary.main'
                }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: 'linear-gradient(90deg, primary.main, secondary.main)',
                zIndex: 1
              }
            }}>
              <CardContent sx={{ 
                flexGrow: 1, 
                p: { xs: 5, md: 6 }, 
                textAlign: 'center',
                position: 'relative',
                zIndex: 2
              }}>
                <Box sx={{ mb: 4 }}>
                  <School 
                    className="course-icon"
                    sx={{ 
                      fontSize: { xs: 60, md: 80 }, 
                      color: 'primary.light',
                      mb: 3,
                      transition: 'all 0.3s ease-in-out'
                    }} 
                  />
                </Box>
                
                <Typography variant="h2" component="h2" sx={{ 
                  fontWeight: 800, 
                  fontSize: { xs: '2.2rem', md: '2.8rem' }, 
                  color: 'primary.main',
                  mb: 2,
                  lineHeight: 1.1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  letterSpacing: '-0.02em'
                }}>
                  {course.title}
                </Typography>
              </CardContent>
              
              <CardActions sx={{ p: { xs: 5, md: 6 }, pt: 0, position: 'relative', zIndex: 2 }}>
                <Button
                  size="large"
                  color="primary"
                  variant="contained"
                  startIcon={<EventAvailable />}
                  onClick={() => navigate(`/booking/${course.id}`)}
                  disabled={
                    course.schedules?.every(schedule => 
                      getAvailabilityStatus(course, schedule).isFullyBooked
                    ) || userBookings.has(course.id)
                  }
                  fullWidth
                  sx={{ 
                    py: { xs: 2.5, md: 3 },
                    px: { xs: 4, md: 6 },
                    fontSize: { xs: '1.3rem', md: '1.5rem' },
                    fontWeight: 'bold',
                    borderRadius: 6,
                    boxShadow: 3,
                    background: 'linear-gradient(45deg, primary.main, primary.dark)',
                    textTransform: 'none',
                    letterSpacing: '0.5px',
                    minHeight: { xs: 56, md: 64 },
                    '&:hover': {
                      boxShadow: 6,
                      background: 'linear-gradient(45deg, primary.dark, primary.main)',
                      transform: 'translateY(-2px)'
                    },
                    '&:disabled': {
                      background: 'linear-gradient(45deg, #bdbdbd, #9e9e9e)',
                      color: 'white'
                    }
                  }}
                  className="notranslate"
                  translate="no"
                >
                  {userBookings.has(course.id) ? '申し込み済み' : '申し込む'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {courses.length === 0 && !loading && (
        <Alert severity="info" sx={{ mt: 3 }}>
          表示する講座がありません。
        </Alert>
      )}
    </Box>
  );
};

export default CourseList; 