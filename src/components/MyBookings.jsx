import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  IconButton,
  Tooltip,
  FormHelperText
} from '@mui/material';
import {
  Person,
  Business,
  EventAvailable,
  Schedule,
  Search,
  ExpandMore,
  CalendarToday,
  Computer,
  People,
  CheckCircle,
  EventNote,
  Cancel,
  Warning
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { 
  getAllBookings, 
  getCourses,
  getBookingsCount,
  cancelBooking,
  getUserBookings,
  searchBookingsByPartialMatch,
  testFirestoreConnection
} from '../utils/firestore';

const MyBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState({
    companyName: '',
    fullName: ''
  });
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [otherSchedules, setOtherSchedules] = useState([]);
  const [bookingCounts, setBookingCounts] = useState({});
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  
  // 部分検索用の状態
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    // ローカルストレージからユーザー情報を復元
    const savedUserInfo = localStorage.getItem('userInfo');
    if (savedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(savedUserInfo);
        setUserInfo({
          companyName: parsedUserInfo.companyName || '',
          fullName: parsedUserInfo.fullName || ''
        });
      } catch (error) {
        console.error('ユーザー情報の復元エラー:', error);
      }
    }
  }, []);

  useEffect(() => {
    initializeComponent();
  }, []);

  const initializeComponent = async () => {
    try {
      // まずFirestore接続をテスト
      const connectionTest = await testFirestoreConnection();
      if (!connectionTest.success) {
        setError(`データベース接続エラー: ${connectionTest.message}`);
        return;
      }
      
      await fetchAllCourses();
    } catch (err) {
      console.error('初期化エラー:', err);
      setError('アプリケーションの初期化に失敗しました。ページを再読み込みしてください。');
    }
  };

  const fetchAllCourses = async () => {
    try {
      const courses = await getCourses();
      setAllCourses(courses);
      
      // 各スケジュールの申し込み状況を取得
      const counts = {};
      for (const course of courses) {
        for (const schedule of course.schedules || []) {
          const { totalBookings, pcRentals } = await getBookingsCount(course.id, schedule.id);
          counts[`${course.id}-${schedule.id}`] = { totalBookings, pcRentals };
        }
      }
      setBookingCounts(counts);
    } catch (err) {
      console.error('講座情報の取得エラー:', err);
      throw err; // 上位のエラーハンドラに渡す
    }
  };

  // 部分検索を実行
  const handlePartialSearch = async () => {
    if (!userInfo.companyName.trim() && !userInfo.fullName.trim()) {
      setError('会社名またはお名前のいずれかを入力してください');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // 部分検索を実行
      const results = await searchBookingsByPartialMatch(
        userInfo.companyName.trim(),
        userInfo.fullName.trim()
      );

      setSearchResults(results);
      setShowSearchResults(true);
      setSelectedUser(null);
      setMyBookings([]);
      setOtherSchedules([]);
      setSearchPerformed(false);

    } catch (err) {
      console.error('部分検索エラーの詳細:', err);
      setError(err.message || '検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 検索結果からユーザーを選択
  const handleSelectUser = async (selectedUserData) => {
    try {
      setLoading(true);
      setError(null);
      
      // 選択されたユーザーの申し込みを取得
      const myBookingsList = await getUserBookings(
        selectedUserData.companyName,
        selectedUserData.fullName
      );

      setMyBookings(myBookingsList);
      setSelectedUser(selectedUserData);
      setShowSearchResults(false);
      
             // デバッグログ
       console.log('=== 申し込み状況確認 ===');
       console.log('ユーザー:', `${selectedUserData.companyName} ${selectedUserData.fullName}`);
       console.log('申し込み済み講座数:', myBookingsList.length);
       console.log('====================');

       const allSchedulesList = [];
       allCourses.forEach(course => {
         course.schedules?.forEach(schedule => {
           const key = `${course.id}-${schedule.id}`;
           const counts = bookingCounts[key] || { totalBookings: 0, pcRentals: 0 };
           const isFullyBooked = counts.totalBookings >= schedule.capacity;
           const remainingSlots = schedule.capacity - counts.totalBookings;
           const pcSlotsAvailable = schedule.pcRentalSlots - counts.pcRentals;
           
           // このユーザーが既に申し込んでいるかチェック
           const isAlreadyBooked = myBookingsList.some(booking => 
             booking.courseId === course.id && booking.scheduleId === schedule.id
           );

           allSchedulesList.push({
             courseId: course.id,
             courseTitle: course.title,
             courseDescription: course.description,
             schedule,
             isFullyBooked,
             remainingSlots,
             pcSlotsAvailable,
             totalBookings: counts.totalBookings,
             isAlreadyBooked
           });
         });
       });

      // 日時順でソート
      allSchedulesList.sort((a, b) => 
        dayjs(a.schedule.dateTime.toDate()).diff(dayjs(b.schedule.dateTime.toDate()))
      );

      console.log('全講座日程数:', allSchedulesList.length);
      
      setOtherSchedules(allSchedulesList);
      setSearchPerformed(true);
      
      // ユーザー情報をローカルストレージに保存
      localStorage.setItem('userInfo', JSON.stringify({
        companyName: selectedUserData.companyName,
        fullName: selectedUserData.fullName
      }));

    } catch (err) {
      console.error('検索エラーの詳細:', err);
      let errorMessage = '申し込み情報の取得に失敗しました';
      
      if (err.code === 'permission-denied') {
        errorMessage = 'データベースへのアクセス権限がありません。管理者にお問い合わせください。';
      } else if (err.code === 'unavailable') {
        errorMessage = 'サービスが一時的に利用できません。しばらく時間をおいて再度お試しください。';
      } else if (err.code === 'failed-precondition') {
        errorMessage = 'データベースの設定に問題があります。管理者にお問い合わせください。';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };



  const formatDateTime = (timestamp) => {
    return dayjs(timestamp.toDate()).format('YYYY年MM月DD日(ddd) HH:mm');
  };

  const formatDateTimeShort = (timestamp) => {
    return dayjs(timestamp.toDate()).format('MM/DD(ddd) HH:mm');
  };

  const formatTimeRange = (startTime, endTime) => {
    const start = dayjs(startTime.toDate()).format('HH:mm');
    const end = endTime ? dayjs(endTime.toDate()).format('HH:mm') : '';
    return end ? `${start}～${end}` : `${start}～`;
  };

  const getAvailabilityChip = (schedule, isFullyBooked, remainingSlots) => {
    if (isFullyBooked) {
      return <Chip label="満席" color="error" size="small" />;
    }
    if (remainingSlots <= 3) {
      return <Chip label="残りわずか" color="warning" size="small" />;
    }
    return <Chip label="申込可能" color="success" size="small" />;
  };

  const handleCancelBooking = (booking) => {
    setBookingToCancel(booking);
    setCancelReason('');
    setCancelReasonError('');
    setCancelDialogOpen(true);
  };

  const validateCancelReason = () => {
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setCancelReasonError('キャンセル理由を入力してください');
      return false;
    }
    if (trimmedReason.length < 5) {
      setCancelReasonError('キャンセル理由は5文字以上で入力してください');
      return false;
    }
    if (trimmedReason.length > 500) {
      setCancelReasonError('キャンセル理由は500文字以内で入力してください');
      return false;
    }
    setCancelReasonError('');
    return true;
  };

  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return;

    // キャンセル理由のバリデーション
    if (!validateCancelReason()) {
      return;
    }

    try {
      setCancelLoading(true);
      await cancelBooking(bookingToCancel.id, cancelReason.trim());
      
             // 申し込み状況を再取得
       if (selectedUser) {
         await handleSelectUser(selectedUser);
       }
      
      setCancelDialogOpen(false);
      setBookingToCancel(null);
      setCancelReason('');
      setCancelReasonError('');
      
      // 成功メッセージを表示
      setSuccessMessage('申し込みをキャンセルしました。別の日時に申し込むことができます。');
      setError(null);
      
      // 3秒後に成功メッセージを消す
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      
    } catch (err) {
      setError('申し込みのキャンセルに失敗しました: ' + err.message);
      console.error(err);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelClose = () => {
    setCancelDialogOpen(false);
    setBookingToCancel(null);
    setCancelReason('');
    setCancelReasonError('');
  };

  const handleCancelReasonChange = (event) => {
    setCancelReason(event.target.value);
    // リアルタイムバリデーション（エラーがある場合のみ）
    if (cancelReasonError) {
      setCancelReasonError('');
    }
  };

  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4, textAlign: 'center' }}>
        <EventNote sx={{ mr: 1, fontSize: 'inherit' }} />
        マイページ - 申し込み状況確認
      </Typography>

      {/* ユーザー情報入力 */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Search sx={{ mr: 1 }} />
            申し込み状況を確認する
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            申し込み時に入力した会社名とお名前を入力して、ご自身の申し込み状況を確認できます。
            <br />
            会社名またはお名前の一部を入力して検索でき、複数の候補から選択できます。
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="会社名"
                value={userInfo.companyName}
                onChange={(e) => setUserInfo(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="会社名の一部でも検索可能"
                InputProps={{
                  startAdornment: <Business sx={{ color: 'action.active', mr: 1 }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="お名前"
                value={userInfo.fullName}
                onChange={(e) => setUserInfo(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="お名前の一部でも検索可能"
                InputProps={{
                  startAdornment: <Person sx={{ color: 'action.active', mr: 1 }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handlePartialSearch}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <Search />}
                sx={{ height: '56px' }}
              >
                {loading ? '検索中...' : '申し込み状況を確認'}
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
              <br />
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                問題が続く場合は、ブラウザの開発者ツール（F12）のコンソールをご確認ください。
              </Typography>
            </Alert>
          )}

          {successMessage && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {successMessage}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 部分検索結果 */}
      {showSearchResults && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <Search sx={{ mr: 1, color: 'primary.main' }} />
              検索結果 ({searchResults.length}件)
            </Typography>
            
            {searchResults.length === 0 ? (
              <Alert severity="info">
                条件に一致する申し込みが見つかりませんでした。入力内容を確認して再度検索してください。
              </Alert>
            ) : (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  検索結果から該当する方を選択して、申し込み状況を確認してください。
                </Alert>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>会社名</TableCell>
                        <TableCell>お名前</TableCell>
                        <TableCell>申し込み件数</TableCell>
                        <TableCell align="center">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {searchResults.map((userData, index) => (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Typography variant="body1" fontWeight="medium">
                              {userData.companyName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body1">
                              {userData.fullName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={`${userData.bookings.length}件`} 
                              color="primary" 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleSelectUser(userData)}
                              startIcon={<CheckCircle />}
                            >
                              この方の申し込みを確認
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {searchPerformed && (
        <>
          {/* 選択されたユーザー情報 */}
          {selectedUser && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Person sx={{ mr: 1, color: 'info.main' }} />
                  選択されたユーザー
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Chip 
                    label={selectedUser.companyName} 
                    color="primary" 
                    variant="outlined" 
                  />
                  <Chip 
                    label={selectedUser.fullName} 
                    color="secondary" 
                    variant="outlined" 
                  />
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setShowSearchResults(true);
                      setSearchPerformed(false);
                      setSelectedUser(null);
                      setMyBookings([]);
                      setOtherSchedules([]);
                    }}
                  >
                    別のユーザーを検索
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* 自分の申し込み履歴 */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
                申し込み履歴 ({myBookings.length}件)
              </Typography>
              
              {myBookings.length === 0 ? (
                <Alert severity="info">
                  申し込み履歴がありません。下記の「申し込み可能な講座」から新しく申し込みを行ってください。
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>申し込み日時</TableCell>
                        <TableCell>講座名</TableCell>
                        <TableCell>開催日時</TableCell>
                        <TableCell align="center">PC貸出</TableCell>
                        <TableCell align="center">状況</TableCell>
                        <TableCell align="center">操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myBookings.map((booking) => {
                        const isUpcoming = dayjs(booking.scheduleDateTime.toDate()).isAfter(dayjs());
                        return (
                          <TableRow key={booking.id}>
                            <TableCell>
                              {dayjs(booking.createdAt.toDate()).format('YYYY/MM/DD HH:mm')}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {booking.courseTitle}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatDateTime(booking.scheduleDateTime)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={booking.needsPcRental ? 'PC貸出' : 'PC持参'}
                                color={booking.needsPcRental ? 'primary' : 'default'}
                                icon={<Computer />}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={isUpcoming ? "申込済み" : "終了"}
                                color={isUpcoming ? "success" : "default"}
                                icon={<CheckCircle />}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {isUpcoming ? (
                                <Tooltip title="申し込みをキャンセルして別の日時に申し込めます">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleCancelBooking(booking)}
                                  >
                                    <Cancel />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  -
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

                     {/* 全講座一覧 */}
           <Card>
             <CardContent>
               <Typography variant="h6" gutterBottom>
                 <CalendarToday sx={{ mr: 1, color: 'primary.main' }} />
                 全講座一覧 ({otherSchedules.length}件)
               </Typography>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                 すべての講座の一覧です。申込済みの講座は「申込済み」と表示されます。
                 <br />
                 別日に変更する場合は、一度キャンセルしてから「申し込む」ボタンから新しく申し込みを行えます。
               </Typography>

              {otherSchedules.length === 0 ? (
                <Alert severity="info">
                  現在申し込み可能な講座がありません。
                </Alert>
              ) : (
                <Box>
                  {otherSchedules.map((item, index) => (
                    <Accordion key={`${item.courseId}-${item.schedule.id}`} sx={{ mb: 1 }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              {item.courseTitle}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatDateTime(item.schedule.dateTime)}
                            </Typography>
                          </Box>
                                                     <Box display="flex" gap={1} alignItems="center">
                             {item.isAlreadyBooked ? (
                               <Chip 
                                 label="申込済み" 
                                 color="success" 
                                 size="small" 
                                 icon={<CheckCircle />}
                               />
                             ) : (
                               getAvailabilityChip(item.schedule, item.isFullyBooked, item.remainingSlots)
                             )}
                             <Chip
                               size="small"
                               label={`${item.totalBookings}/${item.schedule.capacity}名`}
                               color="primary"
                               variant="outlined"
                               icon={<People />}
                             />
                             <Chip
                               size="small"
                               label={`PC貸出: ${item.pcSlotsAvailable}台`}
                               color={item.pcSlotsAvailable > 0 ? 'info' : 'warning'}
                               variant="outlined"
                               icon={<Computer />}
                             />
                           </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={8}>
                            <Typography variant="subtitle2" gutterBottom>
                              講座内容
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                              {item.courseDescription || '講座の詳細情報はありません。'}
                            </Typography>
                            
                            <Typography variant="subtitle2" gutterBottom>
                              開催詳細
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2">
                                <strong>日時:</strong> {formatDateTime(item.schedule.dateTime)}
                              </Typography>
                              <Typography variant="body2">
                                <strong>時間:</strong> {formatTimeRange(item.schedule.dateTime, item.schedule.endTime)}
                              </Typography>
                              <Typography variant="body2">
                                <strong>定員:</strong> {item.schedule.capacity}名
                              </Typography>
                              <Typography variant="body2">
                                <strong>PC貸出枠:</strong> {item.schedule.pcRentalSlots}台
                              </Typography>
                            </Box>
                          </Grid>
                          
                          <Grid item xs={12} md={4}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography variant="subtitle2" gutterBottom>
                                  申し込み状況
                                </Typography>
                                <Typography variant="body2">
                                  参加者: {item.totalBookings}/{item.schedule.capacity}名
                                </Typography>
                                <Typography variant="body2">
                                  残り枠: {item.remainingSlots}名
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                  PC貸出可能: {item.pcSlotsAvailable}台
                                </Typography>
                                
                                                                 {item.isAlreadyBooked ? (
                                   <Box sx={{ textAlign: 'center', py: 2 }}>
                                     <Chip 
                                       label="この講座は申込済みです" 
                                       color="success" 
                                       variant="outlined"
                                       icon={<CheckCircle />}
                                     />
                                     <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                       別の日時に変更したい場合は、上記の申込履歴からキャンセルしてください
                                     </Typography>
                                   </Box>
                                 ) : (
                                   <Button
                                     fullWidth
                                     variant="contained"
                                     color="primary"
                                     disabled={item.isFullyBooked}
                                     startIcon={<EventAvailable />}
                                     onClick={() => window.location.href = `/booking/${item.courseId}`}
                                   >
                                     {item.isFullyBooked ? '満席' : '申し込む'}
                                   </Button>
                                 )}
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* キャンセル確認ダイアログ */}
      <Dialog
        open={cancelDialogOpen}
        onClose={handleCancelClose}
        aria-labelledby="cancel-dialog-title"
        aria-describedby="cancel-dialog-description"
      >
        <DialogTitle id="cancel-dialog-title" sx={{ display: 'flex', alignItems: 'center' }}>
          <Warning sx={{ mr: 1, color: 'warning.main' }} />
          申し込みをキャンセルしますか？
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="cancel-dialog-description">
            {bookingToCancel && (
              <>
                以下の申し込みをキャンセルします。この操作は取り消せません。
                <br /><br />
                <strong>講座名:</strong> {bookingToCancel.courseTitle}<br />
                <strong>開催日時:</strong> {formatDateTime(bookingToCancel.scheduleDateTime)}<br />
                <strong>PC貸出:</strong> {bookingToCancel.needsPcRental ? 'PC貸出' : 'PC持参'}
                <br /><br />
                キャンセル後、同じ講座の別の日時や他の講座に新しく申し込むことができます。
              </>
            )}
          </DialogContentText>

          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              label="キャンセル理由"
              value={cancelReason}
              onChange={handleCancelReasonChange}
              error={!!cancelReasonError}
              helperText={cancelReasonError || '5文字以上500文字以内で入力してください'}
              placeholder="キャンセルの理由を詳しくお聞かせください"
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClose} disabled={cancelLoading}>
            戻る
          </Button>
          <Button 
            onClick={handleCancelConfirm} 
            color="error" 
            variant="contained"
            disabled={cancelLoading}
            startIcon={cancelLoading ? <CircularProgress size={20} /> : <Cancel />}
          >
            {cancelLoading ? 'キャンセル中...' : 'キャンセルする'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyBookings;
