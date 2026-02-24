import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { verifyAPI, diplomasAPI, settingsAPI } from '../lib/api';
import QRCode from 'react-qr-code';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  GraduationCap,
  User,
  Calendar,
  Clock,
  Building,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  Sparkles,
  Download,
  Loader2,
} from 'lucide-react';

const VerifyPage = () => {
  const { certificateId } = useParams();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    // Force light mode for verification page - remove dark class and save original state
    const wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    
    // Fetch public settings for logo
    fetchPublicSettings();
    
    if (certificateId) {
      verifyDiploma();
    }
    
    // Cleanup: restore dark mode preference when leaving
    return () => {
      document.documentElement.style.colorScheme = '';
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || wasDark) {
        document.documentElement.classList.add('dark');
      }
    };
  }, [certificateId]);

  const fetchPublicSettings = async () => {
    try {
      const response = await settingsAPI.getPublic();
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const verifyDiploma = async () => {
    try {
      const response = await verifyAPI.verify(certificateId);
      setData(response.data);
    } catch (err) {
      console.error('Verification error:', err);
      if (err.response?.status === 404) {
        setError('notFound');
      } else {
        setError('failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await diplomasAPI.downloadPdfPublic(certificateId);
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `certificado_${certificateId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(t('diplomas.downloadSuccess'));
    } catch (error) {
      console.error('Download error:', error);
      toast.error(t('diplomas.downloadError'));
    } finally {
      setDownloading(false);
    }
  };

  const verificationUrl = `${window.location.origin}/verify/${certificateId}`;
  const isValid = data?.status === 'valid';
  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4" data-testid="verify-loading">
        <div className="glass-card w-full max-w-2xl p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <Skeleton className="w-24 h-24 rounded-full" />
            </div>
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-4 w-48 mx-auto" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4" data-testid="verify-error">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {t('verify.notFound')}
          </h1>
          <p className="text-slate-500 mb-4">
            <code className="bg-white/60 px-3 py-1 rounded-lg text-indigo-600 font-mono text-sm">{certificateId}</code>
          </p>
          <p className="text-slate-500 mb-6">
            {t('verify.notFoundDesc')}
          </p>
          <a href="https://orviti.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="bg-white/50 border-white/40">
              <ExternalLink className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t('verify.visitOrviti')}
            </Button>
          </a>
        </div>
        
        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-200/50 bg-white/70 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
            © {currentYear} ORVITI. {t('verify.allRightsReserved')}
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col" data-testid="verify-page">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="https://orviti.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
            {settings?.login_logo_url ? (
              <img 
                src={settings.login_logo_url} 
                alt="ORVITI" 
                className="h-10 max-w-[200px] object-contain"
              />
            ) : (
              <>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Sparkles className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>
                <span className="font-bold text-xl text-slate-900">ORVITI</span>
              </>
            )}
          </a>
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 hidden sm:flex">
            {t('verify.title')}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 md:py-12 relative z-10 w-full">
        {/* Status Banner */}
        <div className={`bg-white/80 backdrop-blur-xl rounded-2xl border shadow-xl p-6 mb-8 ${isValid ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
              isValid 
                ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/30' 
                : 'bg-gradient-to-br from-red-400 to-rose-500 shadow-red-500/30'
            }`}>
              {isValid ? (
                <ShieldCheck className="w-8 h-8 text-white" strokeWidth={1.5} />
              ) : (
                <ShieldX className="w-8 h-8 text-white" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <h1 className={`text-2xl md:text-3xl font-bold ${isValid ? 'text-emerald-600' : 'text-red-600'}`}>
                {isValid ? t('verify.validCertificate') : t('verify.revokedCertificate')}
              </h1>
              <p className="text-slate-500">
                {isValid ? t('verify.validDesc') : t('verify.revokedDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Certificate Details Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-xl overflow-hidden">
          {/* Gradient accent bar */}
          <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          
          <div className="p-6 md:p-8">
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {/* Left: Certificate Info */}
              <div className="md:col-span-2 space-y-6">
                {/* Recipient */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 flex-shrink-0">
                    <User className="w-7 h-7 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t('verify.recipient')}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {data.recipient_name}
                    </p>
                  </div>
                </div>

                {/* Course */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
                    <GraduationCap className="w-7 h-7 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t('verify.courseCompleted')}</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {data.course_name}
                    </p>
                    {data.instructor && (
                      <p className="text-sm text-slate-500 mt-1">
                        {t('verify.instructor')}: {data.instructor}
                      </p>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Duration */}
                  {data.duration_hours > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-white/40 rounded-xl border border-white/40">
                      <Clock className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
                      <div>
                        <p className="text-xs text-slate-500">{t('verify.duration')}</p>
                        <p className="font-semibold text-slate-900">{data.duration_hours} {t('common.hours')}</p>
                      </div>
                    </div>
                  )}

                  {/* Issue Date */}
                  <div className="flex items-center gap-3 p-4 bg-white/40 rounded-xl border border-white/40">
                    <Calendar className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
                    <div>
                      <p className="text-xs text-slate-500">{t('verify.issuedDate')}</p>
                      <p className="font-semibold text-slate-900">
                        {new Date(data.issued_at).toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Organization */}
                  <div className="flex items-center gap-3 p-4 bg-white/40 rounded-xl border border-white/40 col-span-2">
                    <Building className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
                    <div>
                      <p className="text-xs text-slate-500">{t('verify.issuedBy')}</p>
                      <p className="font-semibold text-slate-900">{data.organization_name}</p>
                    </div>
                  </div>
                </div>

                {/* Certificate ID */}
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">{t('diplomas.certificateId')}</p>
                  <code className="text-lg font-mono font-bold text-indigo-600">{data.certificate_id}</code>
                </div>
              </div>

              {/* Right: QR Code */}
              <div className="flex flex-col items-center justify-center p-6 bg-white/40 rounded-xl border border-white/40">
                <div className="bg-white p-4 rounded-xl shadow-lg mb-4">
                  <QRCode
                    value={verificationUrl}
                    size={160}
                    level="H"
                  />
                </div>
                <p className="text-xs text-center text-slate-500">
                  {t('verify.scanToVerify')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center space-y-4">
          {/* Download PDF Button - only for valid certificates */}
          {isValid && (
            <Button 
              onClick={handleDownloadPdf} 
              className="btn-gradient"
              disabled={downloading}
              data-testid="download-pdf-btn"
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" strokeWidth={1.5} />
              )}
              {t('diplomas.downloadPdf')}
            </Button>
          )}
          
          <p className="text-sm text-slate-500">
            {t('verify.issuedByOrviti')}
          </p>
          <a href="https://orviti.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="bg-white/50 border-white/40">
              <ExternalLink className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {t('verify.visitOrviti')}
            </Button>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/50 bg-white/70 backdrop-blur-xl mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
          © {currentYear} ORVITI. {t('verify.allRightsReserved')}
        </div>
      </footer>
    </div>
  );
};

export default VerifyPage;
