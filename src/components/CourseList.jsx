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
  CalendarToday
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

  const formatDateTime = (dateTime) => {
    return dayjs(dateTime.toDate()).format('YYYY年MM月DD日(ddd) HH:mm');
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
      {/* <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
        研修一覧
      </Typography> */}

      <Grid container spacing={4} justifyContent="center">
        {courses.map((course) => (
          <Grid item xs={12} sm={6} md={4} key={course.id}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%'
            }}>
              <Box mb={3}>
                <Typography variant="h2" component="h2" sx={{ 
                  fontWeight: 'bold', 
                  fontSize: { xs: '2.5rem', md: '3.5rem' }, 
                  textAlign: 'center',
                  mb: 3
                }}>
                  {course.title}
                </Typography>
              </Box>
              
              <Card sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}>
                <CardContent sx={{ flexGrow: 1, p: { xs: 3, md: 4 } }}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.125rem' }, fontWeight: 'bold' }}>
                      <CalendarToday sx={{ fontSize: { xs: 18, md: 20 }, mr: 1 }} />
                      開催日時:
                    </Typography>
                    {course.schedules?.map((schedule) => {
                      const availability = getAvailabilityStatus(course, schedule);
                      return (
                        <Box key={schedule.id} sx={{ ml: 3, mb: 1.5 }}>
                          <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', md: '1rem' }, fontWeight: 'medium' }}>
                            {formatDateTime(schedule.dateTime)}
                          </Typography>
                          <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                            <Chip
                              size="medium"
                              icon={<Group sx={{ fontSize: { xs: '1rem', md: '1.125rem' } }} />}
                              label={`${availability.totalBookings}/${schedule.capacity}名`}
                              color={availability.isFullyBooked ? 'error' : 'success'}
                              sx={{ 
                                fontSize: { xs: '0.75rem', md: '0.875rem' },
                                fontWeight: 'bold'
                              }}
                            />
                            <Chip
                              size="medium"
                              icon={<Computer sx={{ fontSize: { xs: '1rem', md: '1.125rem' } }} />}
                              label={`PC貸出: ${availability.pcSlotsAvailable}台`}
                              color={availability.pcSlotsAvailable > 0 ? 'info' : 'warning'}
                              sx={{ 
                                fontSize: { xs: '0.75rem', md: '0.875rem' },
                                fontWeight: 'bold'
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
                
                <CardActions sx={{ p: { xs: 3, md: 4 }, pt: 0 }}>
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
                      mt: 'auto',
                      py: { xs: 1.5, md: 2 },
                      fontSize: { xs: '1.1rem', md: '1.25rem' },
                      fontWeight: 'bold'
                    }}
                  >
                    {userBookings.has(course.id) ? '申し込み済み' : '申し込む'}
                  </Button>
                </CardActions>
              </Card>
            </Box>
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