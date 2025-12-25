
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Settings as SettingsIcon, X, Tv, Film, Play, LayoutGrid, ChevronRight, ShieldCheck, RefreshCw, Zap, Maximize, AlertTriangle, ChevronDown, Filter } from 'lucide-react';
import { AppView, Settings, User, Channel } from './types';
import SettingsPanel from './components/SettingsPanel';
import { getGoogleDriveDirectLink, parseM3U, DEFAULT_WALLPAPER, getProxyUrls, isIPTVBlockedResponse, extractM3U8FromHTML } from './services/utils';
import videojs from 'video.js';
import Hls from 'hls.js';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('login');
  
  const [tvSearchQuery, setTvSearchQuery] = useState('');
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [tvSelectedGroup, setTvSelectedGroup] = useState<string>('TẤT CẢ');
  const [movieSelectedGroup, setMovieSelectedGroup] = useState<string>('TẤT CẢ');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeMedia, setActiveMedia] = useState<Channel | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [playerEngine, setPlayerEngine] = useState<'videojs' | 'hlsjs'>('videojs');

  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('phykytv_v3_settings');
    return saved ? JSON.parse(saved) : {
      wallpaper: DEFAULT_WALLPAPER,
      tvSourceUrl: 'https://drive.google.com/file/d/1vcqS2VdVQY-J3oLZR6f9sA3VwSI04GC3/view?usp=sharing', 
      epgUrl: 'https://vnepg.site/epg.xml.gz',
      movieSourceUrl: 'https://iptv.pro.vn/phimiptv/',
    };
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('phykytv_v3_user');
    return saved ? JSON.parse(saved) : {
      username: 'PHYKYTV ADMIN',
      password: '123',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=phyky',
      role: 'admin'
    };
  });

  const [channels, setChannels] = useState<Channel[]>([]);
  const [movies, setMovies] = useState<Channel[]>([]);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const vjsPlayerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);

  const TV_GROUPS = ["TẤT CẢ", "MIỀN TÂY", "HTV", "VTV", "SCTV", "ĐỊA PHƯƠNG", "NƯỚC NGOÀI"];

  useEffect(() => {
    localStorage.setItem('phykytv_v3_settings', JSON.stringify(settings));
    localStorage.setItem('phykytv_v3_user', JSON.stringify(currentUser));
  }, [settings, currentUser]);

  /**
   * Khắc phục lỗi 'Failed to fetch' bằng cách sử dụng hệ thống xoay vòng Proxy nâng cao.
   * Ưu tiên các Proxy JSON khi gặp các server Phim có tường lửa CORS mạnh.
   */
  const fetchSource = async (url: string, type: 'tv' | 'movie') => {
    if (!url) {
      if (type === 'tv') setChannels([]); else setMovies([]);
      return;
    }
    
    setIsLoading(true);
    setLoadingStatus(`Đang nạp ${type === 'tv' ? 'Kênh Tivi' : 'Kho Phim'}...`);
    setErrorToast(null);
    
    const finalBaseUrl = getGoogleDriveDirectLink(url);
    const proxyOptions = getProxyUrls(finalBaseUrl);
    
    let success = false;
    let lastError = '';

    for (let i = 0; i < proxyOptions.length; i++) {
      const currentProxy = proxyOptions[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 giây timeout mỗi Proxy

        const response = await fetch(currentProxy.url, { 
          signal: controller.signal,
          headers: { 'Accept': '*/*' }
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        let data = '';
        if (currentProxy.type === 'json') {
          const json = await response.json();
          data = json.contents;
        } else {
          data = await response.text();
        }

        if (!data || data.trim().length < 10) throw new Error('Phản hồi trống');

        if (isIPTVBlockedResponse(data)) {
          throw new Error('Nguồn bị server chặn truy cập qua trình duyệt');
        }

        const parsed = parseM3U(data);
        if (parsed.length === 0) throw new Error('Không tìm thấy danh sách hợp lệ');

        if (type === 'tv') {
          setChannels(parsed.filter(c => c.group !== 'Mặc định'));
        } else {
          setMovies(parsed);
        }
        
        success = true;
        console.log(`[PHYKYTV] Sync thành công qua cổng ${i + 1}`);
        break; 
      } catch (err: any) {
        lastError = err.name === 'AbortError' ? 'Cổng kết nối quá chậm' : err.message;
        console.warn(`[PHYKYTV] Cổng ${i + 1} lỗi: ${lastError}`);
      }
    }

    if (!success) {
      setErrorToast(`Lỗi nạp nguồn: ${lastError}. Vui lòng thử lại hoặc đổi link.`);
    }

    setTimeout(() => setIsLoading(false), 200);
  };

  useEffect(() => {
    if (view === 'tv') fetchSource(settings.tvSourceUrl, 'tv');
    if (view === 'movies') fetchSource(settings.movieSourceUrl, 'movie');
  }, [view, settings.tvSourceUrl, settings.movieSourceUrl]);

  /**
   * HỆ THỐNG TRÌNH PHÁT DUAL ENGINE (Video.js + Hls.js)
   * Giữ nguyên 100% logic xử lý luồng phát ổn định nhất.
   */
  useEffect(() => {
    if (!activeMedia) return;

    const cleanup = () => {
      if (vjsPlayerRef.current) {
        vjsPlayerRef.current.dispose();
        vjsPlayerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = ''; 
      }
    };

    const initializeHlsJS = (url: string) => {
      if (!playerContainerRef.current) return;
      setPlayerEngine('hlsjs');
      
      const video = document.createElement('video');
      video.className = 'w-full h-full bg-black';
      video.setAttribute('controls', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('playsinline', 'true');
      playerContainerRef.current.appendChild(video);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => console.log("[PHYKYTV] Autoplay blocked"));
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setErrorToast("Luồng phát không ổn định hoặc đã bị ngắt.");
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => console.log("[PHYKYTV] Native play blocked"));
      }
    };

    const initializeVideoJS = (url: string) => {
      if (!playerContainerRef.current) return;
      cleanup();
      setPlayerEngine('videojs');

      const video = document.createElement('video');
      video.className = 'video-js vjs-big-play-centered w-full h-full';
      video.setAttribute('crossorigin', 'anonymous');
      video.setAttribute('playsinline', 'true');
      playerContainerRef.current.appendChild(video);

      const player = videojs(video, {
        autoplay: true,
        controls: true,
        fluid: true,
        liveui: true,
        preload: 'auto',
        html5: { vhs: { overrideNative: true, fastQualityChange: true } },
        sources: [{ src: url, type: 'application/x-mpegURL' }]
      });

      vjsPlayerRef.current = player;

      player.on('error', () => {
        console.warn("[PHYKYTV] Video.js lỗi - Chuyển sang trình phát dự phòng...");
        cleanup();
        initializeHlsJS(url);
      });

      player.ready(() => {
        player.play().catch(() => console.log("[PHYKYTV] Video.js play blocked"));
      });
    };

    const startStreaming = async () => {
      let finalUrl = activeMedia.url;
      
      // CHỈ PHÂN TÍCH PHP CHO MỤC PHIM NẾU CẦN. 
      // MỤC TIVI ONLINE: LOẠI BỎ CODE SCRIPT PHP BÓC TÁCH NHƯ YÊU CẦU.
      if (view === 'movies' && finalUrl.includes('.php')) {
        setIsLoading(true);
        setLoadingStatus("Đang giải mã luồng phim...");
        const proxyOptions = getProxyUrls(finalUrl);
        let extracted = null;
        for (const proxy of proxyOptions) {
          try {
            const res = await fetch(proxy.url);
            if (res.ok) {
              const text = proxy.type === 'json' ? (await res.json()).contents : await res.text();
              extracted = extractM3U8FromHTML(text);
              if (extracted) break;
            }
          } catch (e) { continue; }
        }
        if (extracted) finalUrl = extracted;
        setIsLoading(false);
      }

      initializeVideoJS(finalUrl);
    };

    startStreaming();
    return () => cleanup();
  }, [activeMedia, view]);

  const movieGroups = useMemo(() => {
    const groups = new Set<string>();
    groups.add('TẤT CẢ');
    movies.forEach(m => { if (m.group) groups.add(m.group.toUpperCase()); });
    return Array.from(groups).sort();
  }, [movies]);

  const filteredTvList = useMemo(() => {
    const q = tvSearchQuery.toLowerCase().trim();
    return channels.filter(item => {
      const matchGroup = tvSelectedGroup === 'TẤT CẢ' || item.group?.toUpperCase() === tvSelectedGroup;
      const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.group && item.group.toLowerCase().includes(q));
      return matchGroup && matchSearch;
    });
  }, [channels, tvSearchQuery, tvSelectedGroup]);

  const filteredMovieList = useMemo(() => {
    const q = movieSearchQuery.toLowerCase().trim();
    return movies.filter(item => {
      const matchGroup = movieSelectedGroup === 'TẤT CẢ' || item.group?.toUpperCase() === movieSelectedGroup;
      const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.group && item.group.toLowerCase().includes(q));
      return matchGroup && matchSearch;
    });
  }, [movies, movieSearchQuery, movieSelectedGroup]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === currentUser.password) {
      setView('home');
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  if (view === 'login') {
    return (
      <div className="w-full h-screen flex items-center justify-center p-4 bg-slate-950" style={{ backgroundImage: `url(${settings.wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xl"></div>
        <form onSubmit={handleLogin} className="relative z-10 w-full max-sm:max-w-[320px] max-w-sm glass-panel p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="text-center mb-8 md:mb-10">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-[1.5rem] md:rounded-[2rem] mx-auto mb-6 md:mb-8 flex items-center justify-center shadow-2xl shadow-blue-500/40 transform -rotate-6">
              <ShieldCheck className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2">PHYKY<span className="text-blue-500">TV</span></h1>
            <p className="text-gray-400 text-[10px] uppercase tracking-[0.3em] font-black opacity-60">Turbo Engine Pro v15.5</p>
          </div>
          <div className="space-y-6">
            <input 
              type="password"
              autoFocus
              className={`w-full bg-white/5 border ${loginError ? 'border-red-500 animate-shake' : 'border-white/10'} rounded-2xl px-6 py-5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-3xl tracking-[0.4em] placeholder:tracking-normal placeholder:text-sm`}
              placeholder="MẬT KHẨU"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-sm tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all active:scale-95 uppercase">Đăng nhập</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-950 text-white view-transition" style={{ backgroundImage: `url(${settings.wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

      <header className="relative z-20 flex items-center justify-between p-4 px-6 md:px-8 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="flex items-center gap-4 md:gap-10">
          <h1 className="text-xl md:text-2xl font-black tracking-tighter cursor-pointer select-none" onClick={() => {setView('home'); setActiveMedia(null);}}>
            PHYKY<span className="text-blue-500">TV</span>
          </h1>
          {view !== 'home' && (
            <div className="flex items-center gap-2 md:gap-3 bg-white/5 px-3 md:px-5 py-2 rounded-full border border-white/10 shadow-inner">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-gray-300">{view === 'tv' ? 'Tivi Online' : 'Phim Truyện'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl border border-white/10 transition-all group">
            <SettingsIcon className="h-4 w-4 md:h-5 md:w-5 text-gray-400 group-hover:text-white" />
          </button>
          <div className="flex items-center gap-3 md:gap-4 pl-4 md:pl-8 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] md:text-[11px] font-black tracking-tight text-white/90">{currentUser.username}</p>
              <button onClick={() => setView('login')} className="text-[9px] text-red-500 font-black uppercase tracking-widest hover:text-red-400">Thoát</button>
            </div>
            <img src={currentUser.avatar} alt="User" className="w-9 h-9 md:w-11 md:h-11 rounded-lg md:rounded-[1rem] border border-white/10 shadow-2xl" />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-hidden flex flex-col md:flex-row">
        {isLoading && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
             <div className="relative">
                <div className="w-20 h-20 md:w-28 md:h-28 border-[4px] md:border-[6px] border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-pulse" size={32} />
             </div>
             <p className="mt-8 md:mt-10 text-sm md:text-lg font-black tracking-[0.2em] text-white uppercase">{loadingStatus}</p>
          </div>
        )}

        {errorToast && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[70] w-[90%] md:w-auto bg-red-600/95 text-white px-6 md:px-8 py-4 md:py-5 rounded-2xl md:rounded-[2rem] flex items-center gap-4 md:gap-5 shadow-2xl animate-in slide-in-from-bottom-10 backdrop-blur-md border border-red-500/20">
            <AlertTriangle size={24} className="text-red-200" />
            <div className="flex-1 flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-100">Hệ thống báo lỗi</span>
              <span className="text-xs md:text-sm font-bold leading-relaxed">{errorToast}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => fetchSource(view === 'tv' ? settings.tvSourceUrl : settings.movieSourceUrl, view === 'tv' ? 'tv' : 'movie')} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg">
                <RefreshCw size={16} />
              </button>
              <button onClick={() => setErrorToast(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {view === 'home' ? (
          <div className="h-full flex-1 flex items-center justify-center p-6 md:p-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 max-w-6xl w-full">
              <button onClick={() => { setView('tv'); setActiveMedia(null); }} className="group flex flex-col items-center gap-6 md:gap-10 p-10 md:p-20 glass-panel rounded-3xl md:rounded-[4rem] hover:bg-white/10 transition-all hover:-translate-y-2 md:hover:-translate-y-6 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="w-20 h-20 md:w-32 md:h-32 rounded-2xl md:rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-all">
                  <Tv className="w-10 h-10 md:w-16 md:h-16 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl md:text-4xl font-black mb-2 md:mb-3 tracking-tighter uppercase text-white shadow-text">TIVI ONLINE</h3>
                  <p className="text-[9px] md:text-[11px] text-gray-400 font-black tracking-[0.3em] uppercase opacity-70">Video.js + Hls.js Dual Core v15.5</p>
                </div>
              </button>
              
              <button onClick={() => { setView('movies'); setActiveMedia(null); }} className="group flex flex-col items-center gap-6 md:gap-10 p-10 md:p-20 glass-panel rounded-3xl md:rounded-[4rem] hover:bg-white/10 transition-all hover:-translate-y-2 md:hover:-translate-y-6 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="w-20 h-20 md:w-32 md:h-32 rounded-2xl md:rounded-[2.5rem] bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-all">
                  <Film className="w-10 h-10 md:w-16 md:h-16 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl md:text-4xl font-black mb-2 md:mb-3 tracking-tighter uppercase text-white shadow-text">PHIM TRUYỆN</h3>
                  <p className="text-[9px] md:text-[11px] text-gray-400 font-black tracking-[0.3em] uppercase opacity-70">Turbo Proxy Sync Pro v15.5</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col md:flex-row animate-in slide-in-from-right-10 duration-500">
            {/* 70% PLAYER AREA */}
            <div className="flex-1 md:w-[70%] h-[40vh] md:h-full flex flex-col bg-black/40 relative group/player">
               <div className="absolute top-4 left-4 md:top-8 md:left-10 z-30 flex items-center gap-3 md:gap-6 opacity-0 group-hover/player:opacity-100 transition-all">
                  <button onClick={() => {setView('home'); setActiveMedia(null);}} className="p-2 md:p-4 bg-black/60 backdrop-blur-xl rounded-xl md:rounded-2xl hover:bg-blue-600 transition-all border border-white/10"><LayoutGrid size={18} className="md:w-6 md:h-6"/></button>
                  <div className="bg-black/60 backdrop-blur-xl px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl border border-white/10 shadow-2xl">
                    <h2 className="text-sm md:text-2xl font-black tracking-tight text-white truncate max-w-[150px] md:max-w-xl">{activeMedia?.name || `PHYKYTV ENGINE`}</h2>
                  </div>
               </div>
               
               <div className="flex-1 flex items-center justify-center p-0 overflow-hidden" ref={playerContainerRef}>
                  {!activeMedia && (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-10 animate-pulse">
                      <Play size={100} className="md:w-[150px] md:h-[150px] mb-8 text-blue-500" />
                      <p className="text-lg md:text-3xl font-black uppercase tracking-[0.5em] text-center">Ready to Stream</p>
                    </div>
                  )}
               </div>

               <div className="p-3 md:p-5 bg-slate-950/95 backdrop-blur-3xl flex justify-between items-center px-6 md:px-12 border-t border-white/5 shrink-0">
                  <div className="flex gap-4 md:gap-10">
                    <div className="flex items-center gap-2 md:gap-4">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                       <span className="text-[8px] md:text-[11px] font-black text-gray-400 tracking-widest uppercase">Streaming</span>
                    </div>
                    <span className="text-[8px] md:text-[11px] font-black text-blue-500 tracking-widest uppercase flex items-center gap-1 md:gap-2">
                      <Zap size={10} className="md:w-3 md:h-3" /> ENGINE: {playerEngine.toUpperCase()}
                    </span>
                  </div>
                  <button className="p-2 hover:bg-white/5 rounded-lg transition-all text-gray-400 hover:text-white" onClick={() => {
                        const target = playerContainerRef.current?.querySelector('video');
                        if (target?.requestFullscreen) target.requestFullscreen();
                    }}>
                       <Maximize size={16} className="md:w-5 md:h-5" />
                  </button>
               </div>
            </div>

            {/* 30% LIST AREA */}
            <div className="md:w-[30%] flex-1 h-full flex flex-col bg-slate-900/60 backdrop-blur-3xl border-l border-white/10 overflow-hidden">
               <div className="p-4 md:p-6 border-b border-white/5 bg-white/[0.02]">
                  <div className="relative group mb-3">
                    <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-all" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm nội dung..."
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-12 pr-10 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-600 shadow-inner"
                      value={view === 'tv' ? tvSearchQuery : movieSearchQuery}
                      onChange={(e) => view === 'tv' ? setTvSearchQuery(e.target.value) : setMovieSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="relative mb-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                       <Filter size={12} className="text-blue-500" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Phân nhóm</span>
                    </div>
                    <div className="relative">
                      <select 
                        className="w-full appearance-none bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-[11px] font-black text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer pr-10 uppercase tracking-wider overflow-y-auto max-h-[200px] custom-scrollbar"
                        value={view === 'tv' ? tvSelectedGroup : movieSelectedGroup}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (view === 'tv') setTvSelectedGroup(val); else setMovieSelectedGroup(val);
                        }}
                      >
                        {view === 'tv' 
                          ? TV_GROUPS.map(g => <option key={g} value={g} className="bg-slate-900 py-2">{g}</option>)
                          : movieGroups.map(g => <option key={g} value={g} className="bg-slate-900 py-2">{g}</option>)
                        }
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{view === 'tv' ? 'Kênh truyền hình' : 'Kho phim truyện'}</h3>
                    <div className="px-3 py-0.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                       <span className="text-[10px] text-blue-400 font-black">{(view === 'tv' ? filteredTvList : filteredMovieList).length}</span>
                    </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar no-scrollbar scroll-smooth">
                  {(view === 'tv' ? filteredTvList : filteredMovieList).length > 0 ? (
                    (view === 'tv' ? filteredTvList : filteredMovieList).map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => setActiveMedia(item)}
                        className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 border ${activeMedia?.id === item.id ? 'bg-blue-600 border-blue-400 shadow-xl scale-[1.02]' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-black/80 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5 shadow-inner">
                          {item.logo ? <img src={item.logo} className="w-full h-full object-contain p-1.5" onError={(e) => (e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${item.name}`)} /> : <Tv size={18} className="text-gray-600"/>}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className={`text-xs font-black truncate leading-tight ${activeMedia?.id === item.id ? 'text-white' : 'text-gray-100'}`}>{item.name}</p>
                          <p className={`text-[8px] font-black uppercase tracking-widest mt-1.5 ${activeMedia?.id === item.id ? 'text-blue-200' : 'text-gray-500'}`}>{item.group || 'Khác'}</p>
                        </div>
                        <ChevronRight size={16} className={`${activeMedia?.id === item.id ? 'text-white translate-x-1' : 'text-gray-700'} transition-transform`} />
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-20 opacity-20 flex flex-col items-center">
                      <Search size={40} className="mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Không tìm thấy dữ liệu</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <SettingsPanel 
          settings={settings}
          setSettings={setSettings}
          currentUser={currentUser}
          onUpdateUser={setCurrentUser}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <footer className="relative z-20 p-2 md:p-3 px-6 md:px-10 bg-black/80 border-t border-white/5 flex justify-between text-[7px] md:text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">
        <div className="flex gap-10">
           <span>PHYKYTV PRO v15.5</span>
           <span className="hidden sm:inline-block">PURE DUAL ENGINE: VIDEO.JS + HLS.JS</span>
        </div>
        <div className="flex gap-10 items-center">
           <span className="text-blue-500/70">{view === 'tv' ? 'TV MODE' : 'MOVIE MODE'}</span>
           <span className="text-white/30">CORS-BYPASS & PHP-SCRAPER ACTIVE</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
