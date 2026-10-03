import React from 'react';
import { Play, Clock } from 'lucide-react';
import type { ContinueWatchingItem } from '../types.ts';

interface Props {
  items: ContinueWatchingItem[];
  onPlayEpisode: (episodeId: string, initialPosition: number) => void;
}

export const ContinueWatching: React.FC<Props> = ({ items, onPlayEpisode }) => {
  if (!items || items.length === 0) return null;

  const formatRemaining = (position: number, duration: number) => {
    const left = Math.max(0, duration - position);
    const mins = Math.ceil(left / 60);
    return `باقي ${mins} د`;
  };

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-5 rounded-full bg-amber-500" />
          <h2 className="text-xl font-bold text-white tracking-wide">
            متابعة المشاهدة
          </h2>
        </div>
        <span className="text-xs text-white/50">{items.length} حلقة غير مكتملة</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(({ progress, episode, season, series }) => {
          const progressPercent = progress.duration > 0 ? (progress.position / progress.duration) * 100 : 0;

          return (
            <div
              key={progress.id}
              onClick={() => onPlayEpisode(episode.id, progress.position)}
              className="group relative bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-amber-500/40 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-lg hover:-translate-y-1"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-black/60">
                <img
                  src={episode.thumbnail || series.backdrop || series.poster}
                  alt={episode.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />

                {/* Center Play Button on hover */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Progress bar at bottom of thumbnail */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500"
                    style={{ width: `${Math.min(100, Math.max(2, progressPercent))}%` }}
                  />
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-3.5 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-0.5">
                    {series.title}
                  </div>
                  <h3 className="text-sm font-bold text-white truncate mb-1">
                    الموسم {season.seasonNumber} • ح {episode.episodeNumber}: {episode.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/50 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatRemaining(progress.position, progress.duration)}</span>
                  </div>
                  <span className="font-mono text-amber-400/80">{Math.round(progressPercent)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
