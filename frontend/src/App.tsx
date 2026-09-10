import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
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
import { ProfileRoute } from './pages/ProfileRoute';
import { BuddiesScreen } from './pages/BuddiesScreen';
import { BuddyScreen } from './pages/BuddyScreen';
import { BuddyLessonsScreen } from './pages/BuddyLessonsScreen';
import { BuddyAvailabilityScreen } from './pages/BuddyAvailabilityScreen';
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
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/credits" element={<RequireAuth><CreditsScreen /></RequireAuth>} />
            <Route path="/credits/return" element={<RequireAuth><CreditsReturn /></RequireAuth>} />
            <Route path="/book" element={<RequireAuth><BookLesson /></RequireAuth>} />
            <Route path="/lessons" element={<RequireAuth><LessonsScreen /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><NotificationsScreen /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfileRoute /></RequireAuth>} />
            <Route path="/buddies" element={<RequireAuth><BuddiesScreen /></RequireAuth>} />
            <Route path="/buddies/:id" element={<RequireAuth><BuddyScreen /></RequireAuth>} />
            <Route path="/teaching" element={<RequireAuth><BuddyLessonsScreen /></RequireAuth>} />
            <Route path="/availability" element={<RequireAuth><BuddyAvailabilityScreen /></RequireAuth>} />
            <Route path="/playground" element={<ComponentPlayground />} />
            {/* Unmatched paths fall through to /dashboard, which already does the
                right thing either way: RequireAuth sends a signed-out visitor to
                /login, a signed-in one lands on their role's dashboard. */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
