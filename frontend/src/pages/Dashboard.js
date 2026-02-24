import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dashboardAPI, seedAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import {
  Award,
  GraduationCap,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Plus,
  ArrowRight,
  Scroll,
  Database,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color = 'indigo' }) => {
  const colorClasses = {
    indigo: 'from-indigo-500 to-purple-500 shadow-indigo-500/25',
    emerald: 'from-emerald-500 to-teal-500 shadow-emerald-500/25',
    red: 'from-red-500 to-rose-500 shadow-red-500/25',
    amber: 'from-amber-500 to-orange-500 shadow-amber-500/25',
  };

  return (
    <div className="glass-card p-6 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1" data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
          <p className="stat-number">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-emerald-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error(t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const response = await seedAPI.seed();
      toast.success(response.data.message);
      if (response.data.credentials) {
        toast.info(`Demo: ${response.data.credentials.email} / ${response.data.credentials.password}`);
      }
      fetchStats();
    } catch (error) {
      console.error('Seed error:', error);
      toast.error(error.response?.data?.detail || t('dashboard.seedError'));
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8" data-testid="dashboard-loading">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = stats?.total_diplomas === 0 && stats?.total_courses === 0;

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('dashboard.welcome')}
          </h1>
          <p className="text-slate-500 mt-1 text-lg">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {isEmpty && (
            <Button 
              onClick={handleSeedDatabase} 
              disabled={seeding} 
              variant="outline"
              className="bg-white/50 border-white/40 hover:bg-white/80"
              data-testid="seed-btn"
            >
              <Database className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {seeding ? t('common.loading') : t('dashboard.loadDemoData')}
            </Button>
          )}
          <Link to="/generate">
            <Button className="btn-gradient" data-testid="generate-btn">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t('dashboard.generateDiplomas')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('dashboard.totalDiplomas')}
          value={stats?.total_diplomas || 0}
          icon={Award}
          color="indigo"
        />
        <StatCard
          title={t('dashboard.validDiplomas')}
          value={stats?.valid_diplomas || 0}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title={t('dashboard.revokedDiplomas')}
          value={stats?.revoked_diplomas || 0}
          icon={XCircle}
          color="red"
        />
        <StatCard
          title={t('dashboard.activeCourses')}
          value={stats?.total_courses || 0}
          icon={GraduationCap}
          color="amber"
        />
      </div>

      {/* Secondary Stats & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StatCard
          title={t('dashboard.totalRecipients')}
          value={stats?.total_recipients || 0}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title={t('dashboard.totalTemplates')}
          value={stats?.total_templates || 0}
          icon={FileText}
          color="indigo"
        />
        
        {/* Quick Actions Card */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
            <p className="font-semibold text-slate-900 dark:text-white">{t('dashboard.quickActions')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/courses/new">
              <Button variant="outline" className="w-full justify-start bg-white/50 border-white/40 hover:bg-white/80">
                <GraduationCap className="mr-2 h-4 w-4" strokeWidth={1.5} />
                {t('dashboard.newCourse')}
              </Button>
            </Link>
            <Link to="/templates/new">
              <Button variant="outline" className="w-full justify-start bg-white/50 border-white/40 hover:bg-white/80">
                <FileText className="mr-2 h-4 w-4" strokeWidth={1.5} />
                {t('dashboard.newTemplate')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('dashboard.recentActivity')}</h2>
            <p className="text-slate-500 text-sm">{t('dashboard.latestDiplomas')}</p>
          </div>
          <Link to="/diplomas">
            <Button variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
              {t('common.viewAll')} <ArrowRight className="ml-1 h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>

        {stats?.recent_activity?.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_activity.map((diploma) => (
              <div
                key={diploma.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors border border-white/40 dark:border-slate-700/40"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Scroll className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{diploma.recipient_name}</p>
                    <p className="text-sm text-slate-500">{diploma.course_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    className={diploma.status === 'valid' 
                      ? 'badge-success' 
                      : 'badge-error'
                    }
                  >
                    {diploma.status === 'valid' ? t('common.valid') : t('common.revoked')}
                  </Badge>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(diploma.issued_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Scroll className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t('dashboard.noDiplomas')}</h3>
            <p className="text-slate-500 mb-6">{t('dashboard.noDiplomasDesc')}</p>
            <Link to="/generate">
              <Button className="btn-gradient">
                <Award className="mr-2 h-4 w-4" strokeWidth={1.5} />
                {t('dashboard.generateFirst')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
