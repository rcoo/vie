import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.ts';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Activity,
  HardDrive,
  Globe,
  Cloud,
  MonitorPlay
} from 'lucide-react';
import type { Episode, VideoSource } from '../../types.ts';

interface Props {
  episode: Episode;
  onClose: () => void;
}

export const SourceManagerModal: React.FC<Props> = ({ episode, onClose }) => {
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [sourceType, setSourceType] = useState<string>('DIRECT_URL');
  const [sourceName, setSourceName] = useState('');
  const [urlOrFileId, setUrlOrFileId] = useState('');
  const [priority, setPriority] = useState(1);
  const [referer, setReferer] = useState('');
  const [origin, setOrigin] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [externalMode, setExternalMode] = useState<'VIDEO' | 'IFRAME'>('VIDEO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live test result map: sourceId -> result
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchSources = async () => {
    try {
      const res = await apiFetch(`/api/admin/sources/${episode.id}`);
      const data = await res.json();
      setSources(data);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [episode.id]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim() || !urlOrFileId.trim()) return;

    setIsSubmitting(true);
    const configuration: Record<string, any> = {};

    if (sourceType === 'GOOGLE_DRIVE') {
      configuration.driveFileId = urlOrFileId.trim();
    } else {
      configuration.url = urlOrFileId.trim();
      if (sourceType === 'DIRECT_URL') {
        if (referer.trim()) configuration.referer = referer.trim();
        if (origin.trim()) configuration.origin = origin.trim();
        if (mimeType.trim()) configuration.mimeType = mimeType.trim();
      }
      if (sourceType === 'EXTERNAL_PLAYER') {
        configuration.mode = externalMode;
      }
    }

    try {
      const res = await apiFetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: episode.id,
          type: sourceType,
          name: sourceName.trim(),
          priority: Number(priority) || 1,
          enabled: true,
          configuration
        })
      });

      if (res.ok) {
        setSourceName('');
        setUrlOrFileId('');
        setReferer('');
        setOrigin('');
        setMimeType('');
        setExternalMode('VIDEO');
        setShowAddForm(false);
        fetchSources();
      }
    } catch (err) {
      console.error('Failed to add source:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestSource = async (source: VideoSource) => {
    setTestingId(source.id);
    try {
      const res = await apiFetch(`/api/admin/sources/${source.id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [source.id]: data }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [source.id]: { success: false, message: err.message || 'Test failed' }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف مصدر الفيديو هذا؟')) return;
    try {
      await apiFetch(`/api/admin/sources/${id}`, { method: 'DELETE' });
      fetchSources();
    } catch (err) {
      console.error('Failed to delete source:', err);
    }
  };

  const handleToggleEnabled = async (source: VideoSource) => {
    try {
      await apiFetch(`/api/admin/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !source.enabled })
      });
      fetchSources();
    } catch (err) {
      console.error('Failed to toggle source:', err);
    }
  };

  const movePriority = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= sources.length) return;

    const newOrder = [...sources];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;

    setSources(newOrder);

    const orderedIds = newOrder.map((s) => s.id);
    await apiFetch('/api/admin/sources/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds })
    });
    fetchSources();
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'GOOGLE_DRIVE':
        return <HardDrive className="w-4 h-4 text-emerald-400" />;
      case 'DIRECT_URL':
        return <Globe className="w-4 h-4 text-blue-400" />;
      case 'EXTERNAL_PLAYER':
        return <MonitorPlay className="w-4 h-4 text-fuchsia-400" />;
      default:
        return <Cloud className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#111116] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>مصادر الفيديو للحلقة #{episode.episodeNumber}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70">
                {episode.title}
              </span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              يدعم النظام مصادر متعددة بنظام الأولوية والتبديل التلقائي عند انقطاع المصدر.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-white/50 font-bold">
              المصادر الحالية ({sources.length})
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مصدر جديد</span>
            </button>
          </div>

          {/* Add Source Form Drawer */}
          {showAddForm && (
            <form
              onSubmit={handleAddSource}
              className="p-4 rounded-xl bg-white/[0.04] border border-amber-500/30 space-y-3 animate-fade-in"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 font-medium mb-1">نوع المصدر</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="DIRECT_URL">Direct Video URL عبر السيرفر (Proxy)</option>
                    <option value="EXTERNAL_PLAYER">External Player — تشغيل مباشر من متصفح المشاهد</option>
                    <option value="GOOGLE_DRIVE">Google Drive (API / alt=media)</option>
                    <option value="S3">Amazon S3 Storage</option>
                    <option value="CLOUDFLARE_R2">Cloudflare R2</option>
                    <option value="CUSTOM_HTTP">Custom HTTP Stream</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/70 font-medium mb-1">اسم المصدر (تسمية)</label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="مثال: Google Drive Primary أو Fast CDN"
                    required
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/70 font-medium mb-1">
                  {sourceType === 'GOOGLE_DRIVE'
                    ? 'Google Drive File ID'
                    : sourceType === 'EXTERNAL_PLAYER'
                      ? 'رابط المشغل / الفيديو الخارجي'
                      : 'رابط الفيديو (Direct URL / Endpoint)'}
                </label>
                <input
                  type="text"
                  value={urlOrFileId}
                  onChange={(e) => setUrlOrFileId(e.target.value)}
                  placeholder={
                    sourceType === 'GOOGLE_DRIVE'
                      ? '1AbCdEfGhIjKlMnOp... أو رابط الملف'
                      : sourceType === 'EXTERNAL_PLAYER'
                        ? 'https://fs.example-cdn.net/stream/token/...'
                        : 'https://cdn.example.com/videos/episode1.mp4'
                  }
                  required
                  className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              {sourceType === 'EXTERNAL_PLAYER' && (
                <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-3 space-y-2">
                  <div className="text-[11px] text-white/60 leading-relaxed">
                    هذا النوع لا يمر عبر سيرفر CineVault. متصفح المشاهد يفتح المصدر مباشرة، وهو مناسب للروابط التي تعمل عند فتحها في المتصفح لكن ترفض Proxy السيرفر.
                  </div>
                  <label className="block text-xs text-white/70 font-medium">طريقة العرض</label>
                  <select
                    value={externalMode}
                    onChange={(e) => setExternalMode(e.target.value as 'VIDEO' | 'IFRAME')}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="VIDEO">داخل مشغل الموقع (HTML5 Video) — الأفضل لروابط الفيديو المباشرة</option>
                    <option value="IFRAME">مشغل خارجي داخل الصفحة (iframe) — لروابط صفحات/مشغلات Embed</option>
                  </select>
                  <div className="text-[10px] text-amber-300/80 leading-relaxed">
                    ملاحظة: مصدر External يصبح ظاهرًا لمتصفح المستخدم لأنه يتم تشغيله من جهازه مباشرة.
                  </div>
                </div>
              )}

              {sourceType === 'DIRECT_URL' && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                  <div className="text-[11px] text-white/55">
                    خيارات CDN المتقدمة — اتركها فارغة عادةً. استخدمها فقط إذا كان المصدر يشترط Referer/Origin أو MIME محدد.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="url"
                      value={referer}
                      onChange={(e) => setReferer(e.target.value)}
                      placeholder="Referer اختياري — https://example.com/"
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                    <input
                      type="url"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="Origin اختياري — https://example.com"
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    value={mimeType}
                    onChange={(e) => setMimeType(e.target.value)}
                    placeholder="MIME اختياري — video/mp4"
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/70">الأولوية:</label>
                  <input
                    type="number"
                    min={1}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                    className="w-16 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-xs text-white/70"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                  >
                    {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ المصدر'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Sources List */}
          {loading ? (
            <div className="py-8 text-center text-white/40">جارٍ تحميل المصادر...</div>
          ) : sources.length === 0 ? (
            <div className="py-8 text-center text-white/40">لا توجد مصادر فيديو مضافة لهذه الحلقة بعد.</div>
          ) : (
            sources.map((src, idx) => {
              const test = testResults[src.id];
              const isTesting = testingId === src.id;

              return (
                <div
                  key={src.id}
                  className={`p-4 rounded-xl border transition-all ${
                    src.enabled
                      ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                      : 'bg-white/[0.01] border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        {getSourceIcon(src.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{src.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/70">
                            {src.type}
                          </span>
                          <span className="text-[10px] text-amber-400/80 font-mono">
                            أولوية #{src.priority}
                          </span>
                        </div>
                        <div className="text-xs text-white/50 font-mono mt-0.5 truncate max-w-sm">
                          {src.configuration.driveFileId
                            ? `File ID: ${src.configuration.driveFileId}`
                            : src.configuration.url}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {/* Priority Up/Down */}
                      <button
                        onClick={() => movePriority(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-white/10 text-white/60 disabled:opacity-20"
                        title="رفع الأولوية"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => movePriority(idx, 'down')}
                        disabled={idx === sources.length - 1}
                        className="p-1 rounded hover:bg-white/10 text-white/60 disabled:opacity-20"
                        title="خفض الأولوية"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Live Test Button */}
                      <button
                        onClick={() => handleTestSource(src)}
                        disabled={isTesting}
                        className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                        title="اختبار جاهزية المصدر ودعم الـ Range"
                      >
                        {isTesting ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        ) : (
                          <Activity className="w-3 h-3 text-emerald-400" />
                        )}
                        <span>{isTesting ? 'جارٍ الفحص...' : 'Test Source'}</span>
                      </button>

                      {/* Enable/Disable */}
                      <button
                        onClick={() => handleToggleEnabled(src)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          src.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/40 hover:bg-white/10'
                        }`}
                      >
                        {src.enabled ? 'مفعل' : 'معطل'}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteSource(src.id)}
                        className="p-1 rounded text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Test Diagnostic Result Badge */}
                  {test && (
                    <div
                      className={`mt-3 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                        test.success
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/10 border border-red-500/20 text-red-300'
                      }`}
                    >
                      {test.success ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold">{test.message}</div>
                        <div className="text-[11px] opacity-80 mt-0.5 flex flex-wrap gap-x-3">
                          <span>زمن الاستجابة: {test.latencyMs}ms</span>
                          {test.rangeSupported !== undefined && (
                            <span>دعم HTTP Range: {test.rangeSupported ? 'نعم ✓' : 'لا ✕'}</span>
                          )}
                          {test.mimeType && <span>MIME: {test.mimeType}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
