import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { coursesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, GraduationCap, Users, Clock, Edit, Trash2, Calendar, Download, MoreVertical, Loader2, FileArchive } from 'lucide-react';

const Courses = () => {
  const { t } = useTranslation();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [downloadingCourseId, setDownloadingCourseId] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await coursesAPI.getAll();
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      toast.error(t('courses.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAllDiplomas = async (course) => {
    if (course.diploma_count === 0) {
      toast.error(t('courses.noDiplomasToDownload'));
      return;
    }
    
    setDownloadingCourseId(course.id);
    toast.info(t('courses.generatingZip'));
    
    try {
      const response = await coursesAPI.downloadAllDiplomas(course.id);
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const courseName = course.name.replace(/\s+/g, '_').replace(/[/\\]/g, '-');
      link.setAttribute('download', `diplomas_${courseName}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(t('courses.zipDownloaded'));
    } catch (error) {
      console.error('Download error:', error);
      if (error.response?.status === 404) {
        toast.error(t('courses.noDiplomasToDownload'));
      } else {
        toast.error(t('courses.downloadZipError'));
      }
    } finally {
      setDownloadingCourseId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await coursesAPI.delete(deleteId);
      toast.success(t('courses.deleted'));
      setCourses(courses.filter(c => c.id !== deleteId));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('courses.deleteError'));
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="courses-loading">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="courses-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('courses.title')}</h1>
          <p className="text-slate-500 mt-1">{t('courses.subtitle')}</p>
        </div>
        <Link to="/courses/new">
          <Button className="btn-gradient" data-testid="create-course-btn">
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            {t('courses.new')}
          </Button>
        </Link>
      </div>

      {/* Course Grid */}
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div 
              key={course.id} 
              className="glass-card p-6 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              data-testid={`course-card-${course.id}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-110 transition-transform">
                    <GraduationCap className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {course.name}
                    </h3>
                    <p className="text-sm text-slate-500">{course.instructor}</p>
                  </div>
                </div>
              </div>

              {course.description && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                  {course.description}
                </p>
              )}
              
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className="bg-white/60 text-slate-600 border-white/40 hover:bg-white/80">
                  <Clock className="mr-1 h-3 w-3" strokeWidth={1.5} />
                  {course.duration_hours}h
                </Badge>
                <Badge className="bg-white/60 text-slate-600 border-white/40 hover:bg-white/80">
                  <Users className="mr-1 h-3 w-3" strokeWidth={1.5} />
                  {course.recipient_count} {t('recipients.title').toLowerCase()}
                </Badge>
                {course.diploma_count > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    <FileArchive className="mr-1 h-3 w-3" strokeWidth={1.5} />
                    {course.diploma_count} diplomas
                  </Badge>
                )}
                {course.start_date && (
                  <Badge className="bg-white/60 text-slate-600 border-white/40 hover:bg-white/80">
                    <Calendar className="mr-1 h-3 w-3" strokeWidth={1.5} />
                    {new Date(course.start_date).toLocaleDateString()}
                  </Badge>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/40">
                <Link to={`/courses/${course.id}/edit`} className="flex-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full bg-white/50 border-white/40 hover:bg-white/80"
                    data-testid={`edit-course-${course.id}`}
                  >
                    <Edit className="mr-1 h-3 w-3" strokeWidth={1.5} />
                    {t('common.edit')}
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/50 border-white/40 hover:bg-white/80"
                      data-testid={`course-actions-${course.id}`}
                    >
                      <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card border-white/40">
                    <DropdownMenuItem
                      onClick={() => handleDownloadAllDiplomas(course)}
                      disabled={downloadingCourseId === course.id || course.diploma_count === 0}
                    >
                      {downloadingCourseId === course.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
                      )}
                      {t('courses.downloadAllDiplomas')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteId(course.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('courses.empty')}</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            {t('courses.emptyDesc')}
          </p>
          <Link to="/courses/new">
            <Button className="btn-gradient">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t('courses.createFirst')}
            </Button>
          </Link>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="glass-card border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('courses.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('courses.deleteDesc')}
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

export default Courses;
