import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { scanLogsAPI } from '../lib/api';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { QrCode, Globe, Clock, Monitor, Smartphone, Laptop, Trash2, Loader2 } from 'lucide-react';

const ScanLogs = () => {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await scanLogsAPI.getAll();
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error(t('scanLogs.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      await scanLogsAPI.clear();
      setLogs([]);
      toast.success(t('scanLogs.cleared'));
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast.error(t('scanLogs.clearError'));
    } finally {
      setClearing(false);
      setShowClearDialog(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseUserAgent = (ua) => {
    if (!ua || ua === 'unknown') return { name: 'Unknown', icon: Monitor };
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) return { name: 'Mobile', icon: Smartphone };
    if (ua.includes('Chrome')) return { name: 'Chrome', icon: Laptop };
    if (ua.includes('Firefox')) return { name: 'Firefox', icon: Laptop };
    if (ua.includes('Safari')) return { name: 'Safari', icon: Laptop };
    return { name: 'Browser', icon: Monitor };
  };

  const todayCount = logs.filter(l => {
    const date = new Date(l.scanned_at);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).length;

  const uniqueIPs = new Set(logs.map(l => l.ip_address)).size;

  if (loading) {
    return (
      <div className="space-y-6" data-testid="scan-logs-loading">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-6 w-20 mb-2" />
              <Skeleton className="h-10 w-16" />
            </div>
          ))}
        </div>
        <div className="glass-card p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full mb-3" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="scan-logs-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('scanLogs.title')}</h1>
          <p className="text-slate-500 mt-1">{t('scanLogs.subtitle')}</p>
        </div>
        {logs.length > 0 && (
          <Button
            variant="outline"
            className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
            onClick={() => setShowClearDialog(true)}
            data-testid="clear-logs-btn"
          >
            <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
            {t('scanLogs.clearAll')}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <QrCode className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{logs.length}</p>
            <p className="text-sm text-slate-500">{t('scanLogs.totalScans')}</p>
          </div>
        </div>
        
        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Clock className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{todayCount}</p>
            <p className="text-sm text-slate-500">{t('scanLogs.today')}</p>
          </div>
        </div>

        <div className="glass-card p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Globe className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{uniqueIPs}</p>
            <p className="text-sm text-slate-500">{t('scanLogs.uniqueIPs')}</p>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/40">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('scanLogs.recentScans')}</h2>
          <p className="text-slate-500 text-sm">{t('scanLogs.recentScansDesc')}</p>
        </div>
        
        {logs.length > 0 ? (
          <div className="glass-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">{t('diplomas.certificateId')}</th>
                  <th className="text-left">{t('scanLogs.scannedAt')}</th>
                  <th className="text-left">{t('scanLogs.ipAddress')}</th>
                  <th className="text-left">{t('scanLogs.device')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const device = parseUserAgent(log.user_agent);
                  const DeviceIcon = device.icon;
                  return (
                    <tr key={log.id} data-testid={`scan-log-${log.id}`}>
                      <td>
                        <code className="text-xs bg-white/60 px-2.5 py-1 rounded-lg text-indigo-600 font-mono">
                          {log.certificate_id}
                        </code>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock className="w-4 h-4" strokeWidth={1.5} />
                          {formatDate(log.scanned_at)}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Globe className="w-4 h-4" strokeWidth={1.5} />
                          {log.ip_address || 'Unknown'}
                        </div>
                      </td>
                      <td>
                        <Badge className="bg-white/60 text-slate-600 border-white/40">
                          <DeviceIcon className="mr-1 w-3 h-3" strokeWidth={1.5} />
                          {device.name}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('scanLogs.empty')}</h3>
            <p className="text-slate-500">{t('scanLogs.emptyDesc')}</p>
          </div>
        )}
      </div>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="glass-card border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('scanLogs.clearTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('scanLogs.clearDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/50 border-white/40">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearLogs}
              className="bg-red-500 text-white hover:bg-red-600"
              disabled={clearing}
              data-testid="confirm-clear-btn"
            >
              {clearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('scanLogs.clearAll')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScanLogs;
