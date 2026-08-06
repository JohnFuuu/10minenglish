import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { LoginStub } from './pages/LoginStub';
import { ComponentPlayground } from './pages/ComponentPlayground';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginStub />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/playground" element={<ComponentPlayground />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
