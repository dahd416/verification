import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { diplomasAPI, coursesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
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
import {
  Search,
  Scroll,
  MoreVertical,
  XCircle,
  CheckCircle,
  ExternalLink,
  QrCode,
  Copy,
  Download,
  Loader2,
  Trash2,
  Mail,
  MailCheck,
  Send,
} from 'lucide-react';

const Diplomas = () => {
  const { t } = useTranslation();
  const [diplomas, setDiplomas] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [selectedDiplomas, setSelectedDiplomas] = useState([]);
  const [filters, setFilters] = useState({
    course_id: 'all',
    status: 'all',
    search: '',
  });
  const [actionDialog, setActionDialog] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchDiplomas();
  }, [filters.course_id, filters.status]);

  const fetchData = async () => {
    try {
      const [diplomasRes, coursesRes] = await Promise.all([
        diplomasAPI.getAll(),
        coursesAPI.getAll(),
      ]);
      setDiplomas(diplomasRes.data);
      setCourses(coursesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(t('diplomas.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDiplomas = async () => {
    try {
      const params = {};
      if (filters.course_id !== 'all') params.course_id = filters.course_id;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.search) params.search = filters.search;
      
      const response = await diplomasAPI.getAll(params);
      setDiplomas(response.data);
      setSelectedDiplomas([]);
    } catch (error) {
      console.error('Failed to fetch diplomas:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDiplomas();
  };

  const handleRevoke = async (id) => {
    try {
      await diplomasAPI.revoke(id);
      toast.success(t('diplomas.revoked'));
      setDiplomas(diplomas.map(d => d.id === id ? { ...d, status: 'revoked' } : d));
    } catch (error) {
      console.error('Revoke error:', error);
      toast.error(t('diplomas.revokeError'));
    } finally {
      setActionDialog(null);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await diplomasAPI.reactivate(id);
      toast.success(t('diplomas.reactivated'));
      setDiplomas(diplomas.map(d => d.id === id ? { ...d, status: 'valid' } : d));
    } catch (error) {
      console.error('Reactivate error:', error);
      toast.error(t('diplomas.reactivateError'));
    } finally {
      setActionDialog(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await diplomasAPI.delete(id);
      toast.success(t('diplomas.deleted'));
      setDiplomas(diplomas.filter(d => d.id !== id));
      setSelectedDiplomas(selectedDiplomas.filter(sid => sid !== id));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('diplomas.deleteError'));
    } finally {
      setActionDialog(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(t('common.copied'));
  };

  const openVerification = (certificateId) => {
    window.open(`/verify/${certificateId}`, '_blank');
  };

  const handleDownloadPdf = async (diploma) => {
    setDownloadingId(diploma.id);
    try {
      const response = await diplomasAPI.downloadPdf(diploma.id);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `certificado_${diploma.certificate_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(t('diplomas.downloadSuccess'));
    } catch (error) {
      console.error('Download error:', error);
      toast.error(t('diplomas.downloadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSendEmail = async (diploma) => {
    setSendingEmailId(diploma.id);
    try {
      const response = await diplomasAPI.sendEmail(diploma.id);
      toast.success(t('diplomas.emailSent'));
      // Update diploma email_sent status
      setDiplomas(diplomas.map(d => 
        d.id === diploma.id 
          ? { ...d, email_sent: true, email_sent_at: response.data.email_sent_at } 
          : d
      ));
    } catch (error) {
      console.error('Email send error:', error);
      const errorMsg = error.response?.data?.detail || t('diplomas.emailSendError');
      toast.error(errorMsg);
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleSelectDiploma = (diplomaId, checked) => {
    if (checked) {
      setSelectedDiplomas([...selectedDiplomas, diplomaId]);
    } else {
      setSelectedDiplomas(selectedDiplomas.filter(id => id !== diplomaId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedDiplomas(diplomas.map(d => d.id));
    } else {
      setSelectedDiplomas([]);
    }
  };

  const handleBulkSendEmail = async () => {
    if (selectedDiplomas.length === 0) return;
    
    setSendingBulk(true);
    try {
      const response = await diplomasAPI.sendBulkEmail(selectedDiplomas);
      const { sent, failed } = response.data;
      
      if (sent > 0) {
        toast.success(t('diplomas.bulkEmailSent', { count: sent }));
        // Update email_sent status for sent diplomas
        const sentIds = response.data.results
          .filter(r => r.success)
          .map(r => r.id);
        setDiplomas(diplomas.map(d => 
          sentIds.includes(d.id) 
            ? { ...d, email_sent: true, email_sent_at: new Date().toISOString() } 
            : d
        ));
      }
      
      if (failed > 0) {
        toast.error(t('diplomas.bulkEmailFailed', { count: failed }));
      }
      
      setSelectedDiplomas([]);
    } catch (error) {
      console.error('Bulk email error:', error);
      const errorMsg = error.response?.data?.detail || t('diplomas.emailSendError');
      toast.error(errorMsg);
    } finally {
      setSendingBulk(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="diplomas-loading">
        <Skeleton className="h-10 w-48" />
        <div className="glass-card p-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full mb-3" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="diplomas-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('diplomas.title')}</h1>
          <p className="text-slate-500 mt-1">{t('diplomas.subtitle')}</p>
        </div>
        {selectedDiplomas.length > 0 && (
          <Button 
            className="btn-gradient"
            onClick={handleBulkSendEmail}
            disabled={sendingBulk}
            data-testid="bulk-send-email-btn"
          >
            {sendingBulk ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Send className="mr-2 h-4 w-4" strokeWidth={1.5} />
            )}
            {t('diplomas.sendSelected', { count: selectedDiplomas.length })}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" strokeWidth={1.5} />
              <Input
                placeholder={t('diplomas.searchPlaceholder')}
                className="glass-input pl-12"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                data-testid="search-input"
              />
            </div>
            <Button type="submit" variant="outline" className="bg-white/50 border-white/40" data-testid="search-btn">
              {t('common.search')}
            </Button>
          </form>
          
          <div className="flex gap-3">
            <Select
              value={filters.course_id}
              onValueChange={(value) => setFilters({ ...filters, course_id: value })}
            >
              <SelectTrigger className="w-48 glass-input" data-testid="course-filter">
                <SelectValue placeholder={t('recipients.allCourses')} />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/40">
                <SelectItem value="all">{t('recipients.allCourses')}</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="w-36 glass-input" data-testid="status-filter">
                <SelectValue placeholder={t('diplomas.allStatus')} />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/40">
                <SelectItem value="all">{t('diplomas.allStatus')}</SelectItem>
                <SelectItem value="valid">{t('common.valid')}</SelectItem>
                <SelectItem value="revoked">{t('common.revoked')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Diplomas Table */}
      <div className="glass-card overflow-hidden">
        {diplomas.length > 0 ? (
          <div className="glass-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-12">
                    <Checkbox
                      checked={selectedDiplomas.length === diplomas.length && diplomas.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="select-all-checkbox"
                    />
                  </th>
                  <th className="text-left">{t('recipients.title')}</th>
                  <th className="text-left">{t('nav.courses')}</th>
                  <th className="text-left">{t('diplomas.certificateId')}</th>
                  <th className="text-left">{t('diplomas.status')}</th>
                  <th className="text-left">{t('diplomas.emailStatus')}</th>
                  <th className="text-left">{t('diplomas.issued')}</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {diplomas.map((diploma) => (
                  <tr key={diploma.id} data-testid={`diploma-row-${diploma.id}`}>
                    <td>
                      <Checkbox
                        checked={selectedDiplomas.includes(diploma.id)}
                        onCheckedChange={(checked) => handleSelectDiploma(diploma.id, checked)}
                        data-testid={`select-diploma-${diploma.id}`}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <Scroll className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{diploma.recipient_name}</span>
                      </div>
                    </td>
                    <td>
                      <Badge className="bg-white/60 text-slate-600 border-white/40">
                        {diploma.course_name}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-white/60 px-2.5 py-1 rounded-lg text-indigo-600 font-mono">
                          {diploma.certificate_id}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                          onClick={() => copyToClipboard(diploma.certificate_id)}
                        >
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </Button>
                      </div>
                    </td>
                    <td>
                      <Badge className={diploma.status === 'valid' ? 'badge-success' : 'badge-error'}>
                        {diploma.status === 'valid' ? (
                          <><CheckCircle className="mr-1 h-3 w-3" strokeWidth={1.5} /> {t('common.valid')}</>
                        ) : (
                          <><XCircle className="mr-1 h-3 w-3" strokeWidth={1.5} /> {t('common.revoked')}</>
                        )}
                      </Badge>
                    </td>
                    <td>
                      {diploma.email_sent ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" data-testid={`email-sent-badge-${diploma.id}`}>
                          <MailCheck className="mr-1 h-3 w-3" strokeWidth={1.5} />
                          {t('diplomas.sent')}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200" data-testid={`email-pending-badge-${diploma.id}`}>
                          <Mail className="mr-1 h-3 w-3" strokeWidth={1.5} />
                          {t('diplomas.notSent')}
                        </Badge>
                      )}
                    </td>
                    <td className="text-slate-500 text-sm">
                      {new Date(diploma.issued_at).toLocaleDateString()}
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`diploma-actions-${diploma.id}`}>
                            <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card border-white/40">
                          <DropdownMenuItem 
                            onClick={() => handleDownloadPdf(diploma)}
                            disabled={downloadingId === diploma.id}
                          >
                            {downloadingId === diploma.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
                            ) : (
                              <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
                            )}
                            {t('diplomas.downloadPdf')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleSendEmail(diploma)}
                            disabled={sendingEmailId === diploma.id}
                            data-testid={`send-email-${diploma.id}`}
                          >
                            {sendingEmailId === diploma.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
                            ) : (
                              <Mail className="mr-2 h-4 w-4" strokeWidth={1.5} />
                            )}
                            {diploma.email_sent ? t('diplomas.resendEmail') : t('diplomas.sendEmail')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openVerification(diploma.certificate_id)}>
                            <ExternalLink className="mr-2 h-4 w-4" strokeWidth={1.5} />
                            {t('diplomas.viewVerification')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyToClipboard(`${window.location.origin}/verify/${diploma.certificate_id}`)}>
                            <QrCode className="mr-2 h-4 w-4" strokeWidth={1.5} />
                            {t('diplomas.copyUrl')}
                          </DropdownMenuItem>
                          {diploma.status === 'valid' ? (
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ type: 'revoke', id: diploma.id })}
                              className="text-red-600 focus:text-red-600"
                            >
                              <XCircle className="mr-2 h-4 w-4" strokeWidth={1.5} />
                              {t('diplomas.revoke')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setActionDialog({ type: 'reactivate', id: diploma.id })}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" strokeWidth={1.5} />
                              {t('diplomas.reactivate')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setActionDialog({ type: 'delete', id: diploma.id })}
                            className="text-red-600 focus:text-red-600"
                            data-testid={`delete-diploma-${diploma.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
                            {t('diplomas.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Scroll className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('diplomas.empty')}</h3>
            <p className="text-slate-500">
              {filters.search || filters.course_id !== 'all' || filters.status !== 'all'
                ? t('diplomas.adjustFilters')
                : t('diplomas.emptyDesc')}
            </p>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <AlertDialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <AlertDialogContent className="glass-card border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.type === 'revoke' 
                ? t('diplomas.revokeTitle') 
                : actionDialog?.type === 'delete' 
                  ? t('diplomas.deleteTitle')
                  : t('diplomas.reactivateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog?.type === 'revoke'
                ? t('diplomas.revokeDesc')
                : actionDialog?.type === 'delete'
                  ? t('diplomas.deleteDesc')
                  : t('diplomas.reactivateDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/50 border-white/40">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionDialog?.type === 'revoke') {
                  handleRevoke(actionDialog.id);
                } else if (actionDialog?.type === 'delete') {
                  handleDelete(actionDialog.id);
                } else {
                  handleReactivate(actionDialog.id);
                }
              }}
              className={actionDialog?.type === 'revoke' || actionDialog?.type === 'delete' 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'btn-gradient'}
              data-testid="confirm-action-btn"
            >
              {actionDialog?.type === 'revoke' 
                ? t('diplomas.revoke') 
                : actionDialog?.type === 'delete'
                  ? t('common.delete')
                  : t('diplomas.reactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Diplomas;
