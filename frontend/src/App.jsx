import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { UploadProvider } from './context/UploadContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FolderDetailPage from './pages/FolderDetailPage';
import RecentPage from './pages/RecentPage';
import BucketsPage from './pages/BucketsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

function AppShell({ children }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }
  return children;
}

function AdminRoute({ children }) {
  const { loading, isManager } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }
  if (!isManager) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <AppShell>
                      <UploadProvider>
                        <AppLayout />
                      </UploadProvider>
                    </AppShell>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="folders/:id" element={<FolderDetailPage />} />
                  <Route path="recent" element={<RecentPage />} />
                  <Route path="buckets" element={<AdminRoute><BucketsPage /></AdminRoute>} />
                  <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                  <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
