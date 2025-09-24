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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  Category,
  Email,
  FilterList,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { signOutUser } from '../utils/auth';
import Login from './Login';
import BookingDashboard from './BookingDashboard';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import {
  getCourses,
  getCoursesByCategory,
  createCourse,
  updateCourse,
  updateCoursesWithCategory,
  getBookingsCount,
  getCancelLogs,
  getCancelStatistics,
  getUserBookingsForEmail,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  initializeDefaultCategories,
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
  const [filteredUserBookings, setFilteredUserBookings] = useState([]);
  const [loadingUserBookings, setLoadingUserBookings] = useState(false);

  // メール送信用タブのフィルター条件
  const [emailFilters, setEmailFilters] = useState({
    category: '',
    courseTitle: '',
    scheduleDateTime: '',
    companyName: '',
    fullName: '',
  });

  // 講座管理のカテゴリフィルター
  const [courseCategory, setCourseCategory] = useState('all');

  // カテゴリー管理
  const [categories, setCategories] = useState([]);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    isActive: true,
    order: 1,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
      category: '第二弾',
      isActive: true,
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
    fetchCategories();
  }, []);

  useEffect(() => {
    if (tabValue === 1) {
      fetchCourses(courseCategory);
    }
  }, [courseCategory, tabValue]);

  useEffect(() => {
    if (tabValue === 3) {
      // キャンセルログタブが選択された時
      fetchCancelLogs();
    } else if (tabValue === 4) {
      // ユーザー申し込み一覧タブが選択された時
      fetchUserBookings();
      // メール送信用タブでも講座情報が必要
      if (courses.length === 0) {
        fetchCourses('all');
      }
    }
  }, [tabValue]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    applyEmailFilters();
  }, [userBookings, emailFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCategories = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('fetchCategories: カテゴリー取得開始');
      }
      const categoriesData = await getCategories();
      if (process.env.NODE_ENV === 'development') {
        console.log('fetchCategories: 取得したカテゴリー:', categoriesData);
      }
      setCategories(categoriesData);
    } catch (error) {
      console.error('カテゴリーの取得に失敗しました:', error);
      // エラー時はデフォルトカテゴリーを設定
      setCategories([
        { id: 'default-1', name: '第一弾', isActive: false, order: 1 },
        { id: 'default-2', name: '第二弾', isActive: true, order: 2 },
      ]);
    }
  };

  const fetchCourses = async (category = 'all') => {
    try {
      setLoading(true);
      const coursesData =
        category === 'all'
          ? await getCourses()
          : await getCoursesByCategory(category);

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
        category: course.category || '第二弾',
        isActive: course.isActive !== undefined ? course.isActive : true,
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
        category: '第二弾',
        isActive: true,
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
    reset({
      title: '',
      category: '第二弾',
      isActive: true,
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
  };

  const onSubmit = async data => {
    try {
      setSubmitting(true);
      setError(null);

      const courseData = {
        title: data.title.trim(),
        category: data.category,
        isActive: data.isActive,
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

      await fetchCourses(courseCategory);
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

  // 既存講座にカテゴリを一括設定
  const handleUpdateCategories = async () => {
    try {
      setLoading(true);
      const updatedCount = await updateCoursesWithCategory();
      if (updatedCount > 0) {
        alert(`${updatedCount}件の講座にカテゴリを設定しました。`);
        // 講座データを再取得
        await fetchCourses(courseCategory);
      } else {
        alert('すべての講座にカテゴリが設定済みです。');
      }
    } catch (error) {
      console.error('カテゴリ設定エラー:', error);
      setError('カテゴリの設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // カテゴリー管理関数
  const handleCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        isActive: category.isActive !== false,
        order: category.order || 1,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        description: '',
        isActive: true,
        order: categories.length + 1,
      });
    }
    setCategoryDialog(true);
  };

  const handleCategorySubmit = async e => {
    e.preventDefault();
    try {
      setSubmitting(true);

      // デバッグ用ログ
      if (process.env.NODE_ENV === 'development') {
        console.log('カテゴリーフォームデータ:', categoryForm);
        console.log('編集中のカテゴリー:', editingCategory);
      }

      if (editingCategory) {
        // デフォルトカテゴリー（default-1, default-2）の場合は新規作成として扱う
        if (editingCategory.id.startsWith('default-')) {
          console.log(
            'デフォルトカテゴリーを実際のカテゴリーとして新規作成:',
            editingCategory.id,
            categoryForm
          );
          await createCategory(categoryForm);
        } else {
          console.log('カテゴリー更新:', editingCategory.id, categoryForm);
          await updateCategory(editingCategory.id, categoryForm);
        }
      } else {
        console.log('カテゴリー新規作成:', categoryForm);
        await createCategory(categoryForm);
      }

      await fetchCategories();
      setCategoryDialog(false);
      setEditingCategory(null);
      // フォームをリセット
      setCategoryForm({
        name: '',
        description: '',
        isActive: true,
        order: 1,
      });
    } catch (error) {
      console.error('カテゴリー操作エラー:', error);
      setError('カテゴリーの保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryDelete = async categoryId => {
    // デフォルトカテゴリーは削除できない
    if (categoryId.startsWith('default-')) {
      setError(
        'デフォルトカテゴリーは削除できません。編集して実際のカテゴリーとして保存してください。'
      );
      return;
    }

    if (
      !window.confirm(
        'このカテゴリーを削除しますか？\n※使用中の講座がある場合は削除できません。'
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await deleteCategory(categoryId);
      await fetchCategories();
    } catch (error) {
      console.error('カテゴリー削除エラー:', error);
      setError(error.message || 'カテゴリーの削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeCategories = async () => {
    const result = window.confirm(
      '初期カテゴリーデータを作成しますか？\n\n「OK」: 既存データがない場合のみ作成\n「キャンセル」後にShiftキーを押しながらクリック: 強制的に作成'
    );
    if (!result) {
      return;
    }

    // Shiftキーが押されている場合は強制モード
    const force = window.event && window.event.shiftKey;

    try {
      setLoading(true);
      console.log('handleInitializeCategories: 初期化開始 (force:', force, ')');
      await initializeDefaultCategories(force);
      console.log('handleInitializeCategories: 初期化完了、カテゴリー再取得');
      await fetchCategories();
      setError(null);
      console.log('handleInitializeCategories: 処理完了');
    } catch (error) {
      console.error('初期カテゴリー作成エラー:', error);
      setError('初期カテゴリーの作成に失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = dateTime => {
    if (dateTime?.toDate) {
      return dayjs(dateTime.toDate()).format('YYYY/MM/DD HH:mm');
    }
    return dayjs(dateTime).format('YYYY/MM/DD HH:mm');
  };

  // メール送信用タブのフィルタリング機能
  const applyEmailFilters = () => {
    let filtered = [...userBookings];

    // デバッグログ
    if (process.env.NODE_ENV === 'development') {
      console.log('利用可能なカテゴリ:', getAvailableCategories());
      console.log('申込データサンプル:', userBookings[0]?.bookings[0]);
      if (emailFilters.category) {
        console.log('カテゴリフィルター実行:', emailFilters.category);
      }
    }

    // カテゴリでフィルター
    if (emailFilters.category) {
      filtered = filtered.filter(user =>
        user.bookings.some(booking => {
          // 申込データに含まれるカテゴリ情報を直接使用
          let category = booking.courseCategory;

          // フォールバック: categoryフィールドがない場合は講座から取得
          if (!category) {
            const course = courses.find(c => c.title === booking.courseTitle);
            category = course?.category;
          }

          const matches = category === emailFilters.category;

          if (process.env.NODE_ENV === 'development') {
            console.log(
              `講座「${booking.courseTitle}」: カテゴリ=${category}, マッチ=${matches}`
            );
          }

          return matches;
        })
      );
    }

    // 講座でフィルター
    if (emailFilters.courseTitle) {
      filtered = filtered.filter(user =>
        user.bookings.some(booking =>
          booking.courseTitle
            .toLowerCase()
            .includes(emailFilters.courseTitle.toLowerCase())
        )
      );
    }

    // 開催日時でフィルター
    if (emailFilters.scheduleDateTime) {
      filtered = filtered.filter(user =>
        user.bookings.some(booking => {
          const bookingDateTime = dayjs(
            booking.scheduleDateTime.toDate()
          ).format('YYYY/MM/DD HH:mm');
          return bookingDateTime.includes(emailFilters.scheduleDateTime);
        })
      );
    }

    // 会社名でフィルター
    if (emailFilters.companyName) {
      filtered = filtered.filter(user =>
        user.companyName
          .toLowerCase()
          .includes(emailFilters.companyName.toLowerCase())
      );
    }

    // 氏名でフィルター
    if (emailFilters.fullName) {
      filtered = filtered.filter(user =>
        user.fullName
          .toLowerCase()
          .includes(emailFilters.fullName.toLowerCase())
      );
    }

    setFilteredUserBookings(filtered);
  };

  const handleEmailFilterChange = (field, value) => {
    setEmailFilters(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearEmailFilters = () => {
    setEmailFilters({
      category: '',
      courseTitle: '',
      scheduleDateTime: '',
      companyName: '',
      fullName: '',
    });
  };

  // 利用可能な講座タイトルを取得
  const getAvailableCourseTitles = () => {
    const courseTitles = new Set();
    userBookings.forEach(user => {
      user.bookings.forEach(booking => {
        courseTitles.add(booking.courseTitle);
      });
    });
    return Array.from(courseTitles).sort();
  };

  // 利用可能なカテゴリを取得（メール送信用）
  const getAvailableCategories = () => {
    const categories = new Set();
    // 申込データから直接カテゴリを取得
    userBookings.forEach(user => {
      user.bookings.forEach(booking => {
        if (booking.courseCategory) {
          categories.add(booking.courseCategory);
        } else {
          // 既存データでcategoryフィールドがない場合のフォールバック
          // 講座タイトルから講座を検索してカテゴリを取得
          const course = courses.find(c => c.title === booking.courseTitle);
          if (course?.category) {
            categories.add(course.category);
          }
        }
      });
    });
    return Array.from(categories).sort();
  };

  // 利用可能な開催日時を取得
  const getAvailableScheduleTimes = () => {
    const scheduleTimes = new Set();
    userBookings.forEach(user => {
      user.bookings.forEach(booking => {
        const dateTime = dayjs(booking.scheduleDateTime.toDate()).format(
          'YYYY/MM/DD HH:mm'
        );
        scheduleTimes.add(dateTime);
      });
    });
    return Array.from(scheduleTimes).sort();
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
        <Tab icon={<Category />} label='カテゴリー管理' iconPosition='start' />
        <Tab icon={<Cancel />} label='キャンセルログ' iconPosition='start' />
        <Tab icon={<Email />} label='メール送信用' iconPosition='start' />
      </Tabs>

      {/* 申込者管理タブ */}
      {tabValue === 0 && <BookingDashboard />}

      {/* カテゴリー管理タブ */}
      {tabValue === 2 && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Typography variant='h5'>カテゴリー管理</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant='outlined'
                onClick={handleInitializeCategories}
                disabled={loading}
              >
                初期データ作成
              </Button>
              <Button
                variant='contained'
                startIcon={<Add />}
                onClick={() => handleCategoryDialog()}
              >
                新規カテゴリー作成
              </Button>
            </Box>
          </Box>

          <TableContainer component={Paper} variant='outlined'>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>カテゴリー名</TableCell>
                  <TableCell>説明</TableCell>
                  <TableCell>表示順</TableCell>
                  <TableCell>状態</TableCell>
                  <TableCell align='center'>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map(category => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <Typography variant='body1' sx={{ fontWeight: 'bold' }}>
                        {category.name}
                        {category.id.startsWith('default-') && (
                          <Chip
                            size='small'
                            label='仮データ'
                            color='warning'
                            variant='outlined'
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {category.description ||
                          (category.id.startsWith('default-')
                            ? '編集して実際のカテゴリーとして保存してください'
                            : '-')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>{category.order}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size='small'
                        label={
                          category.isActive !== false
                            ? 'アクティブ'
                            : '非アクティブ'
                        }
                        color={
                          category.isActive !== false ? 'success' : 'default'
                        }
                        variant='outlined'
                      />
                    </TableCell>
                    <TableCell align='center'>
                      <IconButton
                        size='small'
                        onClick={() => handleCategoryDialog(category)}
                        color='primary'
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size='small'
                        onClick={() => handleCategoryDelete(category.id)}
                        color='error'
                        disabled={category.id.startsWith('default-')}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* キャンセルログタブ */}
      {tabValue === 3 && (
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
      {tabValue === 4 && (
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

          {/* フィルター */}
          {userBookings.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box display='flex' alignItems='center' mb={2}>
                  <FilterList sx={{ mr: 1 }} />
                  <Typography variant='h6'>フィルター</Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth size='small'>
                      <InputLabel>カテゴリ</InputLabel>
                      <Select
                        value={emailFilters.category}
                        onChange={e =>
                          handleEmailFilterChange('category', e.target.value)
                        }
                        label='カテゴリ'
                      >
                        <MenuItem value=''>すべて</MenuItem>
                        {getAvailableCategories().map(category => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size='small'>
                      <InputLabel>講座</InputLabel>
                      <Select
                        value={emailFilters.courseTitle}
                        onChange={e =>
                          handleEmailFilterChange('courseTitle', e.target.value)
                        }
                        label='講座'
                      >
                        <MenuItem value=''>すべて</MenuItem>
                        {getAvailableCourseTitles().map(title => (
                          <MenuItem key={title} value={title}>
                            {title}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size='small'>
                      <InputLabel>開催日時</InputLabel>
                      <Select
                        value={emailFilters.scheduleDateTime}
                        onChange={e =>
                          handleEmailFilterChange(
                            'scheduleDateTime',
                            e.target.value
                          )
                        }
                        label='開催日時'
                      >
                        <MenuItem value=''>すべて</MenuItem>
                        {getAvailableScheduleTimes().map(dateTime => (
                          <MenuItem key={dateTime} value={dateTime}>
                            {dateTime}
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
                      value={emailFilters.companyName}
                      onChange={e =>
                        handleEmailFilterChange('companyName', e.target.value)
                      }
                    />
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      size='small'
                      label='氏名'
                      value={emailFilters.fullName}
                      onChange={e =>
                        handleEmailFilterChange('fullName', e.target.value)
                      }
                    />
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <Button
                      size='small'
                      onClick={clearEmailFilters}
                      sx={{ height: '40px' }}
                    >
                      クリア
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {userBookings.length === 0 && !loadingUserBookings ? (
            <Alert severity='info'>申し込み者がいません。</Alert>
          ) : filteredUserBookings.length === 0 && userBookings.length > 0 ? (
            <Alert severity='info'>
              フィルター条件に一致する申し込み者がいません。
            </Alert>
          ) : (
            <>
              <Typography variant='h6' sx={{ mb: 2 }}>
                表示件数: {filteredUserBookings.length}件 / 全
                {userBookings.length}件
              </Typography>
              <Grid container spacing={3}>
                {filteredUserBookings.map((user, index) => (
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
                          {`${user.companyName} ${user.fullName} 様
メールアドレス: ${user.email}

参加予定研修:
${user.bookings
  .map(booking => {
    const startTime = dayjs(booking.scheduleDateTime.toDate()).format(
      'YYYY年MM月DD日(ddd) HH:mm'
    );
    const endTime = booking.scheduleEndTime
      ? dayjs(booking.scheduleEndTime.toDate()).format('HH:mm')
      : '';
    const timeRange = endTime ? `${startTime}～${endTime}` : startTime;

    return `■ ${booking.courseTitle}
  日時: ${timeRange}`;
  })
  .join('\n')}`}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
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
            <Box display='flex' gap={2} alignItems='center'>
              <FormControl size='small' sx={{ minWidth: 150 }}>
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={courseCategory}
                  onChange={e => setCourseCategory(e.target.value)}
                  label='カテゴリ'
                >
                  <MenuItem value='all'>すべて</MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category.id} value={category.name}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant='outlined'
                size='small'
                onClick={handleUpdateCategories}
                disabled={loading}
              >
                カテゴリ設定
              </Button>
              <Button
                variant='contained'
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
              >
                新規講座作成
              </Button>
            </Box>
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
                        <Box display='flex' alignItems='center' gap={1} mb={1}>
                          <Typography variant='h6' component='h2'>
                            {course.title}
                          </Typography>
                          <Chip
                            size='small'
                            label={course.category || '未分類'}
                            color={
                              course.category === '第二弾'
                                ? 'primary'
                                : 'default'
                            }
                          />
                          <Chip
                            size='small'
                            label={course.isActive ? '公開中' : '非公開'}
                            color={course.isActive ? 'success' : 'warning'}
                          />
                        </Box>
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

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Controller
                  name='category'
                  control={control}
                  rules={{ required: 'カテゴリを選択してください' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.category}>
                      <InputLabel>カテゴリ</InputLabel>
                      <Select {...field} label='カテゴリ'>
                        {categories.map(category => (
                          <MenuItem key={category.id} value={category.name}>
                            {category.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.category && (
                        <Typography
                          variant='caption'
                          color='error'
                          sx={{ mt: 1 }}
                        >
                          {errors.category.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name='isActive'
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>表示状態</InputLabel>
                      <Select {...field} label='表示状態'>
                        <MenuItem value={true}>申込者に表示</MenuItem>
                        <MenuItem value={false}>管理者のみ表示</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>

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

      {/* カテゴリー管理ダイアログ */}
      <Dialog
        open={categoryDialog}
        onClose={() => setCategoryDialog(false)}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>
          {editingCategory ? 'カテゴリー編集' : '新規カテゴリー作成'}
        </DialogTitle>
        <form onSubmit={handleCategorySubmit}>
          <DialogContent>
            <TextField
              fullWidth
              label='カテゴリー名'
              value={categoryForm.name}
              onChange={e =>
                setCategoryForm({ ...categoryForm, name: e.target.value })
              }
              margin='normal'
              required
            />
            <TextField
              fullWidth
              label='説明'
              value={categoryForm.description}
              onChange={e => {
                const newForm = {
                  ...categoryForm,
                  description: e.target.value,
                };
                if (process.env.NODE_ENV === 'development') {
                  console.log('説明フィールド変更:', e.target.value);
                  console.log('新しいフォーム状態:', newForm);
                }
                setCategoryForm(newForm);
              }}
              margin='normal'
              multiline
              rows={2}
            />
            <TextField
              fullWidth
              label='表示順'
              type='number'
              value={categoryForm.order}
              onChange={e =>
                setCategoryForm({
                  ...categoryForm,
                  order: parseInt(e.target.value) || 1,
                })
              }
              margin='normal'
              required
            />
            <FormControl fullWidth margin='normal'>
              <InputLabel>状態</InputLabel>
              <Select
                value={categoryForm.isActive}
                onChange={e =>
                  setCategoryForm({ ...categoryForm, isActive: e.target.value })
                }
                label='状態'
              >
                <MenuItem value={true}>アクティブ</MenuItem>
                <MenuItem value={false}>非アクティブ</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCategoryDialog(false);
                setEditingCategory(null);
                setCategoryForm({
                  name: '',
                  description: '',
                  isActive: true,
                  order: 1,
                });
              }}
            >
              キャンセル
            </Button>
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
