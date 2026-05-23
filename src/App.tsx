import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Tasks from './pages/Tasks';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import CreateCompany from './pages/CreateCompany';
import CreateDepartment from './pages/CreateDepartment';
import EditTask from './pages/EditTask';
import EditDocument from './pages/EditDocument';
import Login from './pages/Login';
import Signup from './pages/Signup';
import './App.css';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <NetworkProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="docs" element={<Documents />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="approvals" element={<Approvals />} />
                <Route path="settings" element={<Settings />} />
                <Route path="create-company" element={<CreateCompany />} />
                <Route path="create-department" element={<CreateDepartment />} />
                <Route path="edit-task/:taskId" element={<EditTask />} />
                <Route path="edit-document/:docId" element={<EditDocument />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NetworkProvider>
    </AuthProvider>
  );
}

export default App;
