import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { coursesAPI, templatesAPI, recipientsAPI, diplomasAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  Award,
  GraduationCap,
  FileText,
  Users,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Scroll,
  Sparkles,
} from 'lucide-react';

const GenerateDiplomas = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const [courses, setCourses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [recipients, setRecipients] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [generatedDiplomas, setGeneratedDiplomas] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchRecipients();
    }
  }, [selectedCourse]);

  const fetchData = async () => {
    try {
      const [coursesRes, templatesRes] = await Promise.all([
        coursesAPI.getAll(),
        templatesAPI.getAll(),
      ]);
      setCourses(coursesRes.data);
      setTemplates(templatesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(t('generate.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const response = await recipientsAPI.getAll(selectedCourse);
      setRecipients(response.data);
      setSelectedRecipients(response.data.map(r => r.id));
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCourse || !selectedTemplate || selectedRecipients.length === 0) {
      toast.error(t('generate.completeSelections'));
      return;
    }

    setGenerating(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const response = await diplomasAPI.generate({
        course_id: selectedCourse,
        template_id: selectedTemplate,
        recipient_ids: selectedRecipients,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.data.generated > 0) {
        setGeneratedDiplomas(response.data.diplomas);
        toast.success(t('generate.success', { count: response.data.generated }));
        setStep(4);
      } else {
        toast.info(t('generate.noNew'));
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(t('generate.error'));
      clearInterval(progressInterval);
    } finally {
      setGenerating(false);
    }
  };

  const toggleRecipient = (id) => {
    setSelectedRecipients(prev =>
      prev.includes(id)
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  const toggleAllRecipients = () => {
    if (selectedRecipients.length === recipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(recipients.map(r => r.id));
    }
  };

  const selectedCourseName = courses.find(c => c.id === selectedCourse)?.name;
  const selectedTemplateName = templates.find(t => t.id === selectedTemplate)?.name;

  const steps = [
    { num: 1, label: t('nav.courses'), icon: GraduationCap },
    { num: 2, label: t('nav.templates'), icon: FileText },
    { num: 3, label: t('nav.recipients'), icon: Users },
    { num: 4, label: t('generate.complete'), icon: CheckCircle2 },
  ];

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6" data-testid="generate-loading">
        <Skeleton className="h-10 w-64" />
        <div className="glass-card p-8">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="generate-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('generate.title')}</h1>
        <p className="text-slate-500 mt-1">{t('generate.subtitle')}</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    step >= s.num
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30'
                      : 'bg-white/40 border border-white/60'
                  }`}
                >
                  {step > s.num ? (
                    <CheckCircle2 className={`w-6 h-6 ${step >= s.num ? 'text-white' : 'text-slate-400'}`} strokeWidth={1.5} />
                  ) : (
                    <Icon className={`w-6 h-6 ${step >= s.num ? 'text-white' : 'text-slate-400'}`} strokeWidth={1.5} />
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium ${step >= s.num ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < 3 && (
                <div className={`w-12 sm:w-24 h-0.5 mx-2 ${step > s.num ? 'bg-indigo-500' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Select Course */}
      {step === 1 && (
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <GraduationCap className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('generate.selectCourse')}</h2>
              <p className="text-slate-500 text-sm">{t('generate.selectCourseDesc')}</p>
            </div>
          </div>

          {courses.length > 0 ? (
            <div className="space-y-4">
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="glass-input h-12" data-testid="select-course">
                  <SelectValue placeholder={t('recipients.selectCourse')} />
                </SelectTrigger>
                <SelectContent className="glass-card border-white/40">
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} ({course.recipient_count} {t('recipients.title').toLowerCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full btn-gradient h-12"
                onClick={() => setStep(2)}
                disabled={!selectedCourse}
                data-testid="next-step-1"
              >
                {t('common.continue')} <ChevronRight className="ml-2 w-5 h-5" strokeWidth={1.5} />
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-slate-500 mb-4">{t('generate.noCourses')}</p>
              <Button variant="outline" onClick={() => navigate('/courses/new')} className="bg-white/50 border-white/40">
                {t('courses.createFirst')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Template */}
      {step === 2 && (
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <FileText className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('generate.selectTemplate')}</h2>
              <p className="text-slate-500 text-sm">{t('generate.selectTemplateDesc')}</p>
            </div>
          </div>

          {templates.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`cursor-pointer rounded-xl border-2 p-2 transition-all ${
                      selectedTemplate === template.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-500/20'
                        : 'border-white/40 hover:border-indigo-300 bg-white/30'
                    }`}
                    data-testid={`template-option-${template.id}`}
                  >
                    <div className="aspect-[16/11] bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg overflow-hidden mb-2">
                      {template.background_image_url ? (
                        <img
                          src={template.background_image_url}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-10 h-10 text-slate-300" strokeWidth={1} />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-center text-slate-700 truncate">{template.name}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 bg-white/50 border-white/40">
                  {t('common.back')}
                </Button>
                <Button
                  className="flex-1 btn-gradient"
                  onClick={() => setStep(3)}
                  disabled={!selectedTemplate}
                  data-testid="next-step-2"
                >
                  {t('common.continue')} <ChevronRight className="ml-2 w-5 h-5" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-slate-500 mb-4">{t('generate.noTemplates')}</p>
              <Button variant="outline" onClick={() => navigate('/templates/new')} className="bg-white/50 border-white/40">
                {t('templates.createFirst')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Select Recipients */}
      {step === 3 && (
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Users className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('generate.selectRecipients')}</h2>
              <p className="text-slate-500 text-sm">{t('generate.selectRecipientsDesc')}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-white/40 rounded-xl border border-white/40 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">{t('nav.courses')}:</span>
                <span className="ml-2 font-medium text-slate-900">{selectedCourseName}</span>
              </div>
              <div>
                <span className="text-slate-500">{t('nav.templates')}:</span>
                <span className="ml-2 font-medium text-slate-900">{selectedTemplateName}</span>
              </div>
            </div>
          </div>

          {recipients.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/30 rounded-xl border border-white/40">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedRecipients.length === recipients.length}
                    onCheckedChange={toggleAllRecipients}
                    data-testid="select-all-recipients"
                  />
                  <span className="text-sm font-medium text-slate-700">{t('common.selectAll')}</span>
                </div>
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                  {selectedRecipients.length} {t('common.selected')}
                </Badge>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      selectedRecipients.includes(recipient.id)
                        ? 'bg-indigo-50/50 border border-indigo-200'
                        : 'bg-white/30 border border-white/40 hover:bg-white/50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedRecipients.includes(recipient.id)}
                      onCheckedChange={() => toggleRecipient(recipient.id)}
                      data-testid={`recipient-checkbox-${recipient.id}`}
                    />
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{recipient.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{recipient.email}</p>
                    </div>
                  </div>
                ))}
              </div>

              {generating && (
                <div className="space-y-3 p-6 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-indigo-700">
                      {t('generate.generating')}
                    </span>
                    <span className="text-sm font-semibold text-indigo-600">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500 pt-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>
                      {t('generate.creatingCertificates', { count: selectedRecipients.length })}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 bg-white/50 border-white/40" disabled={generating}>
                  {t('common.back')}
                </Button>
                <Button
                  className="flex-1 btn-gradient"
                  onClick={handleGenerate}
                  disabled={selectedRecipients.length === 0 || generating}
                  data-testid="generate-btn"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                      {t('generate.generating')}...
                    </>
                  ) : (
                    <>
                      <Award className="mr-2 w-5 h-5" strokeWidth={1.5} />
                      {t('generate.generateCount', { count: selectedRecipients.length })}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-slate-500 mb-4">{t('generate.noRecipients')}</p>
              <Button variant="outline" onClick={() => navigate('/recipients')} className="bg-white/50 border-white/40">
                {t('recipients.add')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="glass-card p-12 text-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30">
            <Sparkles className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {t('generate.successTitle')}
          </h2>
          <p className="text-slate-500 text-lg mb-8">
            {t('generate.successDesc', { count: generatedDiplomas.length, course: selectedCourseName })}
          </p>

          {generatedDiplomas.length > 0 && (
            <div className="max-w-md mx-auto mb-8 text-left">
              <p className="text-sm font-semibold text-slate-700 mb-3">{t('generate.generatedCerts')}:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {generatedDiplomas.map((diploma) => (
                  <div key={diploma.id} className="flex items-center gap-3 p-3 bg-white/40 rounded-xl border border-white/40">
                    <Scroll className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-slate-700 truncate flex-1">{diploma.recipient_name}</span>
                    <Badge className="bg-indigo-100 text-indigo-600 border-indigo-200 text-xs font-mono">
                      {diploma.certificate_id}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <Button 
              variant="outline" 
              onClick={() => { setStep(1); setGeneratedDiplomas([]); }}
              className="bg-white/50 border-white/40"
            >
              {t('generate.generateMore')}
            </Button>
            <Button className="btn-gradient" onClick={() => navigate('/diplomas')} data-testid="view-diplomas-btn">
              {t('generate.viewAll')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateDiplomas;
