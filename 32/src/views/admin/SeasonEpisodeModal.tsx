import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.ts';
import {
  X,
  Plus,
  Trash2,
  Video,
  Layers,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import type { Series, Season, Episode } from '../../types.ts';
import { SourceManagerModal } from './SourceManagerModal.tsx';

interface Props {
  series: Series;
  onClose: () => void;
}

export const SeasonEpisodeModal: React.FC<Props> = ({ series, onClose }) => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Modals & sub-drawers
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState(1);
  const [newSeasonTitle, setNewSeasonTitle] = useState('');

  const [showAddEpisode, setShowAddEpisode] = useState(false);
  const [newEpNumber, setNewEpNumber] = useState(1);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpDesc, setNewEpDesc] = useState('');
  const [newEpThumb, setNewEpThumb] = useState('');
  const [newEpDuration, setNewEpDuration] = useState(2400);

  // Active episode for source manager
  const [sourceEditingEpisode, setSourceEditingEpisode] = useState<Episode | null>(null);

  const fetchSeasons = async () => {
    try {
      const res = await apiFetch(`/api/admin/seasons/${series.id}`);
      const data = await res.json();
      setSeasons(data);
      if (data.length > 0 && !selectedSeasonId) {
        setSelectedSeasonId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load seasons:', err);
    } finally {
      setLoadingSeasons(false);
    }
  };

  const fetchEpisodes = async (seasonId: string) => {
    if (!seasonId) return;
    setLoadingEpisodes(true);
    try {
      const res = await apiFetch(`/api/admin/episodes/${seasonId}`);
      const data = await res.json();
      setEpisodes(data);
      setNewEpNumber(data.length + 1);
    } catch (err) {
      console.error('Failed to load episodes:', err);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  useEffect(() => {
    fetchSeasons();
  }, [series.id]);

  useEffect(() => {
    if (selectedSeasonId) {
      fetchEpisodes(selectedSeasonId);
    }
  }, [selectedSeasonId]);

  // Season handlers
  const handleAddSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: series.id,
          seasonNumber: Number(newSeasonNumber),
          title: newSeasonTitle || `الموسم ${newSeasonNumber}`,
          sortOrder: seasons.length + 1
        })
      });
      if (res.ok) {
        const created = await res.json();
        setShowAddSeason(false);
        setNewSeasonTitle('');
        await fetchSeasons();
        setSelectedSeasonId(created.id);
      }
    } catch (err) {
      console.error('Failed to create season:', err);
    }
  };

  const handleDeleteSeason = async (id: string) => {
    if (!confirm('حذف هذا الموسم سيحذف جميع حلقاته ومصادرها. هل أنت متأكد؟')) return;
    try {
      await apiFetch(`/api/admin/seasons/${id}`, { method: 'DELETE' });
      await fetchSeasons();
    } catch (err) {
      console.error('Failed to delete season:', err);
    }
  };

  // Episode handlers
  const handleAddEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeasonId) return;

    try {
      const res = await apiFetch('/api/admin/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: selectedSeasonId,
          episodeNumber: Number(newEpNumber),
          title: newEpTitle,
          description: newEpDesc,
          thumbnail: newEpThumb,
          duration: Number(newEpDuration),
          published: true,
          sortOrder: episodes.length + 1
        })
      });

      if (res.ok) {
        setShowAddEpisode(false);
        setNewEpTitle('');
        setNewEpDesc('');
        setNewEpThumb('');
        fetchEpisodes(selectedSeasonId);
      }
    } catch (err) {
      console.error('Failed to create episode:', err);
    }
  };

  const handleDeleteEpisode = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الحلقة؟')) return;
    try {
      await apiFetch(`/api/admin/episodes/${id}`, { method: 'DELETE' });
      if (selectedSeasonId) fetchEpisodes(selectedSeasonId);
    } catch (err) {
      console.error('Failed to delete episode:', err);
    }
  };

  const handleTogglePublishEpisode = async (ep: Episode) => {
    try {
      await apiFetch(`/api/admin/episodes/${ep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !ep.published })
      });
      if (selectedSeasonId) fetchEpisodes(selectedSeasonId);
    } catch (err) {
      console.error('Failed to toggle published:', err);
    }
  };

  const reorderEpisodes = async (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= episodes.length) return;

    const list = [...episodes];
    const item = list[index];
    list[index] = list[target];
    list[target] = item;
    setEpisodes(list);

    await apiFetch('/api/admin/episodes/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: list.map((e) => e.id) })
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl bg-[#101015] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">إدارة مواسم وحلقات: {series.title}</h3>
              <p className="text-xs text-white/50">إضافة المواسم وترتيب الحلقات وربط مصادر الفيديو</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seasons Row */}
        <div className="px-6 py-3 border-b border-white/10 bg-white/[0.01] flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-white/40 font-bold ml-2">المواسم:</span>
            {seasons.map((season) => (
              <div key={season.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => setSelectedSeasonId(season.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedSeasonId === season.id
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {season.title || `الموسم ${season.seasonNumber}`}
                </button>
                <button
                  onClick={() => handleDeleteSeason(season.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                  title="حذف الموسم"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            <button
              onClick={() => {
                setNewSeasonNumber(seasons.length + 1);
                setShowAddSeason(true);
              }}
              className="px-3 py-1.5 rounded-xl border border-dashed border-white/20 hover:border-amber-500/50 text-xs text-white/60 hover:text-white flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>موسم جديد</span>
            </button>
          </div>
        </div>

        {/* Add Season Drawer */}
        {showAddSeason && (
          <form onSubmit={handleAddSeason} className="px-6 py-3 bg-amber-500/5 border-b border-amber-500/20 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">رقم الموسم:</span>
              <input
                type="number"
                min={1}
                value={newSeasonNumber}
                onChange={(e) => setNewSeasonNumber(parseInt(e.target.value, 10))}
                className="w-16 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={newSeasonTitle}
                onChange={(e) => setNewSeasonTitle(e.target.value)}
                placeholder="عنوان الموسم (اختياري)..."
                className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1 text-xs text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddSeason(false)}
                className="px-3 py-1 rounded text-xs text-white/60"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                إنشاء الموسم
              </button>
            </div>
          </form>
        )}

        {/* Episodes Header and List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-white/50 font-bold">
              حلقات الموسم المحدد ({episodes.length})
            </span>
            <button
              onClick={() => setShowAddEpisode(!showAddEpisode)}
              disabled={!selectedSeasonId}
              className="text-xs px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-1.5 transition-colors disabled:opacity-30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة حلقة جديدة</span>
            </button>
          </div>

          {/* Add Episode Form Drawer */}
          {showAddEpisode && (
            <form onSubmit={handleAddEpisode} className="p-4 rounded-2xl bg-white/[0.04] border border-amber-500/30 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">رقم الحلقة</label>
                  <input
                    type="number"
                    min={1}
                    value={newEpNumber}
                    onChange={(e) => setNewEpNumber(parseInt(e.target.value, 10))}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/70 mb-1">عنوان الحلقة</label>
                  <input
                    type="text"
                    value={newEpTitle}
                    onChange={(e) => setNewEpTitle(e.target.value)}
                    placeholder="مثال: Pilot"
                    required
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-1">الوصف</label>
                <textarea
                  value={newEpDesc}
                  onChange={(e) => setNewEpDesc(e.target.value)}
                  placeholder="ملخص أحداث الحلقة..."
                  rows={2}
                  className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">صورة مصغرة (Thumbnail URL)</label>
                  <input
                    type="text"
                    value={newEpThumb}
                    onChange={(e) => setNewEpThumb(e.target.value)}
                    placeholder="https://... أو مسار الصورة"
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">المدة بالثواني (Duration Seconds)</label>
                  <input
                    type="number"
                    min={0}
                    value={newEpDuration}
                    onChange={(e) => setNewEpDuration(parseInt(e.target.value, 10))}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEpisode(false)}
                  className="px-3 py-1.5 rounded text-xs text-white/60"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  حفظ الحلقة
                </button>
              </div>
            </form>
          )}

          {/* Episodes List */}
          {loadingEpisodes ? (
            <div className="py-8 text-center text-white/40">جارٍ تحميل الحلقات...</div>
          ) : episodes.length === 0 ? (
            <div className="py-8 text-center text-white/40">لا توجد حلقات في هذا الموسم بعد.</div>
          ) : (
            episodes.map((ep, idx) => (
              <div
                key={ep.id}
                className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center font-mono font-bold text-amber-400">
                    #{ep.episodeNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{ep.title}</span>
                      <button
                        onClick={() => handleTogglePublishEpisode(ep)}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          ep.published
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {ep.published ? 'منشور' : 'مسودة'}
                      </button>
                    </div>
                    <div className="text-xs text-white/50 line-clamp-1 mt-0.5">
                      {ep.description || 'لا يوجد وصف'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => reorderEpisodes(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 disabled:opacity-20"
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => reorderEpisodes(idx, 'down')}
                      disabled={idx === episodes.length - 1}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 disabled:opacity-20"
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Video Sources Manager Button */}
                  <button
                    onClick={() => setSourceEditingEpisode(ep)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>مصادر الفيديو</span>
                  </button>

                  {/* Delete Episode */}
                  <button
                    onClick={() => handleDeleteEpisode(ep.id)}
                    className="p-1.5 rounded text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Video Source Modal Sub-view */}
      {sourceEditingEpisode && (
        <SourceManagerModal
          episode={sourceEditingEpisode}
          onClose={() => setSourceEditingEpisode(null)}
        />
      )}
    </div>
  );
};
