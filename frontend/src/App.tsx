import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './toast/ToastContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ConfirmEmail } from './pages/ConfirmEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Onboarding } from './pages/Onboarding';
import { CreditsScreen } from './pages/CreditsScreen';
import { CreditsReturn } from './pages/CreditsReturn';
import { BookLesson } from './pages/BookLesson';
import { LessonsScreen } from './pages/LessonsScreen';
import { NotificationsScreen } from './pages/NotificationsScreen';
import { ProfileScreen } from './pages/ProfileScreen';
import { ComponentPlayground } from './pages/ComponentPlayground';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/confirm-email" element={<ConfirmEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/credits" element={<CreditsScreen />} />
            <Route path="/credits/return" element={<CreditsReturn />} />
            <Route path="/book" element={<BookLesson />} />
            <Route path="/lessons" element={<LessonsScreen />} />
            <Route path="/notifications" element={<NotificationsScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/playground" element={<ComponentPlayground />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
