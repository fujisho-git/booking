import React, { useState, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Container,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  Settings,
  EventAvailable,
  Computer,
  Group,
  Logout,
  Dashboard,
  School,
  Email,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { signOutUser } from '../utils/auth';
import Login from './Login';
import BookingDashboard from './BookingDashboard';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import {
  getCourses,
  createCourse,
  updateCourse,
  getBookingsCount,
  getCancelLogs,
  getCancelStatistics,
  getUserBookingsForEmail,
} from '../utils/firestore';

const AdminPanel = () => {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [cancelLogs, setCancelLogs] = useState([]);
  const [cancelStats, setCancelStats] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [loadingUserBookings, setLoadingUserBookings] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      schedules: [
        {
          id: Date.now().toString(),
          dateTime: dayjs().add(1, 'day'),
          endTime: dayjs().add(1, 'day').add(2, 'hour'),
          capacity: 10,
          pcRentalSlots: 5,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'schedules',
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (tabValue === 2) {
      // キャンセルログタブが選択された時
      fetchCancelLogs();
    } else if (tabValue === 3) {
      // ユーザー申し込み一覧タブが選択された時
      fetchUserBookings();
    }
  }, [tabValue]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const coursesData = await getCourses();

      // 各講座の申し込み状況を取得
      const coursesWithBookings = await Promise.all(
        coursesData.map(async course => {
          const scheduleBookings = await Promise.all(
            (course.schedules || []).map(async schedule => {
              const { totalBookings, pcRentals } = await getBookingsCount(
                course.id,
                schedule.id
              );
              return {
                ...schedule,
                totalBookings,
                pcRentals,
              };
            })
          );
          return {
            ...course,
            schedules: scheduleBookings,
          };
        })
      );

      setCourses(coursesWithBookings);
    } catch (err) {
      setError('講座の取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (course = null) => {
    if (course) {
      setEditingCourse(course);
      reset({
        title: course.title,
        schedules: course.schedules?.map(schedule => ({
          ...schedule,
          dateTime: dayjs(schedule.dateTime.toDate()),
          endTime: schedule.endTime
            ? dayjs(schedule.endTime.toDate())
            : dayjs(schedule.dateTime.toDate()).add(2, 'hour'),
        })) || [
          {
            id: Date.now().toString(),
            dateTime: dayjs().add(1, 'day'),
            endTime: dayjs().add(1, 'day').add(2, 'hour'),
            capacity: 10,
            pcRentalSlots: 5,
          },
        ],
      });
    } else {
      setEditingCourse(null);
      reset({
        title: '',
        schedules: [
          {
            id: Date.now().toString(),
            dateTime: dayjs().add(1, 'day'),
            endTime: dayjs().add(1, 'day').add(2, 'hour'),
            capacity: 10,
            pcRentalSlots: 5,
          },
        ],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCourse(null);
    reset();
  };

  const onSubmit = async data => {
    try {
      setSubmitting(true);
      setError(null);

      const courseData = {
        title: data.title.trim(),
        schedules: data.schedules.map(schedule => ({
          id: schedule.id || Date.now().toString() + Math.random(),
          dateTime: schedule.dateTime.toDate(),
          endTime: schedule.endTime.toDate(),
          capacity: parseInt(schedule.capacity),
          pcRentalSlots: parseInt(schedule.pcRentalSlots),
        })),
      };

      if (editingCourse) {
        await updateCourse(editingCourse.id, courseData);
      } else {
        await createCourse(courseData);
      }

      await fetchCourses();
      handleCloseDialog();
    } catch (err) {
      setError('講座の保存に失敗しました');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const addSchedule = () => {
    append({
      id: Date.now().toString(),
      dateTime: dayjs().add(1, 'day'),
      endTime: dayjs().add(1, 'day').add(2, 'hour'),
      capacity: 10,
      pcRentalSlots: 5,
    });
  };

  const fetchCancelLogs = async () => {
    try {
      setLoading(true);
      const [logsData, statsData] = await Promise.all([
        getCancelLogs(),
        getCancelStatistics(),
      ]);
      setCancelLogs(logsData);
      setCancelStats(statsData);
    } catch (err) {
      setError('キャンセルログの取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBookings = async () => {
    try {
      setLoadingUserBookings(true);
      const userBookingsData = await getUserBookingsForEmail();
      setUserBookings(userBookingsData);
    } catch (err) {
      setError('申し込み者情報の取得に失敗しました');
      console.error(err);
    } finally {
      setLoadingUserBookings(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const formatDateTime = dateTime => {
    if (dateTime?.toDate) {
      return dayjs(dateTime.toDate()).format('YYYY/MM/DD HH:mm');
    }
    return dayjs(dateTime).format('YYYY/MM/DD HH:mm');
  };

  // 認証されていない場合はログイン画面を表示
  if (!currentUser) {
    return <Login />;
  }

  if (loading && tabValue === 1) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        minHeight='400px'
      >
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
      <AppBar
        position='static'
        color='transparent'
        elevation={1}
        sx={{ mb: 3 }}
      >
        <Toolbar>
          <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
            管理者パネル - {currentUser.email}
          </Typography>
          <Button color='inherit' startIcon={<Logout />} onClick={handleLogout}>
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>

      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        sx={{ mb: 3 }}
        variant='fullWidth'
      >
        <Tab icon={<Dashboard />} label='申込者管理' iconPosition='start' />
        <Tab icon={<School />} label='講座管理' iconPosition='start' />
        <Tab icon={<Cancel />} label='キャンセルログ' iconPosition='start' />
        <Tab icon={<Email />} label='メール送信用' iconPosition='start' />
      </Tabs>

      {/* 申込者管理タブ */}
      {tabValue === 0 && <BookingDashboard />}

      {/* キャンセルログタブ */}
      {tabValue === 2 && (
        <>
          {cancelStats && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant='h6' color='text.secondary'>
                      総キャンセル数
                    </Typography>
                    <Typography
                      variant='h4'
                      color='error.main'
                      sx={{ fontWeight: 'bold' }}
                    >
                      {cancelStats.totalCancels}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant='h6' color='text.secondary'>
                      今日のキャンセル
                    </Typography>
                    <Typography
                      variant='h4'
                      color='warning.main'
                      sx={{ fontWeight: 'bold' }}
                    >
                      {cancelStats.todayCancels}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant='h6' color='text.secondary'>
                      今週のキャンセル
                    </Typography>
                    <Typography
                      variant='h4'
                      color='info.main'
                      sx={{ fontWeight: 'bold' }}
                    >
                      {cancelStats.weekCancels}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant='h6' color='text.secondary'>
                      今月のキャンセル
                    </Typography>
                    <Typography
                      variant='h4'
                      color='secondary.main'
                      sx={{ fontWeight: 'bold' }}
                    >
                      {cancelStats.monthCancels}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          <Card>
            <CardContent>
              <Box
                display='flex'
                justifyContent='space-between'
                alignItems='center'
                mb={2}
              >
                <Typography variant='h6'>
                  キャンセルログ一覧 ({cancelLogs.length}件)
                </Typography>
                <Button
                  variant='outlined'
                  onClick={fetchCancelLogs}
                  disabled={loading}
                >
                  更新
                </Button>
              </Box>

              {loading ? (
                <Box textAlign='center' py={4}>
                  <Typography>読み込み中...</Typography>
                </Box>
              ) : cancelLogs.length === 0 ? (
                <Box textAlign='center' py={4}>
                  <Typography color='text.secondary'>
                    キャンセルログがありません
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant='outlined'>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>キャンセル日時</TableCell>
                        <TableCell>講座名</TableCell>
                        <TableCell>開催予定日時</TableCell>
                        <TableCell>キャンセル者</TableCell>
                        <TableCell>PC貸出</TableCell>
                        <TableCell>キャンセル理由</TableCell>
                        <TableCell>方法</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cancelLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {formatDateTime(log.canceledAt)}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant='body2'
                              sx={{ fontWeight: 'bold' }}
                            >
                              {log.courseTitle}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {formatDateTime(log.scheduleDateTime)}
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography
                                variant='body2'
                                sx={{ fontWeight: 'bold' }}
                              >
                                {log.fullName}
                              </Typography>
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                {log.companyName}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size='small'
                              label={log.needsPcRental ? 'PC貸出' : 'PC持参'}
                              color={log.needsPcRental ? 'primary' : 'default'}
                              variant='outlined'
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2'>
                              {log.cancelReason}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size='small'
                              label={
                                log.cancelMethod === 'user_interface'
                                  ? 'ユーザー操作'
                                  : log.cancelMethod === 'admin_panel'
                                    ? '管理者操作'
                                    : 'システム'
                              }
                              color={
                                log.cancelMethod === 'user_interface'
                                  ? 'info'
                                  : log.cancelMethod === 'admin_panel'
                                    ? 'warning'
                                    : 'default'
                              }
                              variant='outlined'
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* メール送信用タブ */}
      {tabValue === 3 && (
        <>
          <Box
            display='flex'
            justifyContent='space-between'
            alignItems='center'
            mb={3}
          >
            <Typography variant='h4' component='h1'>
              メール送信用 - 申し込み者一覧
            </Typography>
            <Button
              variant='contained'
              startIcon={<Email />}
              onClick={fetchUserBookings}
              disabled={loadingUserBookings}
            >
              {loadingUserBookings ? '読み込み中...' : '最新データを取得'}
            </Button>
          </Box>

          {error && (
            <Alert severity='error' sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {userBookings.length === 0 && !loadingUserBookings ? (
            <Alert severity='info'>申し込み者がいません。</Alert>
          ) : (
            <Grid container spacing={3}>
              {userBookings.map((user, index) => (
                <Grid
                  item
                  xs={12}
                  key={`${user.companyName}-${user.fullName}-${index}`}
                >
                  <Card>
                    <CardContent>
                      <Box
                        sx={{
                          mb: 2,
                          p: 2,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant='h6'
                          sx={{ fontWeight: 'bold', mb: 1 }}
                        >
                          {user.companyName} {user.fullName} 様
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          {user.email}
                        </Typography>
                      </Box>

                      <Typography
                        variant='subtitle1'
                        sx={{ fontWeight: 'bold', mb: 2 }}
                      >
                        参加予定研修 ({user.bookings.length}件)
                      </Typography>

                      <Box
                        sx={{
                          p: 2,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {user.bookings.map((booking, bookingIndex) => {
                          const startTime = dayjs(
                            booking.scheduleDateTime.toDate()
                          ).format('YYYY年MM月DD日(ddd) HH:mm');
                          const endTime = booking.scheduleEndTime
                            ? dayjs(booking.scheduleEndTime.toDate()).format(
                                'HH:mm'
                              )
                            : '';
                          const timeRange = endTime
                            ? `${startTime}～${endTime}`
                            : startTime;

                          // デバッグ用ログ
                          console.log('Booking data:', {
                            courseTitle: booking.courseTitle,
                            scheduleDateTime: booking.scheduleDateTime,
                            scheduleEndTime: booking.scheduleEndTime,
                            hasEndTime: !!booking.scheduleEndTime,
                          });

                          return (
                            <div key={bookingIndex}>
                              ■ {booking.courseTitle}
                              日時: {timeRange}
                              {bookingIndex < user.bookings.length - 1
                                ? '\n'
                                : ''}
                            </div>
                          );
                        })}
                      </Box>

                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ mt: 1, display: 'block' }}
                      >
                        ※ 上記の内容をそのままメールにコピー＆ペーストできます
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* 講座管理タブ */}
      {tabValue === 1 && (
        <>
          <Box
            display='flex'
            justifyContent='space-between'
            alignItems='center'
            mb={3}
          >
            <Typography variant='h4' component='h1'>
              講座管理
            </Typography>
            <Button
              variant='contained'
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
            >
              新規講座作成
            </Button>
          </Box>

          {error && (
            <Alert severity='error' sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {courses.map(course => (
              <Grid item xs={12} key={course.id}>
                <Card>
                  <CardContent>
                    <Box
                      display='flex'
                      justifyContent='space-between'
                      alignItems='flex-start'
                      mb={2}
                    >
                      <Box>
                        <Typography variant='h6' component='h2'>
                          {course.title}
                        </Typography>
                      </Box>
                      <IconButton onClick={() => handleOpenDialog(course)}>
                        <Edit />
                      </IconButton>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant='h6' gutterBottom>
                      スケジュール・申し込み状況
                    </Typography>

                    <TableContainer component={Paper} variant='outlined'>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>日時</TableCell>
                            <TableCell align='center'>定員</TableCell>
                            <TableCell align='center'>申し込み数</TableCell>
                            <TableCell align='center'>PC貸出</TableCell>
                            <TableCell align='center'>状況</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {course.schedules?.map(schedule => {
                            const isFullyBooked =
                              schedule.totalBookings >= schedule.capacity;
                            const pcAvailable =
                              schedule.pcRentalSlots - schedule.pcRentals;

                            return (
                              <TableRow key={schedule.id}>
                                <TableCell>
                                  {formatDateTime(schedule.dateTime)}
                                </TableCell>
                                <TableCell align='center'>
                                  {schedule.capacity}名
                                </TableCell>
                                <TableCell align='center'>
                                  <Chip
                                    size='small'
                                    label={`${schedule.totalBookings}名`}
                                    color={isFullyBooked ? 'error' : 'success'}
                                  />
                                </TableCell>
                                <TableCell align='center'>
                                  <Chip
                                    size='small'
                                    label={`${schedule.pcRentals}/${schedule.pcRentalSlots}`}
                                    color={pcAvailable > 0 ? 'info' : 'warning'}
                                  />
                                </TableCell>
                                <TableCell align='center'>
                                  {isFullyBooked ? (
                                    <Chip
                                      size='small'
                                      label='満席'
                                      color='error'
                                    />
                                  ) : (
                                    <Chip
                                      size='small'
                                      label='受付中'
                                      color='success'
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {courses.length === 0 && (
            <Alert severity='info' sx={{ mt: 3 }}>
              講座がありません。新規講座を作成してください。
            </Alert>
          )}
        </>
      )}

      {/* 講座作成・編集ダイアログ */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>{editingCourse ? '講座編集' : '新規講座作成'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Controller
              name='title'
              control={control}
              rules={{ required: '講座名を入力してください' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label='講座名'
                  margin='normal'
                  error={!!errors.title}
                  helperText={errors.title?.message}
                />
              )}
            />

            <Box
              display='flex'
              justifyContent='space-between'
              alignItems='center'
              sx={{ mt: 3, mb: 2 }}
            >
              <Typography variant='h6'>開催スケジュール</Typography>
              <Button
                variant='outlined'
                onClick={addSchedule}
                startIcon={<Add />}
              >
                日程追加
              </Button>
            </Box>

            {fields.map((field, index) => (
              <Box
                key={field.id}
                sx={{
                  border: 1,
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  p: 2,
                  mb: 2,
                }}
              >
                <Box
                  display='flex'
                  justifyContent='space-between'
                  alignItems='center'
                  mb={2}
                >
                  <Typography variant='subtitle1'>
                    スケジュール {index + 1}
                  </Typography>
                  {fields.length > 1 && (
                    <IconButton onClick={() => remove(index)}>
                      <Delete />
                    </IconButton>
                  )}
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name={`schedules.${index}.dateTime`}
                      control={control}
                      rules={{ required: '開始日時を選択してください' }}
                      render={({ field }) => (
                        <DateTimePicker
                          {...field}
                          label='開始日時'
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!errors.schedules?.[index]?.dateTime,
                              helperText:
                                errors.schedules?.[index]?.dateTime?.message,
                            },
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name={`schedules.${index}.endTime`}
                      control={control}
                      rules={{ required: '終了日時を選択してください' }}
                      render={({ field }) => (
                        <DateTimePicker
                          {...field}
                          label='終了日時'
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!errors.schedules?.[index]?.endTime,
                              helperText:
                                errors.schedules?.[index]?.endTime?.message,
                            },
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} md={6}>
                    <Controller
                      name={`schedules.${index}.capacity`}
                      control={control}
                      rules={{
                        required: '定員を入力してください',
                        min: {
                          value: 1,
                          message: '定員は1以上で入力してください',
                        },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label='定員'
                          type='number'
                          error={!!errors.schedules?.[index]?.capacity}
                          helperText={
                            errors.schedules?.[index]?.capacity?.message
                          }
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} md={6}>
                    <Controller
                      name={`schedules.${index}.pcRentalSlots`}
                      control={control}
                      rules={{
                        required: 'PC貸出枠を入力してください',
                        min: {
                          value: 0,
                          message: 'PC貸出枠は0以上で入力してください',
                        },
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label='PC貸出枠'
                          type='number'
                          error={!!errors.schedules?.[index]?.pcRentalSlots}
                          helperText={
                            errors.schedules?.[index]?.pcRentalSlots?.message
                          }
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>キャンセル</Button>
            <Button type='submit' variant='contained' disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default AdminPanel;
