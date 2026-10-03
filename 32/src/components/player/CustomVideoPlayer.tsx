import React, { useRef, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api.ts';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  SkipBack,
  SkipForward,
  Settings,
  AlertCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';

interface AvailableSource {
  id: string;
  name: string;
  type: string;
  priority?: number;
  externalPlayback?: {
    url: string;
    mode: 'VIDEO' | 'IFRAME';
  };
}

interface Props {
  episodeId: string;
  episodeTitle: string;
  episodeNumber: number;
  seasonNumber: number;
  seriesTitle: string;
  initialPosition?: number;
  autoNextCountdownSeconds?: number;
  prevEpisode?: { id: string; episodeNumber: number; title: string } | null;
  nextEpisode?: { id: string; episodeNumber: number; title: string } | null;
  availableSources?: AvailableSource[];
  onSelectEpisode: (episodeId: string) => void;
  onBack: () => void;
}

export const CustomVideoPlayer: React.FC<Props> = ({
  episodeId,
  episodeTitle,
  episodeNumber,
  seasonNumber,
  seriesTitle,
  initialPosition = 0,
  autoNextCountdownSeconds = 5,
  prevEpisode,
  nextEpisode,
  availableSources = [],
  onSelectEpisode,
  onBack
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(() => availableSources[0]?.id);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [showSourceMenu, setShowSourceMenu] = useState<boolean>(false);
  const [autoNextTimer, setAutoNextTimer] = useState<number | null>(null);
  const [isHoveringTimeline, setIsHoveringTimeline] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number>(0);
  const [hoverPositionX, setHoverPositionX] = useState<number>(0);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Resolve the active source. EXTERNAL_PLAYER sources are intentionally loaded by
  // the viewer browser and never proxied through CineVault's backend.
  const activeSource = availableSources.find((source) => source.id === selectedSourceId) || availableSources[0];
  const isExternalSource = activeSource?.type === 'EXTERNAL_PLAYER' && !!activeSource.externalPlayback?.url;
  const isIframeSource = isExternalSource && activeSource?.externalPlayback?.mode === 'IFRAME';
  const streamUrl = `/api/episodes/${episodeId}/stream${activeSource && !isExternalSource ? `?sourceId=${encodeURIComponent(activeSource.id)}` : ''}`;
  const mediaUrl = isExternalSource && !isIframeSource
    ? activeSource!.externalPlayback!.url
    : streamUrl;

  // Reset to this episode's first source when navigating between episodes.
  useEffect(() => {
    setSelectedSourceId(availableSources[0]?.id);
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
  }, [episodeId]);

  // Periodic watch progress reporter
  const saveProgress = useCallback((pos: number, dur: number) => {
    if (!pos || isNaN(pos)) return;
    apiFetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodeId,
        position: Math.floor(pos),
        duration: Math.floor(dur) || 0
      })
    }).catch(() => {
      // Ignore background reporting errors silently
    });
  }, [episodeId]);

  // Initial resume position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setIsLoading(false);
      setHasError(false);

      if (initialPosition > 5 && initialPosition < (video.duration - 15)) {
        video.currentTime = initialPosition;
        setCurrentTime(initialPosition);
      }

      // Auto play on load
      video.play().then(() => setIsPlaying(true)).catch(() => {
        // Autoplay may be blocked by browser policy without user gesture
        setIsPlaying(false);
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [episodeId, initialPosition, selectedSourceId]);

  // Sync progress every 6 seconds while playing
  useEffect(() => {
    if (isPlaying) {
      saveProgressIntervalRef.current = setInterval(() => {
        if (videoRef.current) {
          saveProgress(videoRef.current.currentTime, videoRef.current.duration);
        }
      }, 6000);
    } else {
      if (saveProgressIntervalRef.current) clearInterval(saveProgressIntervalRef.current);
    }

    return () => {
      if (saveProgressIntervalRef.current) clearInterval(saveProgressIntervalRef.current);
    };
  }, [isPlaying, saveProgress]);

  // Save progress on page visibility change or unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && videoRef.current) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
    };

    const handleBeforeUnload = () => {
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Final flush on unmount
      if (videoRef.current) {
        saveProgress(videoRef.current.currentTime, videoRef.current.duration);
      }
    };
  }, [saveProgress]);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSpeedMenu && !showSourceMenu) {
        setShowControls(false);
      }
    }, 3200);
  }, [isPlaying, showSpeedMenu, showSourceMenu]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
      saveProgress(video.currentTime, video.duration);
    }
  };

  // Seeking relative
  const seekRelative = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    video.currentTime = target;
    setCurrentTime(target);
    resetControlsTimer();
  };

  // Timeline click / drag
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Volume change
  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      if (volume === 0) {
        video.volume = 0.5;
        setVolume(0.5);
      }
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  // Playback speed
  const changeSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  // Fullscreen
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen request failed:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Exit fullscreen failed:', err);
      }
    }
  };

  // Picture in Picture
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP toggle failed:', err);
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
          }
          break;
        default:
          break;
      }
      resetControlsTimer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, volume, isMuted, isPlaying]);

  // Video event handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    // Calculate buffered range
    if (video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1));
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      saveProgress(videoRef.current.duration, videoRef.current.duration);
    }

    if (nextEpisode) {
      // Start auto next countdown
      setAutoNextTimer(autoNextCountdownSeconds);
    }
  };

  // Auto-next countdown timer interval
  useEffect(() => {
    if (autoNextTimer === null) return;

    if (autoNextTimer <= 0) {
      setAutoNextTimer(null);
      if (nextEpisode) {
        onSelectEpisode(nextEpisode.id);
      }
      return;
    }

    const interval = setInterval(() => {
      setAutoNextTimer((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [autoNextTimer, nextEpisode, onSelectEpisode]);

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage('تعذر تشغيل الحلقة حاليًا. يرجى المحاولة لاحقًا أو التبديل إلى مصدر آخر.');
  };

  // Timeline hover calculation
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPositionX(e.clientX - rect.left);
    setHoverTime(pos * (duration || 0));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      className="relative w-full aspect-video max-h-[85vh] bg-black rounded-2xl overflow-hidden select-none group shadow-2xl border border-white/10"
    >
      {/* Server-proxied sources use the backend stream API. External sources can
          either feed the same HTML5 player directly or render an external embed. */}
      {isIframeSource ? (
        <iframe
          key={activeSource?.id || mediaUrl}
          src={activeSource?.externalPlayback?.url}
          title={`${seriesTitle} - ${episodeTitle}`}
          className="w-full h-full border-0 bg-black"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="no-referrer"
          onLoad={() => {
            setIsLoading(false);
            setHasError(false);
          }}
        />
      ) : (
        <video
          key={`${episodeId}:${activeSource?.id || 'default'}`}
          ref={videoRef}
          src={mediaUrl}
          onTimeUpdate={handleTimeUpdate}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          preload="metadata"
          playsInline
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
        />
      )}

      {/* Top Bar (Title & Back Button) */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 pointer-events-auto ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors"
            title="رجوع إلى القائمة"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
              {seriesTitle} • الموسم {seasonNumber}
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-md sm:max-w-xl">
              الحلقة {episodeNumber}: {episodeTitle}
            </h2>
          </div>
        </div>

        {/* Source Switcher if multiple sources exist */}
        {availableSources.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setShowSourceMenu(!showSourceMenu)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white flex items-center gap-1.5 transition-colors border border-white/10"
            >
              <span>المصدر: {availableSources.find((s) => s.id === selectedSourceId)?.name || 'الافتراضي'}</span>
            </button>
            {showSourceMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#18181c] border border-white/15 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/40">مصادر الفيديو المتاحة</div>
                {availableSources.map((src) => (
                  <button
                    key={src.id}
                    onClick={() => {
                      setSelectedSourceId(src.id);
                      setShowSourceMenu(false);
                      setIsLoading(true);
                      setHasError(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/10 transition-colors ${
                      selectedSourceId === src.id ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-white/80'
                    }`}
                  >
                    <span>{src.name}</span>
                    <span className="text-[10px] text-white/40 uppercase">{src.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center Loading Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
          <div className="p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-xs text-white/80 font-medium">جارٍ التحميل...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-30">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">تعذر تشغيل الفيديو</h3>
          <p className="text-sm text-white/60 max-w-md mb-6">{errorMessage}</p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all"
            >
              إعادة المحاولة
            </button>
            {availableSources.length > 1 && (
              <button
                onClick={() => {
                  const currentIndex = availableSources.findIndex((s) => s.id === selectedSourceId);
                  const nextSrc = availableSources[(currentIndex + 1) % availableSources.length];
                  setSelectedSourceId(nextSrc.id);
                  setHasError(false);
                  setIsLoading(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all border border-white/15"
              >
                التبديل إلى مصدر بديل
              </button>
            )}
          </div>
        </div>
      )}

      {/* Auto Next Episode Countdown Overlay */}
      {autoNextTimer !== null && nextEpisode && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 animate-fade-in">
          <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-2">الحلقة التالية</div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
            الحلقة {nextEpisode.episodeNumber}: {nextEpisode.title}
          </h3>
          <div className="text-sm text-white/70 mb-6">
            يبدأ التشغيل التلقائي خلال <span className="font-mono font-bold text-amber-400 text-base">{autoNextTimer}</span> ثوانٍ
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoNextTimer(null)}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
            >
              إلغاء التلقائي
            </button>
            <button
              onClick={() => {
                setAutoNextTimer(null);
                onSelectEpisode(nextEpisode.id);
              }}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
            >
              <span>تشغيل الآن</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Floating Control Bar (external iframe players provide their own controls) */}
      {!isIframeSource && (
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-3 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Slider with Hover Preview */}
        <div
          className="relative group/timeline w-full cursor-pointer py-2"
          onMouseEnter={() => setIsHoveringTimeline(true)}
          onMouseLeave={() => setIsHoveringTimeline(false)}
          onMouseMove={handleTimelineMouseMove}
        >
          {/* Hover Time Tooltip */}
          {isHoveringTimeline && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-white/20 text-[11px] font-mono text-white pointer-events-none shadow-lg z-30"
              style={{ left: `${hoverPositionX}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Progress Bar Container */}
          <div className="relative w-full h-1.5 group-hover/timeline:h-2.5 bg-white/20 rounded-full overflow-hidden transition-all">
            {/* Buffered Bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full transition-all"
              style={{ width: `${bufferPercent}%` }}
            />
            {/* Played Bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Invisible Range Input for Draggable Scrubbing */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white">
          {/* Left Controls (Play, Prev, Next, Seek 10s, Volume, Time) */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={togglePlay}
              className="p-2 sm:p-2.5 rounded-full bg-white hover:bg-white/90 active:scale-95 text-black transition-all shadow-md cursor-pointer"
              title={isPlaying ? 'إيقاف مؤقت (Space)' : 'تشغيل (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Prev Episode */}
            {prevEpisode && (
              <button
                onClick={() => onSelectEpisode(prevEpisode.id)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title={`الحلقة السابقة: ${prevEpisode.title}`}
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}

            {/* Next Episode */}
            {nextEpisode && (
              <button
                onClick={() => onSelectEpisode(nextEpisode.id)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title={`الحلقة التالية: ${nextEpisode.title}`}
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}

            {/* Seek -10s */}
            <button
              onClick={() => seekRelative(-10)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors hidden sm:inline-flex"
              title="تراجع 10 ثوانٍ (←)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Seek +10s */}
            <button
              onClick={() => seekRelative(10)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors hidden sm:inline-flex"
              title="تقديم 10 ثوانٍ (→)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="كتم الصوت (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-20 h-1 bg-white/20 accent-amber-500 rounded-full cursor-pointer transition-all"
              />
            </div>

            {/* Time Stamp Display */}
            <div className="text-xs font-mono text-white/70">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/30">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls (Speed, PiP, Fullscreen) */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-mono font-medium text-white/80 hover:text-white transition-colors"
                title="سرعة التشغيل"
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div className="absolute right-0 bottom-full mb-2 bg-[#18181c] border border-white/15 rounded-xl shadow-2xl py-1.5 w-24 z-50">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`w-full text-center py-1.5 text-xs font-mono hover:bg-white/10 transition-colors ${
                        playbackSpeed === s ? 'text-amber-400 font-bold bg-amber-500/10' : 'text-white/70'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors hidden sm:inline-flex"
              title="صورة داخل صورة"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              title="شاشة كاملة (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
