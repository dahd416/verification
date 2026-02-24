import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import {
  LayoutDashboard,
  GraduationCap,
  FileText,
  Users,
  Award,
  Scroll,
  QrCode,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  User,
  Globe,
  Sparkles,
  Settings,
  UserCog,
  Mail,
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await axios.get(`${API}/api/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSettings(response.data);
        // Update document title and favicon
        if (response.data.site_title) {
          document.title = response.data.site_title;
        }
        if (response.data.favicon_url) {
          const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
          link.rel = 'icon';
          link.href = response.data.favicon_url;
          document.head.appendChild(link);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const navItems = [
    { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/courses', label: t('nav.courses'), icon: GraduationCap },
    { path: '/templates', label: t('nav.templates'), icon: FileText },
    { path: '/recipients', label: t('nav.recipients'), icon: Users },
    { path: '/generate', label: t('nav.generate'), icon: Award },
    { path: '/diplomas', label: t('nav.diplomas'), icon: Scroll },
    { path: '/scan-logs', label: t('nav.scanLogs'), icon: QrCode },
  ];

  const adminItems = [
    { path: '/users', label: t('nav.users'), icon: UserCog },
    { path: '/email-templates', label: t('nav.emailTemplates'), icon: Mail },
    { path: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen glass-bg">
        {/* Fixed Icon Sidebar - Desktop */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-full w-20 flex-col items-center py-6 z-50 glass-sidebar">
          {/* Logo */}
          <Link to="/" className="mb-8" data-testid="sidebar-logo">
            {settings?.sidebar_logo_url ? (
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all hover:scale-105">
                <img src={settings.sidebar_logo_url} alt="Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-105">
                <Sparkles className="w-6 h-6 text-white" strokeWidth={1.5} />
              </div>
            )}
          </Link>

          {/* Navigation Items */}
          <nav className="flex-1 flex flex-col items-center gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
                      className={`sidebar-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            
            {/* Divider */}
            <div className="w-8 h-px bg-slate-200 dark:bg-slate-700 my-2" />
            
            {/* Admin Items */}
            {adminItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      data-testid={`nav-${item.path.replace('/', '')}`}
                      className={`sidebar-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="flex flex-col items-center gap-2 mt-auto">
            {/* Theme Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleTheme}
                  data-testid="theme-toggle"
                  className="sidebar-item"
                >
                  {theme === 'light' ? (
                    <Moon className="h-5 w-5" strokeWidth={1.5} />
                  ) : (
                    <Sun className="h-5 w-5" strokeWidth={1.5} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {theme === 'light' ? t('common.darkMode') : t('common.lightMode')}
              </TooltipContent>
            </Tooltip>

            {/* Language */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="sidebar-item" data-testid="language-toggle">
                      <Globe className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t('common.language')}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="end" className="glass-card border-white/40">
                <DropdownMenuItem 
                  onClick={() => changeLanguage('es')}
                  className={i18n.language === 'es' ? 'bg-indigo-50 text-indigo-600' : ''}
                >
                  Espanol
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => changeLanguage('en')}
                  className={i18n.language === 'en' ? 'bg-indigo-50 text-indigo-600' : ''}
                >
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="sidebar-item" data-testid="user-menu">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {user?.name}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="end" className="w-56 glass-card border-white/40">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-slate-200/50" />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600" data-testid="logout-btn">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('auth.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 z-50 glass-sidebar flex items-center justify-between px-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="sidebar-item"
            data-testid="mobile-menu-btn"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <Link to="/" className="flex items-center gap-2">
            {settings?.sidebar_logo_url ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden">
                <img src={settings.sidebar_logo_url} alt="Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
            )}
            <span className="font-bold text-lg text-slate-900 dark:text-white">
              {settings?.site_title?.split(' ')[0] || 'ORVITI'}
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="sidebar-item w-9 h-9">
              {theme === 'light' ? (
                <Moon className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Sun className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 glass-sidebar transform transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/20">
            <Link to="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
              {settings?.sidebar_logo_url ? (
                <div className="w-10 h-10 rounded-xl overflow-hidden">
                  <img src={settings.sidebar_logo_url} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>
              )}
              <span className="font-bold text-lg text-slate-900 dark:text-white">
                {settings?.site_title || 'ORVITI Academy'}
              </span>
            </Link>
            <button onClick={() => setMobileMenuOpen(false)} className="sidebar-item w-9 h-9">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            
            {/* Divider */}
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />
            
            {/* Admin Items */}
            {adminItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile User Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 bg-white/50 border-white/40">
                    <Globe className="mr-2 h-4 w-4" />
                    {i18n.language === 'es' ? 'ES' : 'EN'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => changeLanguage('es')}>Espanol</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage('en')}>English</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={handleLogout} className="bg-white/50 border-white/40 text-red-600 hover:text-red-700">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:pl-20 pt-16 lg:pt-0 min-h-screen">
          <div className="p-4 lg:p-8 animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
