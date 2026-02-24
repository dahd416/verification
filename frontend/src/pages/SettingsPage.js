import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Settings, Upload, Save, Loader2, Image, Globe, FileText, Mail, Eye, EyeOff, Send } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const SettingsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState({
    login_logo_url: '',
    sidebar_logo_url: '',
    favicon_url: '',
    site_title: '',
    site_description: '',
    // Email settings
    email_enabled: false,
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: '',
    smtp_from_email: '',
  });

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/api/settings`, { headers: getAuthHeader() });
      setSettings({
        login_logo_url: response.data.login_logo_url || '',
        sidebar_logo_url: response.data.sidebar_logo_url || '',
        favicon_url: response.data.favicon_url || '',
        site_title: response.data.site_title || '',
        site_description: response.data.site_description || '',
        // Email settings
        email_enabled: response.data.email_enabled || false,
        smtp_host: response.data.smtp_host || 'smtp.gmail.com',
        smtp_port: response.data.smtp_port || '587',
        smtp_user: response.data.smtp_user || '',
        smtp_password: response.data.smtp_password || '',
        smtp_from_name: response.data.smtp_from_name || '',
        smtp_from_email: response.data.smtp_from_email || '',
      });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error(t('settings.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (field, file) => {
    if (!file) return;

    setUploading({ ...uploading, [field]: true });
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/api/upload`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' }
      });
      
      const fullUrl = `${API}${response.data.url}`;
      setSettings({ ...settings, [field]: fullUrl });
      toast.success(t('settings.uploaded'));
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('settings.uploadError'));
    } finally {
      setUploading({ ...uploading, [field]: false });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/settings`, settings, { headers: getAuthHeader() });
      toast.success(t('settings.saved'));
      
      // Update page title immediately
      if (settings.site_title) {
        document.title = settings.site_title;
      }
      // Update favicon
      if (settings.favicon_url) {
        const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
        link.rel = 'icon';
        link.href = settings.favicon_url;
        document.head.appendChild(link);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!settings.smtp_user || !settings.smtp_password) {
      toast.error(t('settings.emailConfigRequired'));
      return;
    }
    
    setTesting(true);
    try {
      await axios.post(`${API}/api/settings/test-email`, {}, { headers: getAuthHeader() });
      toast.success(t('settings.emailTestSuccess'));
    } catch (error) {
      console.error('Email test error:', error);
      toast.error(error.response?.data?.detail || t('settings.emailTestError'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="settings-loading">
        <Skeleton className="h-10 w-48" />
        <div className="glass-card p-6">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('settings.title')}</h1>
          <p className="text-slate-500 mt-1">{t('settings.subtitle')}</p>
        </div>
        <Button className="btn-gradient" onClick={handleSave} disabled={saving} data-testid="save-settings-btn">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" strokeWidth={1.5} />}
          {t('common.save')}
        </Button>
      </div>

      {/* Branding Section */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Image className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('settings.branding')}</h2>
            <p className="text-sm text-slate-500">{t('settings.brandingDesc')}</p>
          </div>
        </div>

        {/* Login Logo (Rectangular) */}
        <div className="space-y-3">
          <Label className="text-slate-700 dark:text-slate-300">{t('settings.loginLogo')}</Label>
          <p className="text-xs text-slate-500">{t('settings.loginLogoDesc')}</p>
          <div className="flex items-center gap-4">
            {settings.login_logo_url ? (
              <div className="w-48 h-16 rounded-lg border border-white/40 bg-white/30 p-2 flex items-center justify-center">
                <img src={settings.login_logo_url} alt="Login Logo" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-48 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                <Image className="w-6 h-6" strokeWidth={1.5} />
              </div>
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload('login_logo_url', e.target.files[0])}
                disabled={uploading.login_logo_url}
              />
              <Button variant="outline" className="bg-white/50 border-white/40" disabled={uploading.login_logo_url} asChild>
                <span>
                  {uploading.login_logo_url ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {t('settings.upload')}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {/* Sidebar Logo (Square) */}
        <div className="space-y-3">
          <Label className="text-slate-700 dark:text-slate-300">{t('settings.sidebarLogo')}</Label>
          <p className="text-xs text-slate-500">{t('settings.sidebarLogoDesc')}</p>
          <div className="flex items-center gap-4">
            {settings.sidebar_logo_url ? (
              <div className="w-16 h-16 rounded-lg border border-white/40 bg-white/30 p-2 flex items-center justify-center">
                <img src={settings.sidebar_logo_url} alt="Sidebar Logo" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                <Image className="w-6 h-6" strokeWidth={1.5} />
              </div>
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload('sidebar_logo_url', e.target.files[0])}
                disabled={uploading.sidebar_logo_url}
              />
              <Button variant="outline" className="bg-white/50 border-white/40" disabled={uploading.sidebar_logo_url} asChild>
                <span>
                  {uploading.sidebar_logo_url ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {t('settings.upload')}
                </span>
              </Button>
            </label>
          </div>
        </div>

        {/* Favicon */}
        <div className="space-y-3">
          <Label className="text-slate-700 dark:text-slate-300">{t('settings.favicon')}</Label>
          <p className="text-xs text-slate-500">{t('settings.faviconDesc')}</p>
          <div className="flex items-center gap-4">
            {settings.favicon_url ? (
              <div className="w-12 h-12 rounded-lg border border-white/40 bg-white/30 p-2 flex items-center justify-center">
                <img src={settings.favicon_url} alt="Favicon" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                <Globe className="w-5 h-5" strokeWidth={1.5} />
              </div>
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload('favicon_url', e.target.files[0])}
                disabled={uploading.favicon_url}
              />
              <Button variant="outline" className="bg-white/50 border-white/40" disabled={uploading.favicon_url} asChild>
                <span>
                  {uploading.favicon_url ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {t('settings.upload')}
                </span>
              </Button>
            </label>
          </div>
        </div>
      </div>

      {/* SEO Section */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('settings.seo')}</h2>
            <p className="text-sm text-slate-500">{t('settings.seoDesc')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">{t('settings.siteTitle')}</Label>
            <Input
              className="glass-input"
              value={settings.site_title}
              onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
              placeholder="ORVITI Academy"
              data-testid="site-title-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">{t('settings.siteDescription')}</Label>
            <Input
              className="glass-input"
              value={settings.site_description}
              onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
              placeholder="Sistema de Gestión de Diplomas Digitales"
              data-testid="site-description-input"
            />
          </div>
        </div>
      </div>

      {/* Email Configuration Section */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('settings.emailConfig')}</h2>
            <p className="text-sm text-slate-500">{t('settings.emailConfigDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-slate-600">{t('settings.emailEnabled')}</Label>
            <Switch
              checked={settings.email_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, email_enabled: checked })}
              data-testid="email-enabled-switch"
            />
          </div>
        </div>

        {settings.email_enabled && (
          <div className="space-y-4">
            {/* SMTP Server Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">{t('settings.smtpHost')}</Label>
                <Input
                  className="glass-input"
                  value={settings.smtp_host}
                  onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  data-testid="smtp-host-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">{t('settings.smtpPort')}</Label>
                <Input
                  className="glass-input"
                  value={settings.smtp_port}
                  onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                  placeholder="587"
                  data-testid="smtp-port-input"
                />
              </div>
            </div>

            {/* Credentials Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">{t('settings.smtpUser')}</Label>
                <Input
                  type="email"
                  className="glass-input"
                  value={settings.smtp_user}
                  onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                  placeholder="correo@tudominio.com"
                  data-testid="smtp-user-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">{t('settings.smtpPassword')}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    className="glass-input pr-10"
                    value={settings.smtp_password}
                    onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                    placeholder="••••••••••••••••"
                    data-testid="smtp-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">{t('settings.smtpPasswordHelp')}</p>
              </div>
            </div>

            {/* From Info Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">{t('settings.smtpFromName')}</Label>
                <Input
                  className="glass-input"
                  value={settings.smtp_from_name}
                  onChange={(e) => setSettings({ ...settings, smtp_from_name: e.target.value })}
                  placeholder="ORVITI Academy"
                  data-testid="smtp-from-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">{t('settings.smtpFromEmail')}</Label>
                <Input
                  type="email"
                  className="glass-input"
                  value={settings.smtp_from_email}
                  onChange={(e) => setSettings({ ...settings, smtp_from_email: e.target.value })}
                  placeholder="diplomas@tudominio.com"
                  data-testid="smtp-from-email-input"
                />
              </div>
            </div>

            {/* Test Email Button */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-500">{t('settings.emailTestDesc')}</p>
              <Button
                variant="outline"
                className="bg-white/50 border-white/40"
                onClick={handleTestEmail}
                disabled={testing || !settings.smtp_user || !settings.smtp_password}
                data-testid="test-email-btn"
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {t('settings.testEmail')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
