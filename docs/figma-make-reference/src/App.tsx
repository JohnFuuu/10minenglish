import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthScreen from './screens/AuthScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import DashboardScreen from './screens/DashboardScreen'
import BuddiesScreen from './screens/BuddiesScreen'
import BookingScreen from './screens/BookingScreen'
import LessonsScreen from './screens/LessonsScreen'
import NotificationsScreen from './screens/NotificationsScreen'
import ProfileScreen from './screens/ProfileScreen'
import CreditsScreen from './screens/CreditsScreen'
import BuddyDashboard from './screens/BuddyDashboard'
import AdminPanel from './screens/AdminPanel'

export default function App() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', position: 'relative' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/buddies" element={<BuddiesScreen />} />
          <Route path="/book/:buddyId" element={<BookingScreen />} />
          <Route path="/lessons" element={<LessonsScreen />} />
          <Route path="/notifications" element={<NotificationsScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/credits" element={<CreditsScreen />} />
          <Route path="/buddy-dashboard" element={<BuddyDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}
