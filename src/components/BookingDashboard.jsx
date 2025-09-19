import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Download,
  Refresh,
  FilterList,
  People,
  Computer,
  Event,
  ExpandMore,
  Schedule,
  Group,
  Cancel,
  Add,
  Delete,
  PersonAdd,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import Papa from 'papaparse';
import {
  getAllBookings,
  getBookingStatistics,
  getCourses,
  adminCancelBooking,
} from '../utils/firestore';

const BookingDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // 統計データ
  const [statistics, setStatistics] = useState(null);

  // 申し込み一覧データ
  const [allBookings, setAllBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [courses, setCourses] = useState([]);

  // 研修日時ごとのデータ
  const [scheduleDetails, setScheduleDetails] = useState([]);

  // フィルター条件
  const [filters, setFilters] = useState({
    courseId: '',
    scheduleId: '',
    companyName: '',
    fullName: '',
    needsPcRental: '',
    dateFrom: '',
    dateTo: '',
  });

  // 管理機能用の状態
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allBookings, filters]); // applyFiltersは内部でstateのみを使用するため依存関係に含めない

  useEffect(() => {
    processScheduleDetails();
  }, [allBookings, courses]); // processScheduleDetailsは内部でstateのみを使用するため依存関係に含めない

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [bookingsData, statisticsData, coursesData] = await Promise.all([
        getAllBookings(),
        getBookingStatistics(),
        getCourses(),
      ]);

      setAllBookings(bookingsData);
      setStatistics(statisticsData);
      setCourses(coursesData);

      // デバッグログ
      console.log('統計データ:', statisticsData);
      console.log('totalApplicants:', statisticsData?.totalApplicants);
    } catch (err) {
      const errorMessage = `データの取得に失敗しました: ${err.message || '不明なエラー'}`;
      setError(errorMessage);
      console.error('BookingDashboard fetchData エラー:', err);
      console.error('エラー詳細:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  const processScheduleDetails = () => {
    const scheduleMap = new Map();

    // 各スケジュールごとに申し込み者をグループ化
    allBookings.forEach(booking => {
      const key = `${booking.courseId}-${booking.scheduleId}`;
      if (!scheduleMap.has(key)) {
        scheduleMap.set(key, {
          courseId: booking.courseId,
          courseTitle: booking.courseTitle,
          scheduleId: booking.scheduleId,
          scheduleDateTime: booking.scheduleDateTime,
          bookings: [],
          participantCount: 0,
          pcRentalCount: 0,
        });
      }

      const scheduleData = scheduleMap.get(key);
      scheduleData.bookings.push(booking);
      scheduleData.participantCount += 1;
      if (booking.needsPcRental) {
        scheduleData.pcRentalCount += 1;
      }
    });

    // 日時順でソート
    const sortedSchedules = Array.from(scheduleMap.values()).sort((a, b) => {
      return dayjs(a.scheduleDateTime.toDate()).diff(
        dayjs(b.scheduleDateTime.toDate())
      );
    });

    setScheduleDetails(sortedSchedules);
  };

  const applyFilters = () => {
    let filtered = [...allBookings];

    // 講座でフィルター
    if (filters.courseId) {
      filtered = filtered.filter(
        booking => booking.courseId === filters.courseId
      );
    }

    // スケジュールでフィルター
    if (filters.scheduleId) {
      filtered = filtered.filter(
        booking => booking.scheduleId === filters.scheduleId
      );
    }

    // 会社名でフィルター
    if (filters.companyName) {
      filtered = filtered.filter(booking =>
        booking.companyName
          .toLowerCase()
          .includes(filters.companyName.toLowerCase())
      );
    }

    // 名前でフィルター
    if (filters.fullName) {
      filtered = filtered.filter(booking =>
        booking.fullName.toLowerCase().includes(filters.fullName.toLowerCase())
      );
    }

    // PC貸出でフィルター
    if (filters.needsPcRental !== '') {
      const needsPc = filters.needsPcRental === 'true';
      filtered = filtered.filter(booking => booking.needsPcRental === needsPc);
    }

    // 申し込み日でフィルター
    if (filters.dateFrom) {
      filtered = filtered.filter(booking =>
        dayjs(booking.createdAt.toDate()).isAfter(dayjs(filters.dateFrom))
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(booking =>
        dayjs(booking.createdAt.toDate()).isBefore(
          dayjs(filters.dateTo).add(1, 'day')
        )
      );
    }

    setFilteredBookings(filtered);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      // 講座が変更された場合はスケジュールをリセット
      ...(field === 'courseId' && { scheduleId: '' }),
    }));
  };

  const getAvailableSchedules = () => {
    if (!filters.courseId) {
      // 講座が選択されていない場合は、全ての講座の全スケジュールを返す
      const allSchedules = [];
      courses.forEach(course => {
        course.schedules?.forEach(schedule => {
          allSchedules.push({
            ...schedule,
            courseId: course.id,
            courseTitle: course.title,
          });
        });
      });
      // 日時順でソート
      return allSchedules.sort((a, b) =>
        dayjs(a.dateTime.toDate()).diff(dayjs(b.dateTime.toDate()))
      );
    }
    const course = courses.find(c => c.id === filters.courseId);
    return course?.schedules || [];
  };

  // 管理機能のハンドラー
  const handleCancelBooking = booking => {
    setBookingToCancel(booking);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel || !cancelReason.trim()) {
      return;
    }

    try {
      setCancelLoading(true);
      await adminCancelBooking(bookingToCancel.id, cancelReason.trim());

      // データを再取得
      await fetchData();

      setCancelDialogOpen(false);
      setBookingToCancel(null);
      setCancelReason('');

      setSuccessMessage('申し込みをキャンセルしました');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setError('キャンセルに失敗しました: ' + error.message);
      console.error(error);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCloseCancel = () => {
    setCancelDialogOpen(false);
    setBookingToCancel(null);
    setCancelReason('');
  };

  const exportToCSV = () => {
    const csvData = filteredBookings.map(booking => ({
      申し込み日時: dayjs(booking.createdAt.toDate()).format(
        'YYYY/MM/DD HH:mm'
      ),
      講座名: booking.courseTitle,
      開催日時: dayjs(booking.scheduleDateTime.toDate()).format(
        'YYYY/MM/DD HH:mm'
      ),
      会社名: booking.companyName,
      氏名: booking.fullName,
      PC貸出: booking.needsPcRental ? '希望' : '持参',
      申し込みID: booking.id,
    }));

    const csv = Papa.unparse(csvData, {
      header: true,
    });

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `申し込み一覧_${dayjs().format('YYYYMMDD_HHmm')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportScheduleDetailsToCSV = () => {
    const csvData = [];

    scheduleDetails.forEach(schedule => {
      schedule.bookings.forEach((booking, index) => {
        csvData.push({
          講座名: schedule.courseTitle,
          開催日時: dayjs(schedule.scheduleDateTime.toDate()).format(
            'YYYY/MM/DD HH:mm'
          ),
          参加者番号: index + 1,
          会社名: booking.companyName,
          氏名: booking.fullName,
          PC貸出: booking.needsPcRental ? '希望' : '持参',
          申し込み日時: dayjs(booking.createdAt.toDate()).format(
            'YYYY/MM/DD HH:mm'
          ),
        });
      });
    });

    const csv = Papa.unparse(csvData, {
      header: true,
    });

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `研修日時別参加者一覧_${dayjs().format('YYYYMMDD_HHmm')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDateTime = timestamp => {
    return dayjs(timestamp.toDate()).format('YYYY/MM/DD HH:mm');
  };

  const clearFilters = () => {
    setFilters({
      courseId: '',
      scheduleId: '',
      companyName: '',
      fullName: '',
      needsPcRental: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        minHeight='400px'
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity='error'>{error}</Alert>;
  }

  return (
    <Box>
      <Box
        display='flex'
        justifyContent='space-between'
        alignItems='center'
        mb={3}
      >
        <Typography variant='h4' component='h1'>
          申込者管理ダッシュボード
        </Typography>
        <Button variant='outlined' startIcon={<Refresh />} onClick={fetchData}>
          更新
        </Button>
      </Box>

      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label='統計情報' />
        <Tab label='申込者一覧' />
        <Tab label='研修日時別詳細' />
      </Tabs>

      {/* 統計情報タブ */}
      {tabValue === 0 && (
        <>
          {!statistics ? (
            <Box textAlign='center' py={4}>
              <Alert severity='warning'>
                統計データを取得できていません。データを再読み込みしてください。
              </Alert>
            </Box>
          ) : (
            <Box sx={{ maxWidth: '1200px', margin: '0 auto', px: 2 }}>
              <Grid container spacing={4} justifyContent='center'>
                {/* 全体統計 - 横並びレイアウト */}
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  sx={{ display: 'flex', justifyContent: 'center' }}
                >
                  <Card
                    sx={{ width: '100%', maxWidth: 300, textAlign: 'center' }}
                  >
                    <CardContent sx={{ py: 4 }}>
                      <Box
                        display='flex'
                        alignItems='center'
                        justifyContent='center'
                        mb={3}
                      >
                        <People
                          sx={{ mr: 1, color: 'primary.main', fontSize: 40 }}
                        />
                      </Box>
                      <Typography variant='h6' gutterBottom>
                        総申し込み数
                      </Typography>
                      <Typography
                        variant='h2'
                        color='primary'
                        sx={{ fontWeight: 'bold', mb: 1 }}
                      >
                        {statistics.totalBookings}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        件
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  sx={{ display: 'flex', justifyContent: 'center' }}
                >
                  <Card
                    sx={{ width: '100%', maxWidth: 300, textAlign: 'center' }}
                  >
                    <CardContent sx={{ py: 4 }}>
                      <Box
                        display='flex'
                        alignItems='center'
                        justifyContent='center'
                        mb={3}
                      >
                        <Group
                          sx={{ mr: 1, color: 'info.main', fontSize: 40 }}
                        />
                      </Box>
                      <Typography variant='h6' gutterBottom>
                        申込者数
                      </Typography>
                      <Typography
                        variant='h2'
                        color='info.main'
                        sx={{ fontWeight: 'bold', mb: 1 }}
                      >
                        {statistics.totalApplicants || 0}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        名
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  sx={{ display: 'flex', justifyContent: 'center' }}
                >
                  <Card
                    sx={{ width: '100%', maxWidth: 300, textAlign: 'center' }}
                  >
                    <CardContent sx={{ py: 4 }}>
                      <Box
                        display='flex'
                        alignItems='center'
                        justifyContent='center'
                        mb={3}
                      >
                        <Computer
                          sx={{ mr: 1, color: 'secondary.main', fontSize: 40 }}
                        />
                      </Box>
                      <Typography variant='h6' gutterBottom>
                        PC貸出申し込み
                      </Typography>
                      <Typography
                        variant='h2'
                        color='secondary'
                        sx={{ fontWeight: 'bold', mb: 1 }}
                      >
                        {statistics.totalPcRentals}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        件
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  sx={{ display: 'flex', justifyContent: 'center' }}
                >
                  <Card
                    sx={{ width: '100%', maxWidth: 300, textAlign: 'center' }}
                  >
                    <CardContent sx={{ py: 4 }}>
                      <Box
                        display='flex'
                        alignItems='center'
                        justifyContent='center'
                        mb={3}
                      >
                        <Event
                          sx={{ mr: 1, color: 'success.main', fontSize: 40 }}
                        />
                      </Box>
                      <Typography variant='h6' gutterBottom>
                        開催講座数
                      </Typography>
                      <Typography
                        variant='h2'
                        color='success.main'
                        sx={{ fontWeight: 'bold', mb: 1 }}
                      >
                        {statistics.courseStats.length}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        講座
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* 講座別申込状況と日時別申込状況を横並びに */}
                <Grid container spacing={4} sx={{ mt: 4 }}>
                  {/* 講座別申込状況 */}
                  <Grid item xs={12} lg={6}>
                    <Typography
                      variant='h5'
                      component='h2'
                      gutterBottom
                      textAlign='center'
                      sx={{ mb: 4 }}
                    >
                      講座別申し込み状況
                    </Typography>
                    <Card sx={{ height: 'fit-content' }}>
                      <CardContent sx={{ p: 3 }}>
                        <TableContainer
                          sx={{ maxHeight: 600, overflowY: 'auto' }}
                        >
                          <Table size='small'>
                            <TableHead>
                              <TableRow>
                                <TableCell
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  講座名
                                </TableCell>
                                <TableCell
                                  align='center'
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  申込数
                                </TableCell>
                                <TableCell
                                  align='center'
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  申込者数
                                </TableCell>
                                <TableCell
                                  align='center'
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  PC貸出
                                </TableCell>
                                <TableCell
                                  align='center'
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  回数
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {statistics.courseStats.map(courseStat => (
                                <TableRow
                                  key={courseStat.courseId}
                                  sx={{
                                    '&:nth-of-type(odd)': {
                                      backgroundColor: 'action.hover',
                                    },
                                    '&:hover': {
                                      backgroundColor: 'action.selected',
                                    },
                                  }}
                                >
                                  <TableCell
                                    sx={{ py: 2, fontSize: '0.85rem' }}
                                  >
                                    {courseStat.courseTitle}
                                  </TableCell>
                                  <TableCell align='center' sx={{ py: 2 }}>
                                    <Typography
                                      variant='body1'
                                      color='primary'
                                      sx={{ fontWeight: 'bold' }}
                                    >
                                      {courseStat.totalBookings}件
                                    </Typography>
                                  </TableCell>
                                  <TableCell align='center' sx={{ py: 2 }}>
                                    <Typography
                                      variant='body1'
                                      color='info.main'
                                      sx={{ fontWeight: 'bold' }}
                                    >
                                      {courseStat.uniqueApplicants || 0}名
                                    </Typography>
                                  </TableCell>
                                  <TableCell align='center' sx={{ py: 2 }}>
                                    <Typography
                                      variant='body1'
                                      color='secondary'
                                      sx={{ fontWeight: 'bold' }}
                                    >
                                      {courseStat.pcRentals}件
                                    </Typography>
                                  </TableCell>
                                  <TableCell align='center' sx={{ py: 2 }}>
                                    <Typography
                                      variant='body1'
                                      color='success.main'
                                      sx={{ fontWeight: 'bold' }}
                                    >
                                      {courseStat.scheduleStats.length}回
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {statistics.courseStats.length === 0 && (
                          <Box textAlign='center' py={4}>
                            <Typography color='text.secondary' variant='body1'>
                              申し込みのある講座がありません
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* 日時別申込状況 */}
                  <Grid item xs={12} lg={6}>
                    <Typography
                      variant='h5'
                      component='h2'
                      gutterBottom
                      textAlign='center'
                      sx={{ mb: 4 }}
                    >
                      日時別申し込み状況
                    </Typography>
                    <Card sx={{ height: 'fit-content' }}>
                      <CardContent sx={{ p: 3 }}>
                        <TableContainer
                          sx={{ maxHeight: 600, overflowY: 'auto' }}
                        >
                          <Table size='small'>
                            <TableHead>
                              <TableRow>
                                <TableCell
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  開催日時
                                </TableCell>
                                <TableCell
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  講座名
                                </TableCell>
                                <TableCell
                                  align='center'
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  申込/定員
                                </TableCell>
                                <TableCell
                                  align='center'
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  PC貸出
                                </TableCell>
                                <TableCell
                                  align='center'
                                  sx={{
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    py: 1.5,
                                  }}
                                >
                                  状況
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {scheduleDetails.map(schedule => {
                                // 定員情報を取得（coursesからスケジュールの定員を探す）
                                const course = courses.find(
                                  c => c.id === schedule.courseId
                                );
                                const scheduleInfo = course?.schedules?.find(
                                  s => s.id === schedule.scheduleId
                                );
                                const capacity = scheduleInfo?.capacity || 0;
                                const remainingSlots =
                                  capacity - schedule.participantCount;
                                const isFullyBooked = remainingSlots <= 0;

                                return (
                                  <TableRow
                                    key={`${schedule.courseId}-${schedule.scheduleId}`}
                                    sx={{
                                      '&:nth-of-type(odd)': {
                                        backgroundColor: 'action.hover',
                                      },
                                      '&:hover': {
                                        backgroundColor: 'action.selected',
                                      },
                                    }}
                                  >
                                    <TableCell
                                      sx={{ py: 2, fontSize: '0.85rem' }}
                                    >
                                      {dayjs(
                                        schedule.scheduleDateTime.toDate()
                                      ).format('MM/DD HH:mm')}
                                    </TableCell>
                                    <TableCell
                                      sx={{ py: 2, fontSize: '0.85rem' }}
                                    >
                                      {schedule.courseTitle.length > 15
                                        ? `${schedule.courseTitle.substring(0, 15)}...`
                                        : schedule.courseTitle}
                                    </TableCell>
                                    <TableCell align='center' sx={{ py: 2 }}>
                                      <Typography
                                        variant='body1'
                                        color='primary'
                                        sx={{ fontWeight: 'bold' }}
                                      >
                                        {schedule.participantCount}/{capacity}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align='center' sx={{ py: 2 }}>
                                      <Typography
                                        variant='body1'
                                        color='secondary'
                                        sx={{ fontWeight: 'bold' }}
                                      >
                                        {schedule.pcRentalCount}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align='center' sx={{ py: 2 }}>
                                      {isFullyBooked ? (
                                        <Chip
                                          label='満席'
                                          color='error'
                                          size='small'
                                          sx={{
                                            fontWeight: 'bold',
                                            fontSize: '0.75rem',
                                          }}
                                        />
                                      ) : (
                                        <Chip
                                          label={`空${remainingSlots}`}
                                          color='success'
                                          size='small'
                                          sx={{
                                            fontWeight: 'bold',
                                            fontSize: '0.75rem',
                                          }}
                                        />
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {scheduleDetails.length === 0 && (
                          <Box textAlign='center' py={4}>
                            <Typography color='text.secondary' variant='body1'>
                              申し込みのあるスケジュールがありません
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
            </Box>
          )}
        </>
      )}

      {/* 申込者一覧タブ */}
      {tabValue === 1 && (
        <>
          {/* フィルター */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display='flex' alignItems='center' mb={2}>
                <FilterList sx={{ mr: 1 }} />
                <Typography variant='h6'>フィルター</Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size='small' sx={{ minWidth: 200 }}>
                    <InputLabel>講座</InputLabel>
                    <Select
                      value={filters.courseId}
                      onChange={e =>
                        handleFilterChange('courseId', e.target.value)
                      }
                      label='講座'
                      sx={{ minWidth: 200 }}
                    >
                      <MenuItem value=''>すべて</MenuItem>
                      {courses.map(course => (
                        <MenuItem key={course.id} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size='small' sx={{ minWidth: 150 }}>
                    <InputLabel>開催日時</InputLabel>
                    <Select
                      value={filters.scheduleId}
                      onChange={e =>
                        handleFilterChange('scheduleId', e.target.value)
                      }
                      label='開催日時'
                      sx={{ minWidth: 150 }}
                    >
                      <MenuItem value=''>すべて</MenuItem>
                      {getAvailableSchedules().map(schedule => (
                        <MenuItem
                          key={`${schedule.courseId}-${schedule.id}`}
                          value={schedule.id}
                        >
                          <Box>
                            <Typography
                              variant='body2'
                              sx={{ fontWeight: 'bold' }}
                            >
                              {dayjs(schedule.dateTime.toDate()).format(
                                'MM/DD HH:mm'
                              )}
                            </Typography>
                            {schedule.courseTitle && (
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                {schedule.courseTitle}
                              </Typography>
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size='small'
                    label='会社名'
                    value={filters.companyName}
                    onChange={e =>
                      handleFilterChange('companyName', e.target.value)
                    }
                    sx={{ minWidth: 120 }}
                  />
                </Grid>

                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size='small'
                    label='氏名'
                    value={filters.fullName}
                    onChange={e =>
                      handleFilterChange('fullName', e.target.value)
                    }
                    sx={{ minWidth: 120 }}
                    placeholder='山田太郎'
                  />
                </Grid>

                <Grid item xs={12} md={1.5}>
                  <FormControl fullWidth size='small' sx={{ minWidth: 100 }}>
                    <InputLabel>PC貸出</InputLabel>
                    <Select
                      value={filters.needsPcRental}
                      onChange={e =>
                        handleFilterChange('needsPcRental', e.target.value)
                      }
                      label='PC貸出'
                      sx={{ minWidth: 100 }}
                    >
                      <MenuItem value=''>すべて</MenuItem>
                      <MenuItem value='true'>希望</MenuItem>
                      <MenuItem value='false'>持参</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={1.5}>
                  <Box display='flex' gap={1}>
                    <Button size='small' onClick={clearFilters}>
                      クリア
                    </Button>
                    <Button
                      variant='contained'
                      size='small'
                      startIcon={<Download />}
                      onClick={exportToCSV}
                    >
                      CSV出力
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 申込者一覧テーブル */}
          <Card>
            <CardContent>
              <Box
                display='flex'
                justifyContent='space-between'
                alignItems='center'
                mb={2}
              >
                <Typography variant='h6'>
                  申込者一覧 ({filteredBookings.length}件)
                </Typography>
              </Box>

              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>申し込み日時</TableCell>
                      <TableCell>講座名</TableCell>
                      <TableCell>開催日時</TableCell>
                      <TableCell>会社名</TableCell>
                      <TableCell>氏名</TableCell>
                      <TableCell align='center'>PC貸出</TableCell>
                      <TableCell align='center'>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredBookings.map(booking => (
                      <TableRow key={booking.id}>
                        <TableCell>
                          {formatDateTime(booking.createdAt)}
                        </TableCell>
                        <TableCell>{booking.courseTitle}</TableCell>
                        <TableCell>
                          {formatDateTime(booking.scheduleDateTime)}
                        </TableCell>
                        <TableCell>{booking.companyName}</TableCell>
                        <TableCell>{booking.fullName}</TableCell>
                        <TableCell align='center'>
                          <Chip
                            size='small'
                            label={booking.needsPcRental ? '希望' : '持参'}
                            color={
                              booking.needsPcRental ? 'primary' : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell align='center'>
                          <Tooltip title='申し込みをキャンセル'>
                            <IconButton
                              size='small'
                              color='error'
                              onClick={() => handleCancelBooking(booking)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {filteredBookings.length === 0 && (
                <Box textAlign='center' py={4}>
                  <Typography color='text.secondary'>
                    条件に一致する申し込みがありません
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 研修日時別詳細タブ */}
      {tabValue === 2 && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                display='flex'
                justifyContent='space-between'
                alignItems='center'
                mb={2}
              >
                <Box display='flex' alignItems='center'>
                  <Schedule sx={{ mr: 1 }} />
                  <Typography variant='h6'>
                    研修日時別参加者詳細 ({scheduleDetails.length}回の研修)
                  </Typography>
                </Box>
                <Button
                  variant='contained'
                  startIcon={<Download />}
                  onClick={exportScheduleDetailsToCSV}
                >
                  CSV出力
                </Button>
              </Box>

              <Typography variant='body2' color='text.secondary'>
                各研修日時の参加者数と参加メンバーの詳細を確認できます。
              </Typography>
            </CardContent>
          </Card>

          {scheduleDetails.length === 0 ? (
            <Card>
              <CardContent>
                <Box textAlign='center' py={4}>
                  <Typography color='text.secondary'>
                    申し込みのある研修がありません
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Box>
              {scheduleDetails.map(schedule => (
                <Accordion
                  key={`${schedule.courseId}-${schedule.scheduleId}`}
                  sx={{ mb: 2 }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pr: 2,
                      }}
                    >
                      <Box>
                        <Typography variant='h6' component='div'>
                          {schedule.courseTitle}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          {dayjs(schedule.scheduleDateTime.toDate()).format(
                            'YYYY年MM月DD日 HH:mm'
                          )}
                        </Typography>
                      </Box>
                      <Box display='flex' gap={2}>
                        <Chip
                          icon={<People />}
                          label={`${schedule.participantCount}名`}
                          color='primary'
                          size='small'
                        />
                        <Chip
                          icon={<Computer />}
                          label={`PC貸出 ${schedule.pcRentalCount}件`}
                          color='secondary'
                          size='small'
                        />
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={3}>
                      {/* 参加者統計 */}
                      <Grid item xs={12} md={3}>
                        <Card variant='outlined'>
                          <CardContent>
                            <Typography variant='subtitle2' gutterBottom>
                              参加者統計
                            </Typography>
                            <Typography variant='body2'>
                              総参加者数: {schedule.participantCount}名
                            </Typography>
                            <Typography variant='body2'>
                              PC貸出希望: {schedule.pcRentalCount}名
                            </Typography>
                            <Typography variant='body2'>
                              PC持参:{' '}
                              {schedule.participantCount -
                                schedule.pcRentalCount}
                              名
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>

                      {/* 参加者一覧 */}
                      <Grid item xs={12} md={9}>
                        <Card variant='outlined'>
                          <CardContent>
                            <Typography variant='subtitle2' gutterBottom>
                              参加メンバー一覧
                            </Typography>
                            <TableContainer>
                              <Table size='small'>
                                <TableHead>
                                  <TableRow>
                                    <TableCell width='60px'>No.</TableCell>
                                    <TableCell>会社名</TableCell>
                                    <TableCell>氏名</TableCell>
                                    <TableCell align='center'>PC貸出</TableCell>
                                    <TableCell>申し込み日時</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {schedule.bookings.map((booking, idx) => (
                                    <TableRow key={booking.id}>
                                      <TableCell>{idx + 1}</TableCell>
                                      <TableCell>
                                        {booking.companyName}
                                      </TableCell>
                                      <TableCell>{booking.fullName}</TableCell>
                                      <TableCell align='center'>
                                        <Chip
                                          size='small'
                                          label={
                                            booking.needsPcRental
                                              ? '希望'
                                              : '持参'
                                          }
                                          color={
                                            booking.needsPcRental
                                              ? 'primary'
                                              : 'default'
                                          }
                                          variant='outlined'
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {dayjs(
                                          booking.createdAt.toDate()
                                        ).format('MM/DD HH:mm')}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </>
      )}

      {/* 成功メッセージ */}
      {successMessage && (
        <Alert
          severity='success'
          sx={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}
        >
          {successMessage}
        </Alert>
      )}

      {/* キャンセル確認ダイアログ */}
      <Dialog
        open={cancelDialogOpen}
        onClose={handleCloseCancel}
        aria-labelledby='cancel-dialog-title'
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle id='cancel-dialog-title'>
          申し込みをキャンセルしますか？
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {bookingToCancel && (
              <>
                以下の申し込みをキャンセルします。この操作は取り消せません。
                <br />
                <br />
                <strong>申し込み者:</strong> {bookingToCancel.companyName}{' '}
                {bookingToCancel.fullName}
                <br />
                <strong>講座名:</strong> {bookingToCancel.courseTitle}
                <br />
                <strong>開催日時:</strong>{' '}
                {formatDateTime(bookingToCancel.scheduleDateTime)}
                <br />
                <strong>PC貸出:</strong>{' '}
                {bookingToCancel.needsPcRental ? 'PC貸出希望' : 'PC持参'}
              </>
            )}
          </DialogContentText>
          <TextField
            autoFocus
            margin='dense'
            label='キャンセル理由'
            fullWidth
            multiline
            rows={3}
            variant='outlined'
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder='管理者によるキャンセルの理由を入力してください'
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancel} disabled={cancelLoading}>
            戻る
          </Button>
          <Button
            onClick={handleConfirmCancel}
            color='error'
            variant='contained'
            disabled={cancelLoading || !cancelReason.trim()}
            startIcon={
              cancelLoading ? <CircularProgress size={20} /> : <Delete />
            }
          >
            {cancelLoading ? 'キャンセル中...' : 'キャンセル実行'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookingDashboard;
