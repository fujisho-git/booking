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
  Container
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
  School
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { signOutUser } from '../utils/auth';
import Login from './Login';
import BookingDashboard from './BookingDashboard';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import { getCourses, createCourse, updateCourse, getBookingsCount } from '../utils/firestore';

const AdminPanel = () => {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      schedules: [{ 
        id: Date.now().toString(),
        dateTime: dayjs().add(1, 'day'), 
        endTime: dayjs().add(1, 'day').add(2, 'hour'),
        capacity: 10, 
        pcRentalSlots: 5 
      }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'schedules'
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const coursesData = await getCourses();
      
      // 各講座の申し込み状況を取得
      const coursesWithBookings = await Promise.all(
        coursesData.map(async (course) => {
          const scheduleBookings = await Promise.all(
            (course.schedules || []).map(async (schedule) => {
              const { totalBookings, pcRentals } = await getBookingsCount(course.id, schedule.id);
              return {
                ...schedule,
                totalBookings,
                pcRentals
              };
            })
          );
          return {
            ...course,
            schedules: scheduleBookings
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
          endTime: schedule.endTime ? dayjs(schedule.endTime.toDate()) : dayjs(schedule.dateTime.toDate()).add(2, 'hour')
        })) || [{ 
          id: Date.now().toString(),
          dateTime: dayjs().add(1, 'day'), 
          endTime: dayjs().add(1, 'day').add(2, 'hour'),
          capacity: 10, 
          pcRentalSlots: 5 
        }]
      });
    } else {
      setEditingCourse(null);
      reset({
        title: '',
        schedules: [{ 
          id: Date.now().toString(),
          dateTime: dayjs().add(1, 'day'), 
          endTime: dayjs().add(1, 'day').add(2, 'hour'),
          capacity: 10, 
          pcRentalSlots: 5 
        }]
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCourse(null);
    reset();
  };

  const onSubmit = async (data) => {
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
          pcRentalSlots: parseInt(schedule.pcRentalSlots)
        }))
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
      pcRentalSlots: 5 
    });
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const formatDateTime = (dateTime) => {
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <AppBar position="static" color="transparent" elevation={1} sx={{ mb: 3 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            管理者パネル - {currentUser.email}
          </Typography>
          <Button
            color="inherit"
            startIcon={<Logout />}
            onClick={handleLogout}
          >
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>

      <Tabs 
        value={tabValue} 
        onChange={(e, newValue) => setTabValue(newValue)} 
        sx={{ mb: 3 }}
        variant="fullWidth"
      >
        <Tab 
          icon={<Dashboard />} 
          label="申込者管理" 
          iconPosition="start"
        />
        <Tab 
          icon={<School />} 
          label="講座管理" 
          iconPosition="start"
        />
      </Tabs>

      {/* 申込者管理タブ */}
      {tabValue === 0 && <BookingDashboard />}

      {/* 講座管理タブ */}
      {tabValue === 1 && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" component="h1">
              講座管理
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
            >
              新規講座作成
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {courses.map((course) => (
              <Grid item xs={12} key={course.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Box>
                        <Typography variant="h6" component="h2">
                          {course.title}
                        </Typography>
                      </Box>
                      <IconButton onClick={() => handleOpenDialog(course)}>
                        <Edit />
                      </IconButton>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="h6" gutterBottom>
                      スケジュール・申し込み状況
                    </Typography>
                    
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>日時</TableCell>
                            <TableCell align="center">定員</TableCell>
                            <TableCell align="center">申し込み数</TableCell>
                            <TableCell align="center">PC貸出</TableCell>
                            <TableCell align="center">状況</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {course.schedules?.map((schedule) => {
                            const isFullyBooked = schedule.totalBookings >= schedule.capacity;
                            const pcAvailable = schedule.pcRentalSlots - schedule.pcRentals;
                            
                            return (
                              <TableRow key={schedule.id}>
                                <TableCell>
                                  {formatDateTime(schedule.dateTime)}
                                </TableCell>
                                <TableCell align="center">
                                  {schedule.capacity}名
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={`${schedule.totalBookings}名`}
                                    color={isFullyBooked ? 'error' : 'success'}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={`${schedule.pcRentals}/${schedule.pcRentalSlots}`}
                                    color={pcAvailable > 0 ? 'info' : 'warning'}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  {isFullyBooked ? (
                                    <Chip size="small" label="満席" color="error" />
                                  ) : (
                                    <Chip size="small" label="受付中" color="success" />
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
            <Alert severity="info" sx={{ mt: 3 }}>
              講座がありません。新規講座を作成してください。
            </Alert>
          )}
        </>
      )}

      {/* 講座作成・編集ダイアログ */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCourse ? '講座編集' : '新規講座作成'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Controller
              name="title"
              control={control}
              rules={{ required: '講座名を入力してください' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="講座名"
                  margin="normal"
                  error={!!errors.title}
                  helperText={errors.title?.message}
                />
              )}
            />

            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 3, mb: 2 }}>
              <Typography variant="h6">
                開催スケジュール
              </Typography>
              <Button variant="outlined" onClick={addSchedule} startIcon={<Add />}>
                日程追加
              </Button>
            </Box>

            {fields.map((field, index) => (
              <Box key={field.id} sx={{ border: 1, borderColor: 'grey.300', borderRadius: 1, p: 2, mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1">
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
                          label="開始日時"
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!errors.schedules?.[index]?.dateTime,
                              helperText: errors.schedules?.[index]?.dateTime?.message
                            }
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
                          label="終了日時"
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error: !!errors.schedules?.[index]?.endTime,
                              helperText: errors.schedules?.[index]?.endTime?.message
                            }
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
                        min: { value: 1, message: '定員は1以上で入力してください' }
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="定員"
                          type="number"
                          error={!!errors.schedules?.[index]?.capacity}
                          helperText={errors.schedules?.[index]?.capacity?.message}
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
                        min: { value: 0, message: 'PC貸出枠は0以上で入力してください' }
                      }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="PC貸出枠"
                          type="number"
                          error={!!errors.schedules?.[index]?.pcRentalSlots}
                          helperText={errors.schedules?.[index]?.pcRentalSlots?.message}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>
              キャンセル
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default AdminPanel; 