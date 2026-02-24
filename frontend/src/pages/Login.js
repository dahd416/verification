import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    fetchSettings();
    checkFirstUser();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/api/settings/public`);
      setSettings(response.data);
      // Update page title and favicon if settings exist
      if (response.data.site_title) {
        document.title = response.data.site_title;
      }
      if (response.data.favicon_url) {
        const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
        link.rel = 'icon';
        link.href = response.data.favicon_url;
        document.head.appendChild(link);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const checkFirstUser = async () => {
    try {
      const response = await axios.get(`${API}/api/check-first-user`);
      setShowRegister(!response.data.has_users);
    } catch (error) {
      console.error('Failed to check first user:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      toast.success(t('auth.welcomeBack'));
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.detail || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const siteTitle = settings?.site_title || 'ORVITI Academy';

  return (
    <div className="min-h-screen glass-bg flex items-center justify-center p-4" data-testid="login-page">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-indigo-200/10 to-purple-200/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          {settings?.login_logo_url ? (
            <img 
              src={settings.login_logo_url} 
              alt={siteTitle}
              className="max-h-24 mx-auto mb-6 object-contain"
              data-testid="login-logo"
            />
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl shadow-indigo-500/30 mb-6">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                {siteTitle}
              </h1>
            </>
          )}
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {settings?.site_description || t('auth.digitalCertificates')}
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">{t('auth.signIn')}</h2>
            <p className="text-slate-500 dark:text-slate-400">{t('auth.enterCredentials')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                className="glass-input h-12"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="login-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  className="glass-input h-12 pr-12"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  data-testid="toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full btn-gradient h-12 text-base"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  {t('auth.signIn')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          {/* Only show register link if no users exist */}
          {showRegister && (
            <div className="mt-6 text-center">
              <span className="text-slate-500 dark:text-slate-400">{t('auth.noAccount')} </span>
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold transition-colors">
                {t('auth.signUp')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
