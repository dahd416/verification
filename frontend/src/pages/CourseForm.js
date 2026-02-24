import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { coursesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, GraduationCap, Calendar, Clock, User } from 'lucide-react';

const CourseForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const isEdit = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructor: '',
    duration_hours: 20,
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    if (isEdit) {
      fetchCourse();
    }
  }, [id]);

  const fetchCourse = async () => {
    try {
      const response = await coursesAPI.getById(id);
      const course = response.data;
      setFormData({
        name: course.name,
        description: course.description || '',
        instructor: course.instructor,
        duration_hours: course.duration_hours,
        start_date: course.start_date || '',
        end_date: course.end_date || '',
      });
    } catch (error) {
      console.error('Failed to fetch course:', error);
      toast.error(t('courses.loadError'));
      navigate('/courses');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await coursesAPI.update(id, formData);
        toast.success(t('courses.courseUpdated'));
      } else {
        await coursesAPI.create(formData);
        toast.success(t('courses.courseCreated'));
      }
      navigate('/courses');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg animate-pulse">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="course-form-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/courses')} 
          className="sidebar-item"
          data-testid="back-btn"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isEdit ? t('courses.edit') : t('courses.new')}
          </h1>
          <p className="text-slate-500 mt-1">
            {isEdit ? t('courses.courseUpdated') : t('courses.fillCourseInfo')}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <GraduationCap className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('courses.courseDetails')}</h2>
            <p className="text-slate-500">{t('courses.fillCourseInfo')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-700 font-medium">{t('courses.courseName')} *</Label>
            <Input
              id="name"
              placeholder={t('courses.courseNamePlaceholder')}
              className="glass-input h-12"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="course-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-slate-700 font-medium">{t('courses.description')}</Label>
            <Textarea
              id="description"
              placeholder={t('courses.descriptionPlaceholder')}
              className="glass-input min-h-[100px] resize-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              data-testid="course-description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="instructor" className="text-slate-700 font-medium">
                <User className="inline-block w-4 h-4 mr-1" strokeWidth={1.5} />
                {t('courses.instructor')} *
              </Label>
              <Input
                id="instructor"
                placeholder={t('courses.instructorPlaceholder')}
                className="glass-input h-12"
                value={formData.instructor}
                onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                required
                data-testid="course-instructor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration" className="text-slate-700 font-medium">
                <Clock className="inline-block w-4 h-4 mr-1" strokeWidth={1.5} />
                {t('courses.duration')} *
              </Label>
              <Input
                id="duration"
                type="number"
                min={1}
                placeholder="20"
                className="glass-input h-12"
                value={formData.duration_hours}
                onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) || 0 })}
                required
                data-testid="course-duration"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="start_date" className="text-slate-700 font-medium">
                <Calendar className="inline-block w-4 h-4 mr-1" strokeWidth={1.5} />
                {t('courses.startDate')}
              </Label>
              <Input
                id="start_date"
                type="date"
                className="glass-input h-12"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                data-testid="course-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date" className="text-slate-700 font-medium">
                <Calendar className="inline-block w-4 h-4 mr-1" strokeWidth={1.5} />
                {t('courses.endDate')}
              </Label>
              <Input
                id="end_date"
                type="date"
                className="glass-input h-12"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                data-testid="course-end-date"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-white/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/courses')}
              className="flex-1 h-12 bg-white/50 border-white/40 hover:bg-white/80"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 btn-gradient"
              disabled={loading}
              data-testid="save-course-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('courses.saving')}
                </>
              ) : (
                isEdit ? t('courses.updateCourse') : t('courses.create')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseForm;
