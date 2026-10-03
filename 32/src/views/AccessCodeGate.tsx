import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Film, ShieldAlert, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

interface Props {
  onOpenAdmin: () => void;
}

export const AccessCodeGate: React.FC<Props> = ({ onOpenAdmin }) => {
  const { loginWithCode, settings } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('يرجى إدخال كود الدخول.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await loginWithCode(code);
    if (result.success && result.adminPortal) {
      setLoading(false);
      setCode('');
      onOpenAdmin();
      return;
    }
    if (!result.success) {
      setError(result.error || 'الكود غير صحيح أو منتهي.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0c] text-white flex flex-col justify-between overflow-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-amber-600/10 via-rose-600/5 to-transparent blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-indigo-900/10 blur-3xl rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* Top Brand Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 flex items-center justify-start">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.siteName}
              className="h-10 max-w-[160px] object-contain rounded-xl"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <span className="text-xl font-bold tracking-wider uppercase text-white font-mono">
              {settings.siteName || 'viE'}
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10">
              {settings.siteDescription || 'Private Stream'}
            </span>
          </div>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80 relative overflow-hidden">
            {/* Subtle top edge glow */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 font-mono">
                ENTER ACCESS CODE
              </h1>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                منصة خاصة ومحمية. أدخل رمز الوصول الممنوح لك للمتابعة.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/70 font-medium mb-2">
                  Access Code / كود الدخول
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    placeholder="أدخل الكود هنا..."
                    disabled={loading}
                    autoFocus
                    className="w-full bg-black/60 border border-white/15 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-4 py-3.5 text-center text-lg font-mono tracking-widest text-white placeholder-white/20 outline-none transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs sm:text-sm animate-shake">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                  <div className="flex-1 font-medium">{error}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full group bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 disabled:opacity-50 text-black font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                    <span>جارٍ التحقق...</span>
                  </>
                ) : (
                  <>
                    <span>Continue / متابعة</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-white/40 leading-relaxed">
              يتم إنشاء وتفعيل وتحديد صلاحية الأكواد حصرياً من قبل إدارة المنصة.
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer info */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-white/40 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Encrypted High-Performance Streaming Platform</span>
        </div>
        <div>
          <span>Protected Access Code Gateway</span>
        </div>
      </footer>
    </div>
  );
};
