import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import { Login as LoginIcon, AdminPanelSettings } from '@mui/icons-material';
import { signIn } from '../utils/auth';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async data => {
    try {
      setLoading(true);
      setError('');
      await signIn(data.email, data.password);
    } catch (err) {
      let errorMessage = '認証に失敗しました';

      switch (err.code) {
        case 'auth/invalid-credential':
          errorMessage = 'メールアドレスまたはパスワードが正しくありません';
          break;
        case 'auth/user-not-found':
          errorMessage = 'ユーザーが見つかりません';
          break;
        case 'auth/wrong-password':
          errorMessage = 'パスワードが正しくありません';
          break;
        case 'auth/invalid-email':
          errorMessage = '有効なメールアドレスを入力してください';
          break;
        case 'auth/too-many-requests':
          errorMessage =
            'ログイン試行回数が多すぎます。しばらく待ってから再試行してください';
          break;
        case 'auth/user-disabled':
          errorMessage = 'このアカウントは無効化されています';
          break;
        default:
          console.log('Firebase Auth Error:', err.code, err.message);
          errorMessage = err.message || '認証に失敗しました';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth='sm'>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Box textAlign='center' mb={3}>
              <AdminPanelSettings
                sx={{ fontSize: 48, color: 'primary.main', mb: 1 }}
              />
              <Typography variant='h4' component='h1' gutterBottom>
                管理者ログイン
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                講座管理システムにアクセスするには認証が必要です
              </Typography>
            </Box>

            {error && (
              <Alert severity='error' sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <Controller
                name='email'
                control={control}
                rules={{
                  required: 'メールアドレスを入力してください',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: '有効なメールアドレスを入力してください',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label='メールアドレス'
                    type='email'
                    variant='outlined'
                    margin='normal'
                    error={!!errors.email}
                    helperText={errors.email?.message}
                  />
                )}
              />

              <Controller
                name='password'
                control={control}
                rules={{
                  required: 'パスワードを入力してください',
                  minLength: {
                    value: 6,
                    message: 'パスワードは6文字以上で入力してください',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label='パスワード'
                    type='password'
                    variant='outlined'
                    margin='normal'
                    error={!!errors.password}
                    helperText={errors.password?.message}
                  />
                )}
              />

              <Button
                type='submit'
                fullWidth
                variant='contained'
                size='large'
                disabled={loading}
                startIcon={
                  loading ? <CircularProgress size={20} /> : <LoginIcon />
                }
                sx={{ mt: 3, mb: 2 }}
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Login;
