/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Clock,
  HelpCircle,
  ChevronRight,
  Home,
  Globe,
  Mic
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DownloadType = 'video' | 'audio' | 'subtitles' | 'transcribe';

interface HistoryItem {
  id: string;
  url: string;
  title?: string;
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
  const [title, setTitle] = useState('');
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  
  const bookmarkletCode = `javascript:(function(){const url=encodeURIComponent(window.location.href);window.open('https://yt-dlp.324893.xyz/#?url='+url+'&type=subtitles&autocopy=true','_blank');})();`;

  const bookmarkletRef = useCallback((node: HTMLAnchorElement | null) => {
    if (node) {
      node.setAttribute('href', bookmarkletCode);
    }
  }, [bookmarkletCode]);

  // Handle URL parameters on mount
  useEffect(() => {
    const getParam = (name: string) => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has(name)) return searchParams.get(name);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || window.location.hash.substring(1));
      return hashParams.get(name);
    };

    const urlParam = getParam('u') || getParam('url');
    const typeParam = (getParam('t') || getParam('type')) as DownloadType;

    if (urlParam) setUrl(decodeURIComponent(urlParam));
    if (typeParam && ['video', 'audio', 'subtitles', 'transcribe'].includes(typeParam)) setType(typeParam);
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
      setTitle('');
      return;
    }
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    const bilibiliRegex = /^(https?:\/\/)?(www\.)?bilibili\.com\/video\/.+$/;
    const playlistRegex = /[&?]list=([^&]+)/;

    const isYoutube = youtubeRegex.test(url);
    const isBilibili = bilibiliRegex.test(url);
    const valid = isYoutube || isBilibili;
    
    setIsValid(valid);
    setIsPlaylist(playlistRegex.test(url));

    if (valid && isYoutube) {
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
        .then(res => res.json())
        .then(data => setTitle(data.title))
        .catch(() => setTitle(''));
    } else if (valid && isBilibili) {
      // For Bilibili, we try to extract BVID for display if title fetch fails
      const bvidMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
      if (bvidMatch) {
        setTitle(`Bilibili: ${bvidMatch[1]}`);
      } else {
        setTitle('Bilibili Video');
      }
    } else {
      setTitle('');
    }
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
        return `echo "🔍 正在尝试下载现有字幕..." && \\\n` +
               `yt-dlp ${playlistFlag} "${url}" -P "${outputPath}/" -o "%(title)s.%(ext)s" --write-subs --write-auto-subs --sub-langs "en.*,zh.*" --convert-subs srt --skip-download -k --no-cache-dir && \\\n` +
               `echo "✅ 字幕下载完成！请在目录中查看 .srt 或 .vtt 文件：${outputPath}"`;
      
      case 'transcribe':
        return `echo "🎙️ 正在启动 Whisper 语音识别转录..." && \\\n` +
               `yt-dlp ${playlistFlag} "${url}" -P "${outputPath}/" -o "%(title)s.%(ext)s" -x --audio-format mp3 --no-cache-dir --exec "whisper {} --model medium --output_format srt --output_dir \\"${outputPath}/\\"" && \\\n` +
               `echo "✅ 转录完成！请在目录中查看 .srt 文件：${outputPath}"`;
      
      default:
        return '';
    }
  }, [url, type, outputPath, isValid, isPlaylist]);

  const handleCopy = () => {
    if (!generatedCommand) return;
    
    // Copy immediately for better UX
    navigator.clipboard.writeText(generatedCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    // Add to history
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      url,
      title: title || url,
      type,
      command: generatedCommand,
      timestamp: Date.now(),
    };
    
    setHistory(prev => [newItem, ...prev.filter(item => item.url !== url)].slice(0, 10));
  };

  // Auto-copy effect
  useEffect(() => {
    const getParam = (name: string) => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has(name)) return searchParams.get(name);
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || window.location.hash.substring(1));
      return hashParams.get(name);
    };

    const autoCopy = getParam('a') === '1' || getParam('autocopy') === 'true';
    
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
    if (url) params.set('u', encodeURIComponent(url));
    if (type !== 'subtitles') params.set('t', type); // Only set if not default
    params.set('a', '1');
    
    const shareUrl = `${baseUrl}?${params.toString()}`;
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1D1D1F] font-sans selection:bg-black/5 overflow-x-hidden">
      {/* Background Gradient - Artistic & Warm */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-100/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-50/40 blur-[150px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* Header - Artistic & Compact - Responsive Fix */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-12"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-2xl shadow-black/10 transform -rotate-6 group hover:rotate-0 transition-transform duration-500">
                <Terminal className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border-2 border-[#FBFBFA] rounded-full flex items-center justify-center shadow-md">
                <div className="w-3 h-3 bg-black rounded-full animate-pulse" />
              </div>
            </div>
            <div>
              <a href="https://yt-dlp.324893.xyz/" className="block group">
                <h1 className="text-4xl font-serif italic font-black tracking-tighter text-black leading-none group-hover:opacity-70 transition-opacity">Architect.</h1>
              </a>
              <p className="text-[10px] text-black/30 font-bold uppercase tracking-[0.3em] mt-1">YT-DLP Command Lab</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <AnimatePresence>
              {url && isValid && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  onClick={handleShare}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-300 text-xs font-bold",
                    shareCopied 
                      ? "bg-black text-white shadow-lg shadow-black/20" 
                      : "bg-white/80 backdrop-blur-md border-[#1D1D1F]/10 text-[#1D1D1F]/70 hover:border-[#1D1D1F]/30 hover:bg-white shadow-sm"
                  )}
                >
                  {shareCopied ? <Check className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  <span>{shareCopied ? 'Link Copied' : 'Share'}</span>
                </motion.button>
              )}
            </AnimatePresence>

            <button 
              onClick={() => {
                setShowHelp(!showHelp);
                setShowHistory(false);
              }}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-300 text-xs font-bold",
                showHelp 
                  ? "bg-black text-white shadow-lg shadow-black/20" 
                  : "bg-white/80 backdrop-blur-md border-[#1D1D1F]/10 text-[#1D1D1F]/70 hover:border-[#1D1D1F]/30 hover:bg-white shadow-sm"
              )}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Help</span>
            </button>

            <button 
              onClick={() => {
                setShowHistory(!showHistory);
                setShowHelp(false);
              }}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border transition-all duration-300 text-xs font-bold",
                showHistory 
                  ? "bg-black text-white shadow-lg shadow-black/20" 
                  : "bg-white/80 backdrop-blur-md border-[#1D1D1F]/10 text-[#1D1D1F]/70 hover:border-[#1D1D1F]/30 hover:bg-white shadow-sm"
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {history.length > 0 && (
                <span className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                  showHistory ? "bg-white/20 text-white" : "bg-black/5 text-black"
                )}>
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        <div className="bg-white/70 backdrop-blur-3xl border border-white/40 rounded-[3rem] p-12 shadow-2xl relative">
          <AnimatePresence mode="wait">
            {!showHelp && !showHistory ? (
              <motion.div 
                key="main"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
            {/* Input Section */}
            <div className="space-y-3">
              <div className="relative group">
                <input 
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube or Bilibili URL here..."
                  className={cn(
                    "w-full bg-white border border-[#1D1D1F]/10 rounded-2xl px-6 py-5 text-lg outline-none transition-all duration-300 text-[#1D1D1F]",
                    "focus:border-black/30 focus:ring-8 focus:ring-black/5 shadow-md shadow-black/5 placeholder:text-black/20",
                    isValid === false && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/5"
                  )}
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                  {isValid === true && <Check className="w-5 h-5 text-black" />}
                  {isValid === false && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {url && isValid === null && <Loader2 className="w-5 h-5 text-black/10 animate-spin" />}
                </div>
              </div>
            </div>

            {/* Preview & Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Preview Card */}
              <AnimatePresence mode="wait">
                {isValid && url ? (
                  <motion.a 
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white border border-[#1D1D1F]/5 rounded-3xl p-4 shadow-xl shadow-black/5 flex flex-col gap-4 hover:border-black/10 transition-all group/preview active:scale-[0.98]"
                  >
                    <div className="aspect-video bg-[#F5F5F7] rounded-2xl flex items-center justify-center overflow-hidden relative border border-[#1D1D1F]/5">
                      {url.includes('youtube.com') || url.includes('youtu.be') ? (
                        <img 
                          src={`https://img.youtube.com/vi/${
                            url.includes('v=') 
                              ? url.split('v=')[1]?.split('&')[0] 
                              : url.split('/').pop()?.split('?')[0]
                          }/mqdefault.jpg`} 
                          alt="Thumbnail"
                          className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-500 opacity-90 group-hover/preview:opacity-100"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex flex-col items-center gap-2 opacity-20"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-youtube"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 2-2 68.4 68.4 0 0 1 15 0 2 2 0 0 1 2 2 24.12 24.12 0 0 1 0 10 2 2 0 0 1-2 2 68.4 68.4 0 0 1-15 0 2 2 0 0 1-2-2Z"/><path d="m10 15 5-3-5-3z"/></svg></div>';
                          }}
                        />
                      ) : url.includes('bilibili.com') ? (
                        <div className="flex flex-col items-center gap-3 opacity-20">
                          <Video className="w-12 h-12 text-black" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Bilibili</span>
                        </div>
                      ) : (
                        <Video className="w-10 h-10 text-black/5" />
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/5 transition-colors flex items-center justify-center">
                        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transform translate-y-2 group-hover/preview:translate-y-0 transition-all duration-300 shadow-lg">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      <div className="absolute top-3 left-3">
                        {isPlaylist ? (
                          <span className="px-2 py-1 bg-black text-white text-[9px] font-bold uppercase rounded-full shadow-lg">Playlist</span>
                        ) : (
                          <span className="px-2 py-1 bg-black/5 backdrop-blur-md text-black/60 text-[9px] font-bold uppercase rounded-full border border-black/5">Single</span>
                        )}
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="text-xs font-semibold truncate text-black/70 mb-1 group-hover/preview:text-black transition-colors">{title || url}</p>
                      <p className="text-[10px] text-black/20 font-medium">Click to open original video</p>
                    </div>
                  </motion.a>
                ) : (
                  <div className="bg-black/5 border border-dashed border-black/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-black/10" />
                    </div>
                    <p className="text-xs text-black/20 font-medium">Paste a link to see preview</p>
                  </div>
                )}
              </AnimatePresence>

              {/* Options Column */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.15em] text-black/30 ml-1 italic">Download Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['subtitles', 'transcribe', 'video', 'audio'] as DownloadType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-300",
                          type === t 
                            ? "bg-black text-white shadow-lg shadow-black/10 ring-1 ring-black/20" 
                            : "bg-black/5 border-transparent text-black/40 hover:bg-black/10 hover:border-black/10"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="shrink-0">
                            {t === 'video' && <Video className="w-3.5 h-3.5" />}
                            {t === 'audio' && <Music className="w-3.5 h-3.5" />}
                            {t === 'subtitles' && <Subtitles className="w-3.5 h-3.5" />}
                            {t === 'transcribe' && <Mic className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-[11px] font-bold truncate">
                            {t === 'subtitles' ? 'Subtitles' : 
                             t === 'transcribe' ? 'Whisper' : 
                             t.charAt(0).toUpperCase() + t.slice(1)}
                          </span>
                        </div>
                        {type === t && <div className="shrink-0 w-1 h-1 rounded-full bg-white ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.15em] text-black/30 ml-1 italic">Output Path</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={outputPath}
                      onChange={(e) => setOutputPath(e.target.value)}
                      className="w-full bg-black/5 border border-black/5 rounded-2xl px-5 py-3.5 text-xs outline-none focus:border-black/10 transition-all shadow-sm text-black/60"
                    />
                    <Folder className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Command Output Area */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-black" />
                  <label className="text-[11px] font-black uppercase tracking-[0.15em] text-black/30 italic">Generated Command</label>
                </div>
                {isValid && (
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-full text-[10px] font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-black/10 active:scale-95"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy Command'}
                  </button>
                )}
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-black/5 to-zinc-500/5 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-[#F5F5F7] border border-black/5 rounded-[1.5rem] p-6 font-mono text-xs leading-relaxed overflow-x-auto min-h-[100px] flex items-center shadow-lg shadow-black/5">
                  {isValid && url ? (
                    <code className="text-black/70 whitespace-pre-wrap break-all selection:bg-black/10">
                      {generatedCommand}
                    </code>
                  ) : (
                    <div className="flex items-center gap-3 text-black/10 italic">
                      <Terminal className="w-4 h-4 opacity-50" />
                      <span>Waiting for valid URL input...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : showHelp ? (
          <motion.div 
            key="help"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-20 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-black" />
                </div>
                <h3 className="text-base font-serif italic font-black uppercase tracking-wider text-black">使用帮助</h3>
              </div>
              <button 
                onClick={() => setShowHelp(false)}
                className="p-2 hover:bg-black/5 text-black/40 hover:text-black rounded-xl transition-colors"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-8 pb-8">
              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  快速开始
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { step: "1", text: "将 YouTube 或 Bilibili 链接粘贴到输入框中。" },
                    { step: "2", text: "选择您需要的下载类型（视频、音频或字幕）。" },
                    { step: "3", text: "点击“复制命令”并将其粘贴到您的终端中运行。" }
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4 p-4 bg-black/5 rounded-2xl border border-black/5">
                      <span className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0">{item.step}</span>
                      <p className="text-xs font-medium text-black/60 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  下载模式
                </h4>
                <div className="space-y-3">
                  <div className="p-4 bg-white border border-black/5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-3.5 h-3.5 text-black" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-black">视频模式</span>
                    </div>
                    <p className="text-[10px] text-black/40 leading-relaxed">下载最高画质的视频 (mkv)，并嵌入字幕和元数据。</p>
                  </div>
                  <div className="p-4 bg-white border border-black/5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Music className="w-3.5 h-3.5 text-black" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-black">音频模式</span>
                    </div>
                    <p className="text-[10px] text-black/40 leading-relaxed">提取高质量 MP3 音频，并嵌入封面和元数据。</p>
                  </div>
                  <div className="p-4 bg-white border border-black/5 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Subtitles className="w-3.5 h-3.5 text-black" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-black">智能字幕</span>
                    </div>
                    <p className="text-[10px] text-black/40 leading-relaxed">优先尝试下载原生字幕。如果未检测到，则会自动下载音频并使用 <b>OpenAI Whisper</b> 进行 AI 转录。</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  环境要求
                </h4>
                <div className="p-5 bg-black rounded-3xl text-white space-y-3 shadow-xl">
                  <p className="text-[10px] font-medium opacity-60 uppercase tracking-widest text-white/60">请确保已安装以下工具：</p>
                  <div className="space-y-2 font-mono text-[10px]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span>yt-dlp</span>
                      <span className="font-bold">必须</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span>ffmpeg</span>
                      <span className="font-bold">必须</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>openai-whisper</span>
                      <span className="opacity-40">可选*</span>
                    </div>
                  </div>
                  <p className="text-[9px] opacity-40 italic mt-2">*仅在需要 AI 转录时使用。</p>
                </div>
              </section>

              {/* Bookmarklet Section */}
              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  浏览器插件 (Bookmarklet)
                </h4>
                <div className="bg-black/5 rounded-2xl p-5 space-y-4 border border-black/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-black/10 rounded-lg flex items-center justify-center">
                      <Info className="w-3.5 h-3.5 text-black" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-black/70">一键提取工具</h4>
                  </div>
                  <p className="text-[11px] text-black/40 leading-relaxed font-medium">
                    将下方按钮拖动到您的浏览器书签栏。在 YouTube 页面点击它，即可瞬间生成并复制下载命令。
                  </p>
                  <a 
                    ref={bookmarkletRef}
                    href="#"
                    onClick={(e) => {
                      if (e.currentTarget.getAttribute('href')?.startsWith('javascript:')) {
                        // Allow dragging. If they click it, we can show a hint or do nothing.
                        // Bookmarklets are primarily for dragging.
                      } else {
                        e.preventDefault();
                      }
                    }}
                    className="block w-full py-3 bg-black rounded-xl text-xs font-bold text-white text-center hover:bg-zinc-800 transition-all shadow-md cursor-move active:scale-[0.98]"
                  >
                    YT-DLP Architect
                  </a>
                </div>
              </section>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-20 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center">
                  <History className="w-5 h-5 text-black" />
                </div>
                <h3 className="text-base font-serif italic font-black uppercase tracking-wider text-black">Recent Architectures</h3>
              </div>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button 
                    onClick={clearHistory}
                    className="p-2 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-xl transition-colors"
                    title="Clear History"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-black/5 text-black/40 hover:text-black rounded-xl transition-colors"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-black/10" />
                  </div>
                  <p className="text-xs text-black/20 font-medium italic">Your command history will appear here</p>
                </div>
              ) : (
                history.map((item) => {
                  const isYoutube = item.url.includes('youtube.com') || item.url.includes('youtu.be');
                  const videoId = isYoutube ? (item.url.split('v=')[1]?.split('&')[0] || item.url.split('/').pop()) : null;
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group p-3 bg-black/5 border border-transparent hover:border-black/10 hover:bg-white rounded-2xl transition-all cursor-pointer relative flex gap-3"
                      onClick={() => {
                        setUrl(item.url);
                        setType(item.type);
                        setShowHistory(false);
                      }}
                    >
                      <div className="w-16 h-10 bg-[#F5F5F7] rounded-lg flex items-center justify-center overflow-hidden shrink-0 border border-black/5">
                        {isYoutube ? (
                          <img 
                            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} 
                            alt="Thumb"
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Youtube className="w-4 h-4 text-black/10" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            {item.type === 'video' && <Video className="w-2.5 h-2.5 text-black/40" />}
                            {item.type === 'audio' && <Music className="w-2.5 h-2.5 text-black/40" />}
                            {item.type === 'subtitles' && <Subtitles className="w-2.5 h-2.5 text-black/40" />}
                            <span className="text-[8px] font-bold uppercase text-black/20 tracking-widest">{item.type}</span>
                          </div>
                          <span className="text-[8px] text-black/20 font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-[10px] font-medium truncate text-black/60 pr-6">{item.title || item.url}</p>
                      </div>
                      <div className="absolute top-1/2 -translate-y-1/2 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyFromHistory(item.command);
                          }}
                          className="p-1.5 bg-black rounded-lg shadow-sm text-white hover:bg-zinc-800 transition-all active:scale-90"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
            
            {history.length > 0 && (
              <p className="text-[9px] text-center text-black/10 mt-6 font-mono uppercase tracking-widest">
                Last 10 commands preserved
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          <p className="text-[10px] text-black/10 font-mono tracking-[0.2em] uppercase">
            Architectural Precision
          </p>
          <div className="hidden sm:block w-1 h-1 rounded-full bg-black/5" />
          <a 
            href="https://324893.xyz/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black/10 hover:text-black transition-colors group"
          >
            <Globe className="w-3 h-3 opacity-50 group-hover:opacity-100" />
            <span>324893.xyz</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

