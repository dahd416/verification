import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, User, Building, Loader2, Sparkles, ArrowRight } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    organizationName: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register(formData.email, formData.password, formData.name, formData.organizationName);
      toast.success(t('auth.accountCreated'));
      navigate('/');
    } catch (error) {
      console.error('Register error:', error);
      toast.error(error.response?.data?.detail || t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen glass-bg flex items-center justify-center p-4" data-testid="register-page">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-purple-200/10 to-indigo-200/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl shadow-indigo-500/30 mb-6">
            <Sparkles className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
            ORVITI Academy
          </h1>
          <p className="text-slate-500 text-lg">
            {t('auth.startIssuing')}
          </p>
        </div>

        {/* Register Card */}
        <div className="glass-card p-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-1">{t('auth.createAccount')}</h2>
            <p className="text-slate-500">{t('auth.fillDetails')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700 font-medium">{t('auth.fullName')}</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" strokeWidth={1.5} />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  className="glass-input pl-12 h-12"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="register-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization" className="text-slate-700 font-medium">{t('auth.organizationName')}</Label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" strokeWidth={1.5} />
                <Input
                  id="organization"
                  type="text"
                  placeholder="ORVITI Academy"
                  className="glass-input pl-12 h-12"
                  value={formData.organizationName}
                  onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                  data-testid="register-org"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" strokeWidth={1.5} />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="glass-input pl-12 h-12"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="register-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" strokeWidth={1.5} />
                <Input
                  id="password"
                  type="password"
                  placeholder={t('auth.minCharacters')}
                  className="glass-input pl-12 h-12"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  data-testid="register-password"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full btn-gradient h-12 text-base mt-6"
              disabled={loading}
              data-testid="register-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('auth.creatingAccount')}
                </>
              ) : (
                <>
                  {t('auth.createAccount')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-slate-500">{t('auth.haveAccount')} </span>
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
              {t('auth.signIn')}
            </Link>
          </div>
        </div>

        {/* Features List */}
        <div className="mt-6 glass-card p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-sm font-medium text-slate-700 mb-3">{t('auth.features')}</p>
          <ul className="space-y-2">
            {[
              t('auth.feature1'),
              t('auth.feature2'),
              t('auth.feature3'),
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Register;
