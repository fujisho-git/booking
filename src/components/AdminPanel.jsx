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
  Toolbar
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
  Logout
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { signOutUser } from '../utils/auth';
import Login from './Login';
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

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      schedules: [{ 
        id: Date.now().toString(),
        dateTime: dayjs().add(1, 'day'), 
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
        description: course.description,
        schedules: course.schedules?.map(schedule => ({
          ...schedule,
          dateTime: dayjs(schedule.dateTime.toDate())
        })) || [{ 
          id: Date.now().toString(),
          dateTime: dayjs().add(1, 'day'), 
          capacity: 10, 
          pcRentalSlots: 5 
        }]
      });
    } else {
      setEditingCourse(null);
      reset({
        title: '',
        description: '',
        schedules: [{ 
          id: Date.now().toString(),
          dateTime: dayjs().add(1, 'day'), 
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
        description: data.description.trim(),
        schedules: data.schedules.map(schedule => ({
          id: schedule.id || Date.now().toString() + Math.random(),
          dateTime: schedule.dateTime.toDate(),
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <Box>
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
                    <Typography color="text.secondary" gutterBottom>
                      {course.description}
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

            <Controller
              name="description"
              control={control}
              rules={{ required: '説明を入力してください' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="講座説明"
                  margin="normal"
                  multiline
                  rows={3}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              )}
            />

            <Box mt={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">開催スケジュール</Typography>
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
                        rules={{ required: '日時を選択してください' }}
                        render={({ field }) => (
                          <DateTimePicker
                            {...field}
                            label="開催日時"
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
                    <Grid item xs={6} md={3}>
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
                    <Grid item xs={6} md={3}>
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
            </Box>
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
    </Box>
  );
};

export default AdminPanel; 