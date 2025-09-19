import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  TextField,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Paper,
} from '@mui/material';
import {
  Person,
  Business,
  Computer,
  EventAvailable,
  ArrowBack,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import {
  getCourse,
  createBooking,
  getBookingsCount,
  checkUserBookingExistsBySchedule,
} from '../utils/firestore';

const BookingForm = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [bookingCounts, setBookingCounts] = useState({});
  const [alreadyBookedSchedules, setAlreadyBookedSchedules] = useState(
    new Set()
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    defaultValues: {
      companyName: '',
      fullName: '',
      needsPcRental: 'false',
      scheduleId: '',
    },
  });

  const watchedCompanyName = watch('companyName');
  const watchedFullName = watch('fullName');

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  useEffect(() => {
    // ローカルストレージからユーザー情報を復元
    const savedUserInfo = localStorage.getItem('userInfo');
    if (savedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(savedUserInfo);
        reset({
          companyName: parsedUserInfo.companyName || '',
          fullName: parsedUserInfo.fullName || '',
          needsPcRental: 'false',
          scheduleId: '',
        });
      } catch (error) {
        console.error('ユーザー情報の復元エラー:', error);
      }
    }
  }, [reset]);

  useEffect(() => {
    // ユーザー情報が入力された際に申し込み済みスケジュールをチェック
    const checkBookingStatus = async () => {
      if (watchedCompanyName && watchedFullName && course) {
        const bookedSchedules = new Set();

        // 各スケジュールに対して申し込み済みかチェック
        for (const schedule of course.schedules || []) {
          const hasBooking = await checkUserBookingExistsBySchedule(
            course.id,
            schedule.id,
            watchedCompanyName,
            watchedFullName
          );
          if (hasBooking) {
            bookedSchedules.add(schedule.id);
          }
        }

        console.log(
          `講座「${course.title}」での申し込み確認:`,
          `${bookedSchedules.size}/${course.schedules?.length || 0} スケジュールに申し込み済み`
        );
        setAlreadyBookedSchedules(bookedSchedules);
      } else {
        setAlreadyBookedSchedules(new Set());
      }
    };

    checkBookingStatus();
  }, [watchedCompanyName, watchedFullName, course]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const courseData = await getCourse(courseId);
      setCourse(courseData);

      // 各スケジュールの申し込み状況を取得
      const counts = {};
      for (const schedule of courseData.schedules || []) {
        const { totalBookings, pcRentals } = await getBookingsCount(
          courseId,
          schedule.id
        );
        counts[schedule.id] = { totalBookings, pcRentals };
      }
      setBookingCounts(counts);
    } catch (err) {
      setError('講座情報の取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityStatus = schedule => {
    const counts = bookingCounts[schedule.id] || {
      totalBookings: 0,
      pcRentals: 0,
    };
    const isFullyBooked = counts.totalBookings >= schedule.capacity;
    const pcSlotsAvailable = schedule.pcRentalSlots - counts.pcRentals;

    return {
      isFullyBooked,
      remainingSlots: schedule.capacity - counts.totalBookings,
      pcSlotsAvailable,
      totalBookings: counts.totalBookings,
    };
  };

  const onSubmit = async data => {
    try {
      setSubmitting(true);
      setError(null);

      const selectedScheduleData = course.schedules.find(
        s => s.id === data.scheduleId
      );

      const bookingData = {
        courseId,
        scheduleId: data.scheduleId,
        companyName: data.companyName.trim(),
        fullName: data.fullName.trim(),
        needsPcRental: data.needsPcRental === 'true',
        courseTitle: course.title,
        scheduleDateTime: selectedScheduleData.dateTime,
      };

      await createBooking(bookingData);

      // ユーザー情報をローカルストレージに保存
      localStorage.setItem(
        'userInfo',
        JSON.stringify({
          companyName: data.companyName.trim(),
          fullName: data.fullName.trim(),
        })
      );

      // 申し込み状況を最新に更新
      const counts = {};
      for (const schedule of course.schedules || []) {
        const { totalBookings, pcRentals } = await getBookingsCount(
          courseId,
          schedule.id
        );
        counts[schedule.id] = { totalBookings, pcRentals };
      }
      setBookingCounts(counts);

      setSuccess(true);
      reset();

      // 3秒後にトップページに移動する
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      // トランザクション処理からのエラーメッセージをそのまま表示
      setError(
        err.message || '申し込みの送信に失敗しました。もう一度お試しください。'
      );
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = dateTime => {
    return dayjs(dateTime.toDate()).format('YYYY年MM月DD日(ddd)');
  };

  const formatTimeRange = (startTime, endTime) => {
    const start = dayjs(startTime.toDate()).format('HH:mm');
    const end = endTime ? dayjs(endTime.toDate()).format('HH:mm') : '';
    return end ? `${start}～${end}` : `${start}～`;
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

  if (!course) {
    return <Alert severity='error'>講座が見つかりません</Alert>;
  }

  if (success) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity='success' sx={{ mb: 3 }}>
          申し込みが完了しました！
        </Alert>
        <Typography variant='h6' gutterBottom>
          {course.title}
        </Typography>
        <Typography variant='body1'>
          申し込みありがとうございました。
          <br />
          3秒後にトップページに移動します...
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
      >
        講座一覧に戻る
      </Button>

      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography
          variant='h2'
          component='h2'
          sx={{
            fontWeight: 'bold',
            color: 'primary.main',
            fontSize: { xs: '2.5rem', md: '3.5rem' },
            mb: 2,
          }}
        >
          {course.title}
        </Typography>
      </Box>

      <Grid container spacing={3} justifyContent='center'>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)}>
                {/* 日時選択 */}
                <FormControl component='fieldset' fullWidth sx={{ mb: 3 }}>
                  <FormLabel component='legend'>
                    <EventAvailable sx={{ fontSize: 20, mr: 1 }} />
                    希望日時を選択してください
                  </FormLabel>
                  <Controller
                    name='scheduleId'
                    control={control}
                    rules={{ required: '日時を選択してください' }}
                    render={({ field }) => (
                      <RadioGroup {...field} onChange={field.onChange}>
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          {course.schedules?.map(schedule => {
                            const availability =
                              getAvailabilityStatus(schedule);
                            const isNearCapacity =
                              availability.remainingSlots <= 3 &&
                              availability.remainingSlots > 0;

                            return (
                              <Grid
                                item
                                xs={12}
                                sm={6}
                                md={4}
                                key={schedule.id}
                              >
                                <Card
                                  sx={{
                                    border: 2,
                                    borderColor:
                                      field.value === schedule.id
                                        ? 'primary.main'
                                        : 'grey.300',
                                    bgcolor:
                                      field.value === schedule.id
                                        ? 'primary.50'
                                        : 'transparent',
                                    cursor:
                                      availability.isFullyBooked ||
                                      alreadyBookedSchedules.has(schedule.id)
                                        ? 'not-allowed'
                                        : 'pointer',
                                    opacity:
                                      availability.isFullyBooked ||
                                      alreadyBookedSchedules.has(schedule.id)
                                        ? 0.6
                                        : 1,
                                    transition: 'all 0.2s ease-in-out',
                                    position: 'relative',
                                    '&:hover':
                                      availability.isFullyBooked ||
                                      alreadyBookedSchedules.has(schedule.id)
                                        ? {}
                                        : {
                                            borderColor: 'primary.light',
                                            transform: 'translateY(-2px)',
                                            boxShadow: 2,
                                          },
                                  }}
                                  onClick={() => {
                                    if (
                                      !availability.isFullyBooked &&
                                      !alreadyBookedSchedules.has(schedule.id)
                                    ) {
                                      field.onChange(schedule.id);
                                    }
                                  }}
                                >
                                  <CardContent sx={{ p: 2 }}>
                                    <FormControlLabel
                                      value={schedule.id}
                                      control={
                                        <Radio
                                          disabled={
                                            availability.isFullyBooked ||
                                            alreadyBookedSchedules.has(
                                              schedule.id
                                            )
                                          }
                                          checked={field.value === schedule.id}
                                          sx={{
                                            position: 'absolute',
                                            top: 8,
                                            right: 8,
                                            zIndex: 1,
                                          }}
                                        />
                                      }
                                      label={
                                        <Box sx={{ width: '100%', pr: 5 }}>
                                          <Typography
                                            variant='body1'
                                            sx={{ fontWeight: 'bold', mb: 1 }}
                                          >
                                            {formatDateTime(schedule.dateTime)}
                                          </Typography>
                                          <Typography
                                            variant='body2'
                                            sx={{
                                              color: 'text.secondary',
                                              mb: 2,
                                            }}
                                          >
                                            {formatTimeRange(
                                              schedule.dateTime,
                                              schedule.endTime
                                            )}
                                          </Typography>
                                          <Box
                                            display='flex'
                                            gap={1}
                                            flexWrap='wrap'
                                          >
                                            <Chip
                                              size='small'
                                              label={`${availability.totalBookings}/${schedule.capacity}名`}
                                              color={
                                                availability.isFullyBooked
                                                  ? 'error'
                                                  : 'success'
                                              }
                                              variant='outlined'
                                            />
                                            <Chip
                                              size='small'
                                              label={`PC貸出: ${availability.pcSlotsAvailable}台`}
                                              color={
                                                availability.pcSlotsAvailable >
                                                0
                                                  ? 'info'
                                                  : 'warning'
                                              }
                                              variant='outlined'
                                            />
                                            {availability.isFullyBooked && (
                                              <Chip
                                                size='small'
                                                label='満席'
                                                color='error'
                                                variant='outlined'
                                              />
                                            )}
                                            {alreadyBookedSchedules.has(
                                              schedule.id
                                            ) && (
                                              <Chip
                                                size='small'
                                                label='申込済み'
                                                color='success'
                                                variant='outlined'
                                              />
                                            )}
                                            {isNearCapacity && (
                                              <Chip
                                                size='small'
                                                label='残りわずか'
                                                color='warning'
                                                variant='outlined'
                                              />
                                            )}
                                          </Box>
                                        </Box>
                                      }
                                      sx={{ m: 0, width: '100%' }}
                                    />
                                  </CardContent>
                                </Card>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </RadioGroup>
                    )}
                  />
                  {errors.scheduleId && (
                    <Alert severity='error' sx={{ mt: 1 }}>
                      {errors.scheduleId.message}
                    </Alert>
                  )}
                </FormControl>

                {/* 会社名 */}
                <Controller
                  name='companyName'
                  control={control}
                  rules={{ required: '会社名を入力してください' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label='会社名'
                      variant='outlined'
                      margin='normal'
                      error={!!errors.companyName}
                      helperText={errors.companyName?.message}
                      InputProps={{
                        startAdornment: (
                          <Business sx={{ color: 'action.active', mr: 1 }} />
                        ),
                      }}
                    />
                  )}
                />

                {/* 名前 */}
                <Controller
                  name='fullName'
                  control={control}
                  rules={{ required: 'お名前を入力してください' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label='お名前（フルネーム）'
                      variant='outlined'
                      margin='normal'
                      error={!!errors.fullName}
                      helperText={errors.fullName?.message}
                      InputProps={{
                        startAdornment: (
                          <Person sx={{ color: 'action.active', mr: 1 }} />
                        ),
                      }}
                    />
                  )}
                />

                {/* PC貸出 */}
                <FormControl
                  component='fieldset'
                  fullWidth
                  sx={{ mt: 3, mb: 2 }}
                >
                  <FormLabel component='legend'>
                    <Computer sx={{ fontSize: 20, mr: 1 }} />
                    PC持参について
                  </FormLabel>
                  <Controller
                    name='needsPcRental'
                    control={control}
                    render={({ field }) => (
                      <RadioGroup {...field} row>
                        <FormControlLabel
                          value='false'
                          control={<Radio />}
                          label='PC持参'
                        />
                        <FormControlLabel
                          value='true'
                          control={<Radio />}
                          label='PC貸出希望'
                        />
                      </RadioGroup>
                    )}
                  />
                </FormControl>

                {error && (
                  <Alert severity='error' sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                <Button
                  type='submit'
                  variant='contained'
                  color='primary'
                  size='large'
                  fullWidth
                  disabled={submitting}
                  startIcon={
                    submitting ? (
                      <CircularProgress size={20} />
                    ) : (
                      <EventAvailable />
                    )
                  }
                  sx={{
                    mt: 'auto',
                    py: { xs: 1.5, md: 2 },
                    fontSize: { xs: '1.1rem', md: '1.25rem' },
                    fontWeight: 'bold',
                  }}
                  className='notranslate'
                  translate='no'
                >
                  {submitting ? '申し込み中...' : '申し込む'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BookingForm;
