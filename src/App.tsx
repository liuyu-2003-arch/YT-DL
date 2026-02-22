/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Youtube, 
  Music, 
  Video, 
  Subtitles, 
  Copy, 
  Check, 
  AlertCircle, 
  Terminal, 
  Folder, 
  ExternalLink,
  Loader2,
  Info,
  History,
  Trash2,
  Clock
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DownloadType = 'video' | 'audio' | 'subtitles';

interface HistoryItem {
  id: string;
  url: string;
  type: DownloadType;
  command: string;
  timestamp: number;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [type, setType] = useState<DownloadType>('subtitles');
  const [outputPath, setOutputPath] = useState('~/Videos/YouTube DL');
  const [copied, setCopied] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Handle URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    const typeParam = params.get('type') as DownloadType;

    if (urlParam) setUrl(decodeURIComponent(urlParam));
    if (typeParam && ['video', 'audio', 'subtitles'].includes(typeParam)) setType(typeParam);
  }, []);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('yt_dlp_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('yt_dlp_history', JSON.stringify(history));
  }, [history]);

  // Validation logic
  useEffect(() => {
    if (!url) {
      setIsValid(null);
      return;
    }
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    const bilibiliRegex = /^(https?:\/\/)?(www\.)?bilibili\.com\/video\/.+$/;
    const playlistRegex = /[&?]list=([^&]+)/;

    const valid = youtubeRegex.test(url) || bilibiliRegex.test(url);
    setIsValid(valid);
    setIsPlaylist(playlistRegex.test(url));
  }, [url]);

  const generatedCommand = useMemo(() => {
    if (!isValid || !url) return '';

    const baseOutput = `-o "${outputPath}/%(title)s.%(ext)s"`;
    const playlistFlag = isPlaylist ? '--yes-playlist' : '--no-playlist';
    
    switch (type) {
      case 'video':
        return `yt-dlp ${playlistFlag} --merge-output-format mkv --write-subs --write-auto-subs --sub-langs "zh.*,en.*" --convert-subs srt --embed-subs --embed-thumbnail --embed-metadata ${baseOutput} "${url}"`;
      
      case 'audio':
        return `yt-dlp ${playlistFlag} -x --audio-format mp3 --embed-thumbnail --embed-metadata ${baseOutput} "${url}"`;
      
      case 'subtitles':
        return `# 下载字幕 (如果无字幕则使用 Whisper 转录)\n` +
               `yt-dlp ${playlistFlag} --write-subs --write-auto-subs --sub-langs "zh.*,en.*" --skip-download --convert-subs srt ${baseOutput} "${url}" || \\\n` +
               `(yt-dlp ${playlistFlag} -x --audio-format wav -o "temp_audio.wav" "${url}" && whisper temp_audio.wav --model medium --output_format srt --output_dir "${outputPath}" && rm temp_audio.wav)`;
      
      default:
        return '';
    }
  }, [url, type, outputPath, isValid, isPlaylist]);

  const handleCopy = () => {
    if (!generatedCommand) return;
    navigator.clipboard.writeText(generatedCommand);
    setCopied(true);
    
    // Add to history
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      url,
      type,
      command: generatedCommand,
      timestamp: Date.now(),
    };
    
    setHistory(prev => [newItem, ...prev.filter(item => item.url !== url || item.type !== type)].slice(0, 10));
    
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-copy effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoCopy = params.get('autocopy') === 'true';
    
    if (autoCopy && generatedCommand && isValid) {
      handleCopy();
      // Clean up URL to prevent repeated auto-copy on refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [generatedCommand, isValid]);

  const clearHistory = () => {
    setHistory([]);
  };

  const copyFromHistory = (command: string) => {
    navigator.clipboard.writeText(command);
  };

  const handleShare = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    if (url) params.set('url', encodeURIComponent(url));
    params.set('type', type);
    params.set('autocopy', 'true');
    
    const shareUrl = `${baseUrl}?${params.toString()}`;
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const bookmarkletCode = `javascript:(function(){const url=encodeURIComponent(window.location.href);window.open('${window.location.origin}${window.location.pathname}?url='+url+'&type=video&autocopy=true','_blank');})();`;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-500/20 overflow-x-hidden">
      {/* Background Gradient - Mac Style Light */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 blur-[150px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* Header - Artistic & Compact */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white border border-[#1D1D1F]/10 rounded-xl flex items-center justify-center shadow-sm">
              <Terminal className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">YT-DLP Architect</h1>
              <p className="text-xs text-[#1D1D1F]/40 font-medium">Precision Command Generator</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              disabled={!url || !isValid}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 text-xs font-semibold",
                shareCopied 
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20" 
                  : "bg-white border-[#1D1D1F]/10 text-[#1D1D1F]/60 hover:border-[#1D1D1F]/20 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
              )}
            >
              {shareCopied ? <Check className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
              <span>{shareCopied ? 'Link Copied' : 'Share'}</span>
            </button>

            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 text-xs font-semibold",
                showHistory 
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "bg-white border-[#1D1D1F]/10 text-[#1D1D1F]/60 hover:border-[#1D1D1F]/20 shadow-sm"
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {history.length > 0 && (
                <span className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                  showHistory ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-600"
                )}>
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        <div className="relative">
          {/* Main Content Area */}
          <motion.div 
            animate={{ 
              opacity: showHistory ? 0.3 : 1,
              scale: showHistory ? 0.98 : 1,
              filter: showHistory ? 'blur(4px)' : 'blur(0px)'
            }}
            className="space-y-8 transition-all duration-500"
          >
            {/* Input Section */}
            <div className="space-y-2">
              <div className="relative group">
                <input 
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube or Bilibili URL here..."
                  className={cn(
                    "w-full bg-white border border-[#1D1D1F]/10 rounded-2xl px-6 py-5 text-lg outline-none transition-all duration-300",
                    "focus:border-blue-500/50 focus:ring-8 focus:ring-blue-500/5 shadow-sm placeholder:text-[#1D1D1F]/20",
                    isValid === false && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/5"
                  )}
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                  {isValid === true && <Check className="w-5 h-5 text-emerald-600" />}
                  {isValid === false && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {url && isValid === null && <Loader2 className="w-5 h-5 text-[#1D1D1F]/20 animate-spin" />}
                </div>
              </div>
            </div>

            {/* Preview & Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Preview Card */}
              <AnimatePresence mode="wait">
                {isValid && url ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/80 backdrop-blur-xl border border-[#1D1D1F]/5 rounded-3xl p-4 shadow-sm flex flex-col gap-4"
                  >
                    <div className="aspect-video bg-[#F5F5F7] rounded-2xl flex items-center justify-center overflow-hidden relative border border-[#1D1D1F]/5">
                      {url.includes('youtube.com') || url.includes('youtu.be') ? (
                        <img 
                          src={`https://img.youtube.com/vi/${url.split('v=')[1]?.split('&')[0] || url.split('/').pop()}/mqdefault.jpg`} 
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Youtube className="w-10 h-10 text-[#1D1D1F]/10" />
                      )}
                      <div className="absolute top-3 left-3">
                        {isPlaylist ? (
                          <span className="px-2 py-1 bg-purple-500 text-white text-[9px] font-bold uppercase rounded-full shadow-lg shadow-purple-500/20">Playlist</span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-500 text-white text-[9px] font-bold uppercase rounded-full shadow-lg shadow-emerald-500/20">Single</span>
                        )}
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="text-xs font-semibold truncate text-[#1D1D1F]/80 mb-1">{url}</p>
                      <p className="text-[10px] text-[#1D1D1F]/40 font-medium">Ready for architecting...</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-white/40 border border-dashed border-[#1D1D1F]/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/50 flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-[#1D1D1F]/10" />
                    </div>
                    <p className="text-xs text-[#1D1D1F]/30 font-medium">Paste a link to see preview</p>
                  </div>
                )}
              </AnimatePresence>

              {/* Options Column */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#1D1D1F]/30 ml-1">Download Type</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(['subtitles', 'video', 'audio'] as DownloadType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={cn(
                          "flex items-center justify-between px-5 py-3.5 rounded-2xl border transition-all duration-300",
                          type === t 
                            ? "bg-white border-blue-500/20 text-blue-600 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/10" 
                            : "bg-white/50 border-transparent text-[#1D1D1F]/40 hover:bg-white hover:border-[#1D1D1F]/10"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {t === 'video' && <Video className="w-4 h-4" />}
                          {t === 'audio' && <Music className="w-4 h-4" />}
                          {t === 'subtitles' && <Subtitles className="w-4 h-4" />}
                          <span className="text-xs font-bold capitalize">{t}</span>
                        </div>
                        {type === t && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#1D1D1F]/30 ml-1">Output Path</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={outputPath}
                      onChange={(e) => setOutputPath(e.target.value)}
                      className="w-full bg-white border border-[#1D1D1F]/10 rounded-2xl px-5 py-3.5 text-xs outline-none focus:border-blue-500/30 transition-all shadow-sm"
                    />
                    <Folder className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1D1D1F]/20" />
                  </div>
                </div>
              </div>
            </div>

            {/* Command Output Area */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-blue-600" />
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#1D1D1F]/30">Generated Command</label>
                </div>
                {isValid && (
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy Command'}
                  </button>
                )}
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-white border border-[#1D1D1F]/10 rounded-[1.5rem] p-6 font-mono text-xs leading-relaxed overflow-x-auto min-h-[100px] flex items-center shadow-sm">
                  {isValid && url ? (
                    <code className="text-[#1D1D1F]/80 whitespace-pre-wrap break-all selection:bg-blue-500/10">
                      {generatedCommand}
                    </code>
                  ) : (
                    <div className="flex items-center gap-3 text-[#1D1D1F]/20 italic">
                      <Terminal className="w-4 h-4 opacity-50" />
                      <span>Waiting for valid URL input...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* History Overlay Panel */}
          <AnimatePresence>
            {showHistory && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="absolute inset-0 z-20 bg-white/90 backdrop-blur-2xl border border-[#1D1D1F]/10 rounded-[2.5rem] p-8 shadow-2xl shadow-[#1D1D1F]/10 flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <History className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1D1D1F]/80">Recent Architectures</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {history.length > 0 && (
                      <button 
                        onClick={clearHistory}
                        className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition-colors"
                        title="Clear History"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => setShowHistory(false)}
                      className="p-2 hover:bg-[#F5F5F7] text-[#1D1D1F]/40 hover:text-[#1D1D1F] rounded-xl transition-colors"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                        <Clock className="w-8 h-8 text-[#1D1D1F]/10" />
                      </div>
                      <p className="text-xs text-[#1D1D1F]/30 font-medium italic">Your command history will appear here</p>
                    </div>
                  ) : (
                    history.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group p-4 bg-[#F5F5F7]/50 border border-transparent hover:border-blue-500/20 hover:bg-white rounded-2xl transition-all cursor-pointer relative"
                        onClick={() => {
                          setUrl(item.url);
                          setType(item.type);
                          setShowHistory(false);
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {item.type === 'video' && <Video className="w-3 h-3 text-blue-500" />}
                            {item.type === 'audio' && <Music className="w-3 h-3 text-purple-500" />}
                            {item.type === 'subtitles' && <Subtitles className="w-3 h-3 text-emerald-500" />}
                            <span className="text-[9px] font-bold uppercase text-[#1D1D1F]/40 tracking-widest">{item.type}</span>
                          </div>
                          <span className="text-[9px] text-[#1D1D1F]/30 font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs font-medium truncate text-[#1D1D1F]/70 pr-8">{item.url}</p>
                        <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              copyFromHistory(item.command);
                            }}
                            className="p-2 bg-white border border-[#1D1D1F]/10 rounded-xl shadow-sm hover:text-blue-600 transition-all active:scale-90"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                
                {history.length > 0 && (
                  <p className="text-[9px] text-center text-[#1D1D1F]/20 mt-6 font-mono uppercase tracking-widest">
                    Last 10 commands preserved
                  </p>
                )}

                {/* Bookmarklet Section */}
                <div className="mt-auto pt-8 border-t border-[#1D1D1F]/5">
                  <div className="bg-[#F5F5F7] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#1D1D1F]/60">Browser Plugin (Bookmarklet)</h4>
                    </div>
                    <p className="text-[10px] text-[#1D1D1F]/40 leading-relaxed">
                      Drag the button below to your bookmarks bar. Click it while on a YouTube page to instantly generate and copy the command.
                    </p>
                    <a 
                      href={bookmarkletCode}
                      onClick={(e) => e.preventDefault()}
                      className="block w-full py-2.5 bg-white border border-blue-500/20 rounded-xl text-[10px] font-bold text-blue-600 text-center hover:bg-blue-50 transition-all shadow-sm cursor-move"
                    >
                      YT-DLP Architect
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-1 h-1 rounded-full bg-[#1D1D1F]/10" />
          <div className="w-1 h-1 rounded-full bg-[#1D1D1F]/10" />
          <div className="w-1 h-1 rounded-full bg-[#1D1D1F]/10" />
        </div>
        <p className="text-[10px] text-[#1D1D1F]/20 font-mono tracking-[0.2em] uppercase">
          Architectural Precision
        </p>
      </footer>
    </div>
  );
}

