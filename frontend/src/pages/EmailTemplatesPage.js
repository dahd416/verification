import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { emailTemplatesAPI, uploadAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  Mail,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  Code,
  Star,
  Save,
  Loader2,
  Variable,
  X,
  ArrowLeft,
  Check,
  Image,
  Upload,
} from 'lucide-react';

// Available template variables
const TEMPLATE_VARIABLES = [
  { key: 'recipient_name', label: 'Nombre del destinatario', example: 'Juan Pérez' },
  { key: 'course_name', label: 'Nombre del curso', example: 'Curso de Ejemplo' },
  { key: 'instructor', label: 'Instructor', example: 'Dr. María González' },
  { key: 'duration_hours', label: 'Duración (horas)', example: '40' },
  { key: 'issue_date', label: 'Fecha de emisión', example: '24 de febrero, 2026' },
  { key: 'certificate_id', label: 'ID del certificado', example: 'CERT-XXXXX-XXXX' },
  { key: 'organization_name', label: 'Nombre de la organización', example: 'ORVITI Academy' },
];

const EmailTemplatesPage = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [activeTab, setActiveTab] = useState('editor');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageWidth, setImageWidth] = useState('200');
  const [imageAlt, setImageAlt] = useState('');
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    html_content: '',
    is_default: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await emailTemplatesAPI.getAll();
      setTemplates(response.data);
      // Select the default template if none selected
      if (!selectedTemplate && response.data.length > 0) {
        const defaultTemplate = response.data.find(t => t.is_default) || response.data[0];
        setSelectedTemplate(defaultTemplate);
        setFormData({
          name: defaultTemplate.name,
          subject: defaultTemplate.subject,
          html_content: defaultTemplate.html_content,
          is_default: defaultTemplate.is_default,
        });
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error(t('emailTemplates.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      html_content: template.html_content,
      is_default: template.is_default,
    });
    setIsEditing(false);
    setActiveTab('editor');
  };

  const handleCreateTemplate = async () => {
    setSaving(true);
    try {
      const newTemplate = {
        name: t('emailTemplates.newTemplateName'),
        subject: 'Tu diploma de {{course_name}} - {{organization_name}}',
        html_content: getDefaultHtmlTemplate(),
        is_default: templates.length === 0,
      };
      const response = await emailTemplatesAPI.create(newTemplate);
      setTemplates([...templates, response.data]);
      setSelectedTemplate(response.data);
      setFormData({
        name: response.data.name,
        subject: response.data.subject,
        html_content: response.data.html_content,
        is_default: response.data.is_default,
      });
      setIsEditing(true);
      toast.success(t('emailTemplates.created'));
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error(t('emailTemplates.createError'));
    } finally {
      setSaving(false);
      setShowNewDialog(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    
    setSaving(true);
    try {
      const response = await emailTemplatesAPI.update(selectedTemplate.id, formData);
      setTemplates(templates.map(t => 
        t.id === selectedTemplate.id ? response.data : 
        (formData.is_default ? { ...t, is_default: false } : t)
      ));
      setSelectedTemplate(response.data);
      setIsEditing(false);
      toast.success(t('emailTemplates.saved'));
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(t('emailTemplates.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateTemplate = async (template) => {
    try {
      const response = await emailTemplatesAPI.duplicate(template.id);
      setTemplates([...templates, response.data]);
      toast.success(t('emailTemplates.duplicated'));
    } catch (error) {
      console.error('Failed to duplicate template:', error);
      toast.error(t('emailTemplates.duplicateError'));
    }
  };

  const handleDeleteTemplate = async (template) => {
    try {
      await emailTemplatesAPI.delete(template.id);
      const newTemplates = templates.filter(t => t.id !== template.id);
      setTemplates(newTemplates);
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(newTemplates[0] || null);
        if (newTemplates[0]) {
          setFormData({
            name: newTemplates[0].name,
            subject: newTemplates[0].subject,
            html_content: newTemplates[0].html_content,
            is_default: newTemplates[0].is_default,
          });
        }
      }
      toast.success(t('emailTemplates.deleted'));
    } catch (error) {
      console.error('Failed to delete template:', error);
      const errorMsg = error.response?.data?.detail || t('emailTemplates.deleteError');
      toast.error(errorMsg);
    } finally {
      setShowDeleteDialog(null);
    }
  };

  const handlePreview = async () => {
    try {
      const response = await emailTemplatesAPI.preview({ html_content: formData.html_content });
      setPreviewHtml(response.data.preview_html);
      setActiveTab('preview');
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast.error(t('emailTemplates.previewError'));
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('emailTemplates.invalidImageType'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('emailTemplates.imageTooLarge'));
      return;
    }

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      
      const response = await uploadAPI.upload(formDataUpload);
      const imageUrl = response.data.url;
      
      // Insert image tag at cursor position
      const textarea = document.getElementById('html-editor');
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.html_content;
        const width = imageWidth || '200';
        const alt = imageAlt || file.name.split('.')[0];
        const imageTag = `<img src="${imageUrl}" alt="${alt}" width="${width}" style="max-width: 100%; height: auto; display: block;" />`;
        const newText = text.substring(0, start) + imageTag + text.substring(end);
        setFormData({ ...formData, html_content: newText });
        
        toast.success(t('emailTemplates.imageInserted'));
        
        // Restore cursor position
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + imageTag.length;
          textarea.focus();
        }, 0);
      }
      
      setShowImageDialog(false);
      setImageWidth('200');
      setImageAlt('');
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error(t('emailTemplates.imageUploadError'));
    } finally {
      setUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('html-editor');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.html_content;
      const variableText = `{{${variable}}}`;
      const newText = text.substring(0, start) + variableText + text.substring(end);
      setFormData({ ...formData, html_content: newText });
      
      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variableText.length;
        textarea.focus();
      }, 0);
    }
  };

  const getDefaultHtmlTemplate = () => {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0;">
                    <tr>
                        <td style="padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">¡Felicidades!</h1>
                        </td>
                    </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Hola {{recipient_name}},</h2>
                            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Has completado exitosamente el curso:
                            </p>
                            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                                <h3 style="color: #6366f1; margin: 0 0 10px 0; font-size: 20px;">{{course_name}}</h3>
                                <p style="color: #6b7280; margin: 5px 0;"><strong>Instructor:</strong> {{instructor}}</p>
                                <p style="color: #6b7280; margin: 5px 0;"><strong>Duración:</strong> {{duration_hours}} horas</p>
                                <p style="color: #6b7280; margin: 5px 0;"><strong>Fecha:</strong> {{issue_date}}</p>
                            </div>
                            <p style="color: #6b7280; margin: 0 0 10px 0;"><strong>ID del Certificado:</strong></p>
                            <code style="background-color: #e0e7ff; padding: 8px 12px; border-radius: 6px; font-size: 14px; color: #4f46e5;">{{certificate_id}}</code>
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                                Adjunto encontrarás tu diploma en formato PDF.
                            </p>
                        </td>
                    </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 20px; text-align: center;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                {{organization_name}}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="email-templates-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid lg:grid-cols-4 gap-6">
          <Skeleton className="h-96" />
          <div className="lg:col-span-3">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-templates-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('emailTemplates.title')}
          </h1>
          <p className="text-slate-500 mt-1">{t('emailTemplates.subtitle')}</p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="btn-gradient" data-testid="new-template-btn">
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
          {t('emailTemplates.newTemplate')}
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Templates List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-2">
            {t('emailTemplates.myTemplates')}
          </h3>
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTemplate?.id === template.id
                  ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'bg-white/80 dark:bg-slate-800/80'
              }`}
              onClick={() => handleSelectTemplate(template)}
              data-testid={`template-card-${template.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Mail className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                        {template.name}
                      </h4>
                      {template.is_default && (
                        <Badge className="mt-1 bg-amber-100 text-amber-700 border-amber-200 text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          {t('emailTemplates.default')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-card border-white/40">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateTemplate(template); }}>
                        <Copy className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        {t('common.duplicate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(template); }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Editor */}
        {selectedTemplate && (
          <div className="lg:col-span-3">
            <Card className="glass-card">
              <CardHeader className="border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{formData.name}</CardTitle>
                    <CardDescription>{t('emailTemplates.editDescription')}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFormData({
                            name: selectedTemplate.name,
                            subject: selectedTemplate.subject,
                            html_content: selectedTemplate.html_content,
                            is_default: selectedTemplate.is_default,
                          });
                          setIsEditing(false);
                        }}
                        className="bg-white/50 border-white/40"
                      >
                        <X className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        {t('common.cancel')}
                      </Button>
                    )}
                    <Button
                      onClick={isEditing ? handleSaveTemplate : () => setIsEditing(true)}
                      className={isEditing ? 'btn-gradient' : 'bg-white/50 border-white/40'}
                      variant={isEditing ? 'default' : 'outline'}
                      disabled={saving}
                      data-testid="save-template-btn"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isEditing ? (
                        <Save className="mr-2 h-4 w-4" strokeWidth={1.5} />
                      ) : (
                        <Edit className="mr-2 h-4 w-4" strokeWidth={1.5} />
                      )}
                      {isEditing ? t('common.save') : t('common.edit')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Template Name & Default Switch */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('emailTemplates.templateName')}</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!isEditing}
                      className="glass-input"
                      data-testid="template-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('emailTemplates.setAsDefault')}</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Switch
                        checked={formData.is_default}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                        disabled={!isEditing}
                        data-testid="default-switch"
                      />
                      <span className="text-sm text-slate-500">
                        {formData.is_default ? t('emailTemplates.isDefault') : t('emailTemplates.notDefault')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label>{t('emailTemplates.subject')}</Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    disabled={!isEditing}
                    className="glass-input"
                    placeholder={t('emailTemplates.subjectPlaceholder')}
                    data-testid="subject-input"
                  />
                  <p className="text-xs text-slate-500">{t('emailTemplates.subjectHelp')}</p>
                </div>

                {/* Variables Reference */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Variable className="h-4 w-4" strokeWidth={1.5} />
                    {t('emailTemplates.availableVariables')}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <Badge
                        key={v.key}
                        className={`cursor-pointer transition-all ${
                          isEditing 
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                        onClick={() => isEditing && insertVariable(v.key)}
                        title={`${v.label}: ${v.example}`}
                      >
                        {`{{${v.key}}}`}
                      </Badge>
                    ))}
                    {/* Insert Image Button */}
                    <Badge
                      className={`cursor-pointer transition-all ${
                        isEditing 
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                      onClick={() => isEditing && setShowImageDialog(true)}
                      data-testid="insert-image-btn"
                    >
                      <Image className="mr-1 h-3 w-3" strokeWidth={1.5} />
                      {t('emailTemplates.insertImage')}
                    </Badge>
                  </div>
                </div>

                {/* Editor Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-slate-100 dark:bg-slate-800">
                    <TabsTrigger value="editor" className="flex items-center gap-2">
                      <Code className="h-4 w-4" strokeWidth={1.5} />
                      {t('emailTemplates.htmlEditor')}
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="flex items-center gap-2" onClick={handlePreview}>
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                      {t('emailTemplates.preview')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor" className="mt-4">
                    <div className="space-y-2">
                      <Label>{t('emailTemplates.htmlContent')}</Label>
                      <Textarea
                        id="html-editor"
                        value={formData.html_content}
                        onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                        disabled={!isEditing}
                        className="glass-input font-mono text-sm min-h-[400px]"
                        placeholder={t('emailTemplates.htmlPlaceholder')}
                        data-testid="html-editor"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="mt-4">
                    <div className="border rounded-xl overflow-hidden bg-white">
                      <div className="bg-slate-100 px-4 py-2 border-b flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400" />
                          <div className="w-3 h-3 rounded-full bg-yellow-400" />
                          <div className="w-3 h-3 rounded-full bg-green-400" />
                        </div>
                        <span className="text-xs text-slate-500 ml-2">{t('emailTemplates.previewTitle')}</span>
                      </div>
                      <div className="p-4 max-h-[500px] overflow-auto">
                        {previewHtml ? (
                          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        ) : (
                          <div className="text-center py-12 text-slate-500">
                            <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" strokeWidth={1} />
                            <p>{t('emailTemplates.clickPreview')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* New Template Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="glass-card border-white/40">
          <DialogHeader>
            <DialogTitle>{t('emailTemplates.createNew')}</DialogTitle>
            <DialogDescription>{t('emailTemplates.createNewDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)} className="bg-white/50 border-white/40">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateTemplate} className="btn-gradient" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {t('emailTemplates.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent className="glass-card border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('emailTemplates.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('emailTemplates.deleteDesc', { name: showDeleteDialog?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/50 border-white/40">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteTemplate(showDeleteDialog)}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Insert Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="glass-card border-white/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
              {t('emailTemplates.insertImageTitle')}
            </DialogTitle>
            <DialogDescription>{t('emailTemplates.insertImageDesc')}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Image Width */}
            <div className="space-y-2">
              <Label>{t('emailTemplates.imageWidth')}</Label>
              <Input
                type="number"
                value={imageWidth}
                onChange={(e) => setImageWidth(e.target.value)}
                placeholder="200"
                className="glass-input"
                min="50"
                max="600"
              />
              <p className="text-xs text-slate-500">{t('emailTemplates.imageWidthHelp')}</p>
            </div>

            {/* Alt Text */}
            <div className="space-y-2">
              <Label>{t('emailTemplates.imageAlt')}</Label>
              <Input
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder={t('emailTemplates.imageAltPlaceholder')}
                className="glass-input"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>{t('emailTemplates.selectImage')}</Label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.svg,.jpg,.jpeg,image/png,image/svg+xml,image/jpeg"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                  disabled={uploadingImage}
                />
                <label 
                  htmlFor="image-upload" 
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Upload className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
                  )}
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {uploadingImage ? t('emailTemplates.uploading') : t('emailTemplates.clickToUpload')}
                  </span>
                  <span className="text-xs text-slate-400">PNG, SVG, JPG (max 5MB)</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowImageDialog(false)} 
              className="bg-white/50 border-white/40"
              disabled={uploadingImage}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplatesPage;
