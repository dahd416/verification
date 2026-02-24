import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
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
import { Users, Plus, Pencil, Trash2, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const UsersPage = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/api/users`, { headers: getAuthHeader() });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error(t('users.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '' });
    }
    setShowPassword(false);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast.error(t('users.fillRequired'));
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error(t('users.passwordRequired'));
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const updateData = { name: formData.name, email: formData.email };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await axios.put(`${API}/api/users/${editingUser.id}`, updateData, { headers: getAuthHeader() });
        toast.success(t('users.updated'));
      } else {
        await axios.post(`${API}/api/users`, formData, { headers: getAuthHeader() });
        toast.success(t('users.created'));
      }
      setShowDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.detail || t('users.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId) => {
    try {
      await axios.delete(`${API}/api/users/${userId}`, { headers: getAuthHeader() });
      toast.success(t('users.deleted'));
      setShowDeleteDialog(null);
      fetchUsers();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || t('users.deleteError'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="users-loading">
        <Skeleton className="h-10 w-48" />
        <div className="glass-card p-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full mb-3" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{t('users.title')}</h1>
          <p className="text-slate-500 mt-1">{t('users.subtitle')}</p>
        </div>
        <Button className="btn-gradient" onClick={() => handleOpenDialog()} data-testid="add-user-btn">
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
          {t('users.add')}
        </Button>
      </div>

      {/* Users List */}
      <div className="glass-card overflow-hidden">
        {users.length > 0 ? (
          <div className="glass-table">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">{t('users.name')}</th>
                  <th className="text-left">{t('users.email')}</th>
                  <th className="text-left">{t('users.role')}</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} data-testid={`user-row-${user.id}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <span className="text-white font-semibold">{user.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">{user.name}</span>
                          {user.is_base_admin && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Shield className="h-3 w-3 text-amber-500" />
                              <span className="text-xs text-amber-600">{t('users.baseAdmin')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-600 dark:text-slate-400">{user.email}</td>
                    <td>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium">
                        Admin
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(user)}
                          data-testid={`edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                        {!user.is_base_admin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => setShowDeleteDialog(user)}
                            data-testid={`delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        )}
                      </div>
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
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('users.empty')}</h3>
            <p className="text-slate-500">{t('users.emptyDesc')}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="glass-card border-white/40">
          <DialogHeader>
            <DialogTitle>{editingUser ? t('users.edit') : t('users.add')}</DialogTitle>
            <DialogDescription>
              {editingUser ? t('users.editDesc') : t('users.addDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('users.name')}</Label>
              <Input
                className="glass-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Juan Pérez"
                data-testid="user-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('users.email')}</Label>
              <Input
                type="email"
                className="glass-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="usuario@ejemplo.com"
                data-testid="user-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('users.password')} {editingUser && `(${t('users.leaveBlank')})`}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  className="glass-input pr-12"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '********' : t('auth.minCharacters')}
                  data-testid="user-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="bg-white/50 border-white/40">
              {t('common.cancel')}
            </Button>
            <Button className="btn-gradient" onClick={handleSave} disabled={saving} data-testid="save-user-btn">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent className="glass-card border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('users.deleteDesc', { name: showDeleteDialog?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/50 border-white/40">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(showDeleteDialog?.id)}
              className="bg-red-500 text-white hover:bg-red-600"
              data-testid="confirm-delete-user"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
