import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CourseForm from "./pages/CourseForm";
import Templates from "./pages/Templates";
import TemplateBuilder from "./pages/TemplateBuilder";
import Recipients from "./pages/Recipients";
import GenerateDiplomas from "./pages/GenerateDiplomas";
import Diplomas from "./pages/Diplomas";
import VerifyPage from "./pages/VerifyPage";
import ScanLogs from "./pages/ScanLogs";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import EmailTemplatesPage from "./pages/EmailTemplatesPage";

// Layout
import Layout from "./components/Layout";

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gold/20 rounded-full" />
          <div className="text-muted-foreground font-body">Loading...</div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify/:certificateId" element={<VerifyPage />} />
      
      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
      <Route path="/courses/new" element={<ProtectedRoute><CourseForm /></ProtectedRoute>} />
      <Route path="/courses/:id/edit" element={<ProtectedRoute><CourseForm /></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
      <Route path="/templates/new" element={<ProtectedRoute><TemplateBuilder /></ProtectedRoute>} />
      <Route path="/templates/:id/edit" element={<ProtectedRoute><TemplateBuilder /></ProtectedRoute>} />
      <Route path="/recipients" element={<ProtectedRoute><Recipients /></ProtectedRoute>} />
      <Route path="/generate" element={<ProtectedRoute><GenerateDiplomas /></ProtectedRoute>} />
      <Route path="/diplomas" element={<ProtectedRoute><Diplomas /></ProtectedRoute>} />
      <Route path="/scan-logs" element={<ProtectedRoute><ScanLogs /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/email-templates" element={<ProtectedRoute><EmailTemplatesPage /></ProtectedRoute>} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            toastOptions={{
              style: {
                fontFamily: 'Manrope, sans-serif',
              }
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
