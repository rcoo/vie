import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, Layers, Eye, EyeOff } from 'lucide-react';
import type { Series } from '../../types.ts';
import { SeasonEpisodeModal } from './SeasonEpisodeModal.tsx';
import { apiFetch } from '../../lib/api.ts';

export const SeriesTab: React.FC = () => {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);

  // Manage Seasons & Episodes modal
  const [selectedSeriesForEpisodes, setSelectedSeriesForEpisodes] = useState<Series | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [poster, setPoster] = useState('');
  const [backdrop, setBackdrop] = useState('');
  const [status, setStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');

  const fetchSeries = async () => {
    try {
      const res = await apiFetch('/api/admin/series');
      const data = await res.json();
      setSeriesList(data);
    } catch (err) {
      console.error('Failed to load series:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
  }, []);

  const resetForm = () => {
    setTitle('');
    setSlug('');
    setDescription('');
    setPoster('');
    setBackdrop('');
    setStatus('PUBLISHED');
    setEditingSeries(null);
    setShowAddForm(false);
  };

  const handleEditClick = (series: Series) => {
    setEditingSeries(series);
    setTitle(series.title);
    setSlug(series.slug);
    setDescription(series.description);
    setPoster(series.poster);
    setBackdrop(series.backdrop);
    setStatus(series.status);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;

    const payload = {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim(),
      poster: poster.trim(),
      backdrop: backdrop.trim(),
      status,
      sortOrder: editingSeries ? editingSeries.sortOrder : seriesList.length + 1
    };

    try {
      if (editingSeries) {
        await apiFetch(`/api/admin/series/${editingSeries.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/admin/series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      resetForm();
      fetchSeries();
    } catch (err) {
      console.error('Failed to save series:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المسلسل وجميع مواسمه وحلقاته؟')) return;
    try {
      await apiFetch(`/api/admin/series/${id}`, { method: 'DELETE' });
      fetchSeries();
    } catch (err) {
      console.error('Failed to delete series:', err);
    }
  };

  const handleToggleStatus = async (series: Series) => {
    const newStatus = series.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await apiFetch(`/api/admin/series/${series.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchSeries();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= seriesList.length) return;

    const list = [...seriesList];
    const item = list[index];
    list[index] = list[target];
    list[target] = item;
    setSeriesList(list);

    await apiFetch('/api/admin/series/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: list.map((s) => s.id) })
    });
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">إدارة المسلسلات ({seriesList.length})</h2>
          <p className="text-xs text-white/50">إنشاء وتعديل المسلسلات وترتيب ظهورها في الصفحة الرئيسية</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مسلسل جديد</span>
        </button>
      </div>

      {/* Add / Edit Form Modal / Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-2xl bg-white/[0.03] border border-amber-500/30 space-y-4 shadow-xl animate-fade-in"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">
              {editingSeries ? 'تعديل المسلسل' : 'إضافة مسلسل جديد'}
            </h3>
            <button type="button" onClick={resetForm} className="text-xs text-white/50 hover:text-white">
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/70 mb-1">عنوان المسلسل (Title)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!editingSeries) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }
                }}
                placeholder="Breaking Bad"
                required
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-white/70 mb-1">الاسم اللطيف (Slug للرابط)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="breaking-bad"
                required
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/70 mb-1">الوصف والقصة (Description)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="قصة المسلسل وأبطاله..."
              rows={3}
              className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/70 mb-1">رابط البوستر الرأسي (Poster URL)</label>
              <input
                type="text"
                value={poster}
                onChange={(e) => setPoster(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-white/70 mb-1">رابط الخلفية العريضة (Backdrop URL)</label>
              <input
                type="text"
                value={backdrop}
                onChange={(e) => setBackdrop(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/70">الحالة:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              >
                <option value="PUBLISHED">منشور للجمهور (Published)</option>
                <option value="DRAFT">مسودة مخفية (Draft)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md"
              >
                {editingSeries ? 'تحديث البيانات' : 'حفظ المسلسل'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Series Table / Cards */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-white/40">جارٍ تحميل المسلسلات...</div>
        ) : seriesList.length === 0 ? (
          <div className="p-8 text-center text-white/40">لا توجد مسلسلات بعد. قم بإضافة أول مسلسل!</div>
        ) : (
          <div className="divide-y divide-white/5">
            {seriesList.map((series, idx) => (
              <div
                key={series.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Poster Thumbnail */}
                  <img
                    src={series.poster || series.backdrop}
                    alt={series.title}
                    className="w-14 h-20 object-cover rounded-xl bg-black/60 border border-white/10 flex-shrink-0"
                  />

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-white">{series.title}</h3>
                      <button
                        onClick={() => handleToggleStatus(series)}
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                          series.status === 'PUBLISHED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {series.status === 'PUBLISHED' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{series.status === 'PUBLISHED' ? 'منشور' : 'مسودة'}</span>
                      </button>
                    </div>

                    <div className="text-xs text-white/50 line-clamp-1 max-w-xl">
                      {series.description}
                    </div>

                    <div className="text-[11px] text-white/40 font-mono mt-1">
                      Slug: /{series.slug} • الترتيب: #{series.sortOrder}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveOrder(idx, 'up')}
                      disabled={idx === 0}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/60 disabled:opacity-20 transition-colors"
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveOrder(idx, 'down')}
                      disabled={idx === seriesList.length - 1}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/60 disabled:opacity-20 transition-colors"
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Manage Seasons & Episodes Button */}
                  <button
                    onClick={() => setSelectedSeriesForEpisodes(series)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>المواسم والحلقات</span>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEditClick(series)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                    title="تعديل المسلسل"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(series.id)}
                    className="p-2 rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    title="حذف المسلسل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Season & Episode Manager Modal */}
      {selectedSeriesForEpisodes && (
        <SeasonEpisodeModal
          series={selectedSeriesForEpisodes}
          onClose={() => setSelectedSeriesForEpisodes(null)}
        />
      )}
    </div>
  );
};
