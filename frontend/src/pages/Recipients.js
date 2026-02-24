import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { recipientsAPI, coursesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { Plus, Users, Upload, Download, Trash2, Mail, User, Loader2, Search } from 'lucide-react';

const Recipients = () => {
  const { t } = useTranslation();
  const [recipients, setRecipients] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef();

  const [newRecipient, setNewRecipient] = useState({
    full_name: '',
    email: '',
    course_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [selectedCourse]);

  const fetchData = async () => {
    try {
      const [recipientsRes, coursesRes] = await Promise.all([
        recipientsAPI.getAll(),
        coursesAPI.getAll(),
      ]);
      setRecipients(recipientsRes.data);
      setCourses(coursesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(t('recipients.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const courseId = selectedCourse === 'all' ? null : selectedCourse;
      const response = await recipientsAPI.getAll(courseId);
      setRecipients(response.data);
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipient.full_name || !newRecipient.email || !newRecipient.course_id) {
      toast.error(t('recipients.fillAllFields'));
      return;
    }

    setAddLoading(true);
    try {
      const response = await recipientsAPI.create(newRecipient);
      setRecipients([...recipients, response.data]);
      toast.success(t('recipients.added'));
      setShowAddDialog(false);
      setNewRecipient({ full_name: '', email: '', course_id: '' });
    } catch (error) {
      console.error('Add error:', error);
      toast.error(error.response?.data?.detail || t('recipients.addError'));
    } finally {
      setAddLoading(false);
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const courseId = newRecipient.course_id;
    if (!courseId) {
      toast.error(t('recipients.selectCourseFirst'));
      return;
    }

    setImportLoading(true);
    try {
      const response = await recipientsAPI.bulkImport(courseId, file);
      toast.success(t('recipients.imported', { count: response.data.imported }));
      if (response.data.errors?.length > 0) {
        toast.warning(t('recipients.importErrors', { count: response.data.errors.length }));
      }
      fetchRecipients();
      setShowImportDialog(false);
    } catch (error) {
      console.error('Import error:', error);
      toast.error(t('recipients.importError'));
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await recipientsAPI.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'recipients_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('recipients.templateDownloaded'));
    } catch (error) {
      console.error('Download error:', error);
      toast.error(t('recipients.downloadError'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await recipientsAPI.delete(deleteId);
      toast.success(t('recipients.deleted'));
      setRecipients(recipients.filter(r => r.id !== deleteId));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('recipients.deleteError'));
    } finally {
      setDeleteId(null);
    }
  };

  const getCourseName = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    return course?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="recipients-loading">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-36" />
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
    <div className="space-y-6" data-testid="recipients-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('recipients.title')}</h1>
          <p className="text-slate-500 mt-1">{t('recipients.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowImportDialog(true)}
            className="bg-white/50 border-white/40 hover:bg-white/80"
            data-testid="import-csv-btn"
          >
            <Upload className="mr-2 h-4 w-4" strokeWidth={1.5} />
            {t('recipients.importCSV')}
          </Button>
          <Button className="btn-gradient" onClick={() => setShowAddDialog(true)} data-testid="add-recipient-btn">
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            {t('recipients.add')}
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Search className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
            <Label className="text-sm whitespace-nowrap text-slate-600">{t('recipients.filterByCourse')}:</Label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-64 glass-input" data-testid="course-filter">
                <SelectValue placeholder={t('recipients.allCourses')} />
              </SelectTrigger>
              <SelectContent className="glass-card border-white/40">
                <SelectItem value="all">{t('recipients.allCourses')}</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
            {recipients.length} {t('recipients.title').toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* Recipients Table */}
      <div className="glass-card overflow-hidden">
        {recipients.length > 0 ? (
          <div className="glass-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">{t('recipients.name')}</th>
                  <th className="text-left">{t('auth.email')}</th>
                  <th className="text-left">{t('nav.courses')}</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((recipient) => (
                  <tr key={recipient.id} data-testid={`recipient-row-${recipient.id}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <User className="w-5 h-5 text-white" strokeWidth={1.5} />
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{recipient.full_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail className="w-4 h-4" strokeWidth={1.5} />
                        {recipient.email}
                      </div>
                    </td>
                    <td>
                      <Badge className="bg-white/60 text-slate-600 border-white/40">
                        {getCourseName(recipient.course_id)}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteId(recipient.id)}
                        data-testid={`delete-recipient-${recipient.id}`}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('recipients.empty')}</h3>
            <p className="text-slate-500 mb-6">{t('recipients.emptyDesc')}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setShowImportDialog(true)} className="bg-white/50 border-white/40">
                <Upload className="mr-2 h-4 w-4" strokeWidth={1.5} />
                {t('recipients.importCSV')}
              </Button>
              <Button className="btn-gradient" onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
                {t('recipients.add')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Recipient Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="glass-card border-white/40">
          <DialogHeader>
            <DialogTitle>{t('recipients.addTitle')}</DialogTitle>
            <DialogDescription>{t('recipients.addDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('nav.courses')} *</Label>
              <Select
                value={newRecipient.course_id}
                onValueChange={(value) => setNewRecipient({ ...newRecipient, course_id: value })}
              >
                <SelectTrigger className="glass-input" data-testid="add-recipient-course">
                  <SelectValue placeholder={t('recipients.selectCourse')} />
                </SelectTrigger>
                <SelectContent className="glass-card border-white/40">
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('auth.fullName')} *</Label>
              <Input
                placeholder="John Doe"
                className="glass-input"
                value={newRecipient.full_name}
                onChange={(e) => setNewRecipient({ ...newRecipient, full_name: e.target.value })}
                data-testid="add-recipient-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('auth.email')} *</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                className="glass-input"
                value={newRecipient.email}
                onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                data-testid="add-recipient-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="bg-white/50 border-white/40">
              {t('common.cancel')}
            </Button>
            <Button className="btn-gradient" onClick={handleAddRecipient} disabled={addLoading} data-testid="submit-add-recipient">
              {addLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('recipients.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="glass-card border-white/40">
          <DialogHeader>
            <DialogTitle>{t('recipients.importTitle')}</DialogTitle>
            <DialogDescription>{t('recipients.importDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('nav.courses')} *</Label>
              <Select
                value={newRecipient.course_id}
                onValueChange={(value) => setNewRecipient({ ...newRecipient, course_id: value })}
              >
                <SelectTrigger className="glass-input" data-testid="import-course-select">
                  <SelectValue placeholder={t('recipients.selectCourse')} />
                </SelectTrigger>
                <SelectContent className="glass-card border-white/40">
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('recipients.csvFile')}</Label>
              <div className="border-2 border-dashed border-indigo-200 rounded-xl p-8 text-center bg-white/30">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportCSV}
                />
                <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-slate-500 mb-3">
                  {t('recipients.dropOrClick')}
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!newRecipient.course_id || importLoading}
                  className="bg-white/50 border-white/40"
                  data-testid="upload-csv-file-btn"
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('recipients.importing')}
                    </>
                  ) : (
                    t('recipients.selectFile')
                  )}
                </Button>
              </div>
            </div>

            <Button
              variant="link"
              className="p-0 h-auto text-indigo-600"
              onClick={handleDownloadTemplate}
              data-testid="download-template-btn"
            >
              <Download className="mr-1 h-4 w-4" strokeWidth={1.5} />
              {t('recipients.downloadTemplate')}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="bg-white/50 border-white/40">
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="glass-card border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recipients.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('recipients.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/50 border-white/40">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Recipients;
