import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { templatesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
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
import { Plus, FileText, Edit, Trash2, Copy, MoreVertical, Image } from 'lucide-react';

const Templates = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getAll();
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error(t('templates.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await templatesAPI.delete(deleteId);
      toast.success(t('templates.deleted'));
      setTemplates(templates.filter(t => t.id !== deleteId));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('templates.deleteError'));
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const response = await templatesAPI.duplicate(id);
      toast.success(t('templates.duplicated'));
      setTemplates([...templates, response.data]);
    } catch (error) {
      console.error('Duplicate error:', error);
      toast.error(t('templates.duplicateError'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="templates-loading">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card overflow-hidden">
              <Skeleton className="h-44 w-full" />
              <div className="p-4">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="templates-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('templates.title')}</h1>
          <p className="text-slate-500 mt-1">{t('templates.subtitle')}</p>
        </div>
        <Link to="/templates/new">
          <Button className="btn-gradient" data-testid="create-template-btn">
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            {t('templates.new')}
          </Button>
        </Link>
      </div>

      {/* Template Grid */}
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div 
              key={template.id} 
              className="glass-card overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              data-testid={`template-card-${template.id}`}
            >
              {/* Preview */}
              <div className="aspect-[16/11] bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 relative overflow-hidden">
                {template.background_image_url ? (
                  <img
                    src={template.background_image_url}
                    alt={template.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image className="w-16 h-16 text-slate-300 dark:text-slate-600" strokeWidth={1} />
                  </div>
                )}
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute top-3 right-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 hover:bg-white shadow-lg">
                          <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-card border-white/40">
                        <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                          <Copy className="mr-2 h-4 w-4" strokeWidth={1.5} />
                          {t('common.duplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(template.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{template.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {template.fields_config?.length || 0} {t('templates.fields')} • {template.canvas_width}x{template.canvas_height}
                    </p>
                  </div>
                  <Link to={`/templates/${template.id}/edit`}>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-white/50 border-white/40 hover:bg-white/80"
                      data-testid={`edit-template-${template.id}`}
                    >
                      <Edit className="mr-1 h-3 w-3" strokeWidth={1.5} />
                      {t('common.edit')}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('templates.empty')}</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            {t('templates.emptyDesc')}
          </p>
          <Link to="/templates/new">
            <Button className="btn-gradient">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t('templates.createFirst')}
            </Button>
          </Link>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="glass-card border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('templates.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('templates.deleteDesc')}
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

export default Templates;
