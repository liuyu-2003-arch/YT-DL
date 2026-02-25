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
import { io, Socket } from 'socket.io-client';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CopyButton = ({ text, className }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-lg transition-all active:scale-95",
        copied ? "bg-emerald-500/20 text-emerald-500" : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white",
        className
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

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
  const [outputPath, setOutputPath] = useState('/Users/yuliu/Movies/YouTube DL');
  const [copied, setCopied] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLogs, setDownloadLogs] = useState<string[]>([]);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
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

  // Socket connection
  useEffect(() => {
    socketRef.current = io({
      path: "/socket.io/",
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    socketRef.current.on('connect', () => {
      setIsSocketConnected(true);
      console.log("Connected to local server");
    });

    socketRef.current.on('connect_error', () => {
      setIsSocketConnected(false);
    });

    socketRef.current.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    socketRef.current.on('download-log', (log: string) => {
      setDownloadLogs(prev => [...prev, log].slice(-100)); // Keep last 100 lines
    });

    socketRef.current.on('download-progress', (progress: number) => {
      setDownloadProgress(progress);
    });

    socketRef.current.on('download-complete', (success: boolean) => {
      setIsDownloading(false);
      setDownloadStatus(success ? 'success' : 'error');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [downloadLogs]);

  const handleStartDownload = () => {
    if (!generatedCommand || !socketRef.current) return;
    
    setDownloadLogs([]);
    setDownloadProgress(0);
    setIsDownloading(true);
    setDownloadStatus('running');
    
    socketRef.current.emit('start-download', generatedCommand);
  };

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

    if (valid) {
      // Auto-download trigger for OpenClaw
      if (autoDownload && isSocketConnected && !isDownloading) {
        setTimeout(() => handleStartDownload(), 800);
      }

      fetch(`/api/info?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setTitle(data.title);
          setVideoInfo(data);
        })
        .catch(() => {
          setTitle('');
          setVideoInfo(null);
        });
    } else {
      setTitle('');
      setVideoInfo(null);
    }
  }, [url]);

  const generatedCommand = useMemo(() => {
    if (!isValid || !url) return '';

    const baseOutput = `-o "${outputPath}/%(title)s/%(title)s.%(ext)s"`;
    const playlistFlag = isPlaylist ? '--yes-playlist' : '--no-playlist';
    
    switch (type) {
      case 'video':
        return `TS_FILE="/tmp/yt_dlp_ts_$(date +%s)" && touch "$TS_FILE" && \\\n` +
               `yt-dlp ${playlistFlag} --merge-output-format mkv --write-subs --write-auto-subs --sub-langs "en.*,zh-Hans,zh-Hant,zh-Hans-en,zh-Hant-en,zh.*" --convert-subs srt --embed-subs --embed-thumbnail --embed-metadata --ignore-errors --sleep-subtitles 5 --no-cache-dir ${baseOutput} "${url}" && \\\n` +
               `echo "🏷️ 正在重命名并提取文本内容 (自动去重)..." && \\\n` +
               `found_subs=false; \\\n` +
               `for f in "${outputPath}/"*/*.srt ; do \\\n` +
               `  [ -f "$f" ] || continue; \\\n` +
               `  [ "$f" -nt "$TS_FILE" ] || continue; \\\n` +
               `  found_subs=true; \\\n` +
               `  [[ "$f" == *"[原始字幕]"* ]] || [[ "$f" == *"[自动翻译]"* ]] || [[ "$f" == *"[自动生成]"* ]] && continue; \\\n` +
               `  new_name="$f"; \\\n` +
               `  if [[ "$f" == *"orig"* ]]; then label="原始字幕"; \\\n` +
               `  elif [[ "$f" == *"en-en"* ]]; then label="自动生成"; \\\n` +
               `  elif [[ "$f" == *"-en"* ]] || [[ "$f" == *"-zh-"* ]] || [[ "$f" == *".zh-Hans."* ]] || [[ "$f" == *".zh-Hant."* ]]; then label="自动翻译"; \\\n` +
               `  else label="原始字幕"; fi; \\\n` +
               `  new_name="\${f%.*}.[\$label].srt"; \\\n` +
               `  [ "$f" != "$new_name" ] && [ ! -f "$new_name" ] && mv "$f" "$new_name"; \\\n` +
               `  sed -E 's/<[^>]*>//g; /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/d; /^[0-9]+$/d; /^WEBVTT/d; /^Kind:/d; /^Language:/d; /^$/d' "$new_name" | uniq > "\${new_name%.*}.txt" ; \\\n` +
               `done; \\\n` +
               `if [ "$found_subs" = "false" ]; then \\\n` +
               `  echo "⚠️ 未发现字幕，启动 Whisper 语音转文字..." && \\\n` +
               `  for f in "${outputPath}/"*/*.mkv ; do \\\n` +
               `    [ -f "$f" ] || continue; \\\n` +
               `    [ "$f" -nt "$TS_FILE" ] || continue; \\\n` +
               `    whisper "$f" --model medium --language Chinese --output_dir "\${f%/*}" --output_format srt && \\\n` +
               `    mv "\${f%.*}.srt" "\${f%.*}.[Whisper].srt" && \\\n` +
               `    sed -E 's/<[^>]*>//g; /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/d; /^[0-9]+$/d; /^WEBVTT/d; /^Kind:/d; /^Language:/d; /^$/d' "\${f%.*}.[Whisper].srt" | uniq > "\${f%.*}.[Whisper].txt" ; \\\n` +
               `  done && \\\n` +
               `  echo "✅ 视频下载与 Whisper 语音转文字完成！"; \\\n` +
               `else \\\n` +
               `  echo "✅ 视频下载与字幕处理完成！"; \\\n` +
               `fi && rm "$TS_FILE"`;
      
      case 'audio':
        return `yt-dlp ${playlistFlag} -x --audio-format mp3 --embed-thumbnail --embed-metadata --ignore-errors ${baseOutput} "${url}"`;
      
      case 'subtitles':
        return `TS_FILE="/tmp/yt_dlp_ts_$(date +%s)" && touch "$TS_FILE" && \\\n` +
               `yt-dlp ${playlistFlag} "${url}" -o "${outputPath}/%(title)s/%(title)s.%(ext)s" --write-subs --write-auto-subs --sub-langs "en.*,zh-Hans,zh-Hant,zh-Hans-en,zh-Hant-en,zh.*" --convert-subs srt --skip-download --ignore-errors --sleep-subtitles 5 --no-cache-dir && \\\n` +
               `echo "🏷️ 正在重命名并提取文本内容 (自动去重)..." && \\\n` +
               `found_subs=false; \\\n` +
               `for f in "${outputPath}/"*/*.srt ; do \\\n` +
               `  [ -f "$f" ] || continue; \\\n` +
               `  [ "$f" -nt "$TS_FILE" ] || continue; \\\n` +
               `  found_subs=true; \\\n` +
               `  [[ "$f" == *"[原始字幕]"* ]] || [[ "$f" == *"[自动翻译]"* ]] || [[ "$f" == *"[自动生成]"* ]] && continue; \\\n` +
               `  new_name="$f"; \\\n` +
               `  if [[ "$f" == *"orig"* ]]; then label="原始字幕"; \\\n` +
               `  elif [[ "$f" == *"en-en"* ]]; then label="自动生成"; \\\n` +
               `  elif [[ "$f" == *"-en"* ]] || [[ "$f" == *"-zh-"* ]] || [[ "$f" == *".zh-Hans."* ]] || [[ "$f" == *".zh-Hant."* ]]; then label="自动翻译"; \\\n` +
               `  else label="原始字幕"; fi; \\\n` +
               `  new_name="\${f%.*}.[\$label].srt"; \\\n` +
               `  [ "$f" != "$new_name" ] && [ ! -f "$new_name" ] && mv "$f" "$new_name"; \\\n` +
               `  sed -E 's/<[^>]*>//g; /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/d; /^[0-9]+$/d; /^WEBVTT/d; /^Kind:/d; /^Language:/d; /^$/d' "$new_name" | uniq > "\${new_name%.*}.txt" ; \\\n` +
               `done; \\\n` +
               `if [ "$found_subs" = "false" ]; then \\\n` +
               `  echo "⚠️ 未发现字幕，启动 Whisper 语音转文字..." && \\\n` +
               `  yt-dlp ${playlistFlag} -x --audio-format wav -o "${outputPath}/%(title)s/%(title)s.%(ext)s" "${url}" && \\\n` +
               `  for f in "${outputPath}/"*/*.wav ; do \\\n` +
               `    [ -f "$f" ] || continue; \\\n` +
               `    [ "$f" -nt "$TS_FILE" ] || continue; \\\n` +
               `    whisper "$f" --model medium --language Chinese --output_dir "\${f%/*}" --output_format srt && \\\n` +
               `    mv "\${f%.*}.srt" "\${f%.*}.[Whisper].srt" && \\\n` +
               `    sed -E 's/<[^>]*>//g; /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/d; /^[0-9]+$/d; /^WEBVTT/d; /^Kind:/d; /^Language:/d; /^$/d' "\${f%.*}.[Whisper].srt" | uniq > "\${f%.*}.[Whisper].txt" ; \\\n` +
               `  done && \\\n` +
               `  echo "✅ Whisper 语音转文字完成！"; \\\n` +
               `else \\\n` +
               `  echo "✅ 字幕重命名与文本提取完成！"; \\\n` +
               `fi && rm "$TS_FILE"`;
      
      case 'transcribe':
        return `TS_FILE="/tmp/yt_dlp_ts_$(date +%s)" && touch "$TS_FILE" && \\\n` +
               `echo "🎙️ 正在启动 Whisper 语音识别转录..." && \\\n` +
               `yt-dlp ${playlistFlag} "${url}" -o "${outputPath}/%(title)s/%(title)s.%(ext)s" -x --audio-format mp3 --no-cache-dir && \\\n` +
               `for f in "${outputPath}/"*/*.mp3 ; do \\\n` +
               `  [ -f "$f" ] || continue; \\\n` +
               `  [ "$f" -nt "$TS_FILE" ] || continue; \\\n` +
               `  whisper "$f" --model medium --output_format srt,txt --output_dir "\${f%/*}" && \\\n` +
               `  mv "\${f%.*}.srt" "\${f%.*}.[Whisper转录].srt" && \\\n` +
               `  mv "\${f%.*}.txt" "\${f%.*}.[Whisper转录].txt"; \\\n` +
               `done && \\\n` +
               `echo "✅ 转录完成！请在视频对应目录中查看带 [Whisper转录] 标识的文件" && rm "$TS_FILE"`;
      
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
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-black/20 italic">Video URL</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-[10px] font-bold text-black/30 group-hover:text-black/50 transition-colors">自动下载 (OpenClaw)</span>
                    <button 
                      onClick={() => setAutoDownload(!autoDownload)}
                      className={cn(
                        "w-8 h-4 rounded-full transition-all duration-300 relative",
                        autoDownload ? "bg-emerald-500" : "bg-black/10"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-2 h-2 bg-white rounded-full transition-all duration-300",
                        autoDownload ? "left-5" : "left-1"
                      )} />
                    </button>
                  </label>
                </div>
              </div>
              <div className="relative group">
                <input 
                  id="url-input"
                  type="text"
                  value={url}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Detect Bilibili/YouTube share strings that contain text + URL
                    if (val.includes('http') && (val.includes('【') || val.includes('】') || val.trim().split(/\s+/).length > 1)) {
                      const urlMatch = val.match(/https?:\/\/[^\s]+/);
                      if (urlMatch) {
                        setUrl(urlMatch[0]);
                        return;
                      }
                    }
                    setUrl(val);
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="Paste YouTube or Bilibili URL here..."
                  className={cn(
                    "w-full bg-white border border-[#1D1D1F]/10 rounded-2xl pl-6 pr-16 py-5 text-lg outline-none transition-all duration-300 text-[#1D1D1F]",
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
                      {videoInfo?.thumbnail_url ? (
                        <img 
                          src={videoInfo.thumbnail_url} 
                          alt="Thumbnail"
                          className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-500 opacity-90 group-hover/preview:opacity-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Video className="w-10 h-10 text-black/5" />
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/5 transition-colors flex items-center justify-center">
                        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transform translate-y-2 group-hover/preview:translate-y-0 transition-all duration-300 shadow-lg">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        {isPlaylist ? (
                          <span className="px-2 py-1 bg-black text-white text-[9px] font-bold uppercase rounded-full shadow-lg">Playlist</span>
                        ) : (
                          <span className="px-2 py-1 bg-black/5 backdrop-blur-md text-black/60 text-[9px] font-bold uppercase rounded-full border border-black/5">Single</span>
                        )}
                        {videoInfo?.max_res && (
                          <span className={cn(
                            "px-2 py-1 text-[9px] font-bold uppercase rounded-full shadow-sm",
                            videoInfo.max_res === '4K' ? "bg-orange-500 text-white" : "bg-white/80 backdrop-blur-md text-black/60 border border-black/5"
                          )}>
                            {videoInfo.max_res}
                          </span>
                        )}
                        {videoInfo?.has_zh_sub && (
                          <span className="px-2 py-1 bg-blue-500 text-white text-[9px] font-bold uppercase rounded-full shadow-sm">中字</span>
                        )}
                        {videoInfo?.has_en_sub && (
                          <span className="px-2 py-1 bg-emerald-500 text-white text-[9px] font-bold uppercase rounded-full shadow-sm">英字</span>
                        )}
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="text-xs font-semibold truncate text-black/70 group-hover/preview:text-black transition-colors">{title || url}</p>
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

            {/* Download Progress & Logs */}
            <AnimatePresence>
              {(isDownloading || downloadStatus !== 'idle') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 space-y-4 overflow-hidden"
                >
                  <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-black/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center",
                          downloadStatus === 'running' ? "bg-emerald-500/10 text-emerald-500" :
                          downloadStatus === 'success' ? "bg-emerald-500 text-white" :
                          downloadStatus === 'error' ? "bg-red-500 text-white" : "bg-black/5 text-black/40"
                        )}>
                          {downloadStatus === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                           downloadStatus === 'success' ? <Check className="w-4 h-4" /> :
                           downloadStatus === 'error' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-black">
                            {downloadStatus === 'running' ? '正在下载/处理中...' :
                             downloadStatus === 'success' ? '下载完成！' :
                             downloadStatus === 'error' ? '下载失败' : '准备就绪'}
                          </h4>
                          <p className="text-[10px] text-black/40 font-medium">
                            {downloadStatus === 'running' ? `当前进度: ${downloadProgress.toFixed(1)}%` :
                             downloadStatus === 'success' ? '文件已保存至您的输出目录' :
                             downloadStatus === 'error' ? '请查看下方日志了解详情' : ''}
                          </p>
                        </div>
                      </div>
                      {downloadStatus !== 'running' && (
                        <button 
                          onClick={() => setDownloadStatus('idle')}
                          className="text-[10px] font-bold text-black/20 hover:text-black transition-colors"
                        >
                          关闭
                        </button>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress}%` }}
                        className={cn(
                          "h-full transition-all duration-300",
                          downloadStatus === 'error' ? "bg-red-500" : "bg-emerald-500"
                        )}
                      />
                    </div>

                    {/* Terminal Logs */}
                    <div className="bg-black rounded-2xl p-4 font-mono text-[10px] leading-relaxed h-48 overflow-y-auto scrollbar-hide">
                      {downloadLogs.map((log, i) => (
                        <div key={i} className="text-emerald-500/80 whitespace-pre-wrap">
                          <span className="text-emerald-500/30 mr-2">[{i+1}]</span>
                          {log}
                        </div>
                      ))}
                      {downloadLogs.length === 0 && (
                        <div className="text-white/20 italic">正在初始化终端...</div>
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Command Output Area */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-black" />
                  <label className="text-[11px] font-black uppercase tracking-[0.15em] text-black/30 italic">Generated Command</label>
                </div>
                {isValid && (
                  <div className="flex items-center gap-2">
                    <div className="relative group/tooltip">
                      {!isSocketConnected && (
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 p-4 bg-black text-white rounded-2xl text-[10px] leading-relaxed opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 z-50 shadow-2xl">
                          <div className="font-bold mb-1 text-amber-400 flex items-center gap-2">
                            <Info className="w-3 h-3" />
                            当前处于“在线预览”模式
                          </div>
                          Vercel 环境无法直接执行下载。请在本地终端运行项目以解锁“一键下载”功能。
                          <div className="mt-2 text-white/40 italic">提示：点击帮助查看本地运行指南</div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-black"></div>
                        </div>
                      )}
                      <button 
                        id="start-download-btn"
                        onClick={handleStartDownload}
                        disabled={isDownloading || !isSocketConnected}
                        className={cn(
                          "flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold transition-all shadow-xl shadow-black/10 active:scale-95",
                          (isDownloading || !isSocketConnected)
                            ? "bg-black/10 text-black/40 cursor-not-allowed" 
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        )}
                      >
                        {isDownloading && isSocketConnected ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
                        {!isSocketConnected ? '仅限本地模式' : isDownloading ? '下载中...' : '启动下载'}
                      </button>
                    </div>
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-full text-[10px] font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-black/10 active:scale-95"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy Command'}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-black/5 to-zinc-500/5 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-[#F5F5F7] border border-black/5 rounded-[1.5rem] p-6 font-mono text-xs leading-relaxed overflow-x-auto min-h-[100px] flex items-center shadow-lg shadow-black/5">
                  {isValid && url ? (
                    <code id="generated-command" className="text-black/70 whitespace-pre-wrap break-all selection:bg-black/10">
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
            {/* OpenClaw Metadata (Hidden) */}
            <script id="openclaw-metadata" type="application/json">
              {JSON.stringify({
                version: "1.0",
                is_connected: isSocketConnected,
                current_command: generatedCommand,
                status: downloadStatus,
                progress: downloadProgress
              })}
            </script>
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
                    <div key={item.step} className="flex items-center gap-4 p-5 bg-black/[0.03] rounded-2xl border border-black/5 hover:bg-black/[0.05] transition-colors">
                      <span className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[11px] font-black text-white shadow-lg shrink-0">{item.step}</span>
                      <p className="text-[13px] font-medium text-black/70 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  下载模式
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-5 bg-white border border-black/5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-4 h-4 text-black" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-black">视频模式</span>
                    </div>
                    <p className="text-[11px] text-black/50 leading-relaxed">下载最高画质的视频 (mkv)，并嵌入字幕和元数据。</p>
                  </div>
                  <div className="p-5 bg-white border border-black/5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Music className="w-4 h-4 text-black" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-black">音频模式</span>
                    </div>
                    <p className="text-[11px] text-black/50 leading-relaxed">提取高质量 MP3 音频，并嵌入封面和元数据。</p>
                  </div>
                  <div className="p-5 bg-white border border-black/5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Subtitles className="w-4 h-4 text-black" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-black">智能字幕</span>
                    </div>
                    <p className="text-[11px] text-black/50 leading-relaxed">优先尝试下载原生字幕。如果未检测到，则会自动下载音频并使用 <b>OpenAI Whisper</b> 进行 AI 转录。</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  本地运行指南 (Local Deployment)
                </h4>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 space-y-6">
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-emerald-900">为什么需要本地运行？</h5>
                    <p className="text-[11px] text-emerald-900/60 leading-relaxed">
                      Vercel 等云平台出于安全和资源限制，不允许运行 <b>yt-dlp</b> 和 <b>ffmpeg</b>。
                      在本地运行可以让网页直接调用您电脑上的硬件资源和下载工具，实现毫秒级响应。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-xs font-bold text-emerald-900">详细操作步骤：</h5>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-emerald-900">安装基础环境</p>
                          <p className="text-[10px] text-emerald-900/60">确保您的电脑已安装 Node.js (v18+)。</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-emerald-900">下载并初始化</p>
                          <div className="relative group">
                            <div className="bg-black rounded-xl p-4 font-mono text-[10px] text-emerald-400/90 space-y-1">
                              <div># 克隆仓库</div>
                              <div className="text-white">git clone [您的仓库地址]</div>
                              <div className="mt-2"># 进入目录并安装依赖</div>
                              <div className="text-white">cd yt-dlp-architect && npm install</div>
                            </div>
                            <CopyButton 
                              text={`git clone [您的仓库地址]\ncd yt-dlp-architect && npm install`} 
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-emerald-900">启动服务</p>
                          <div className="relative group">
                            <div className="bg-black rounded-xl p-4 font-mono text-[10px] text-emerald-400/90 space-y-1">
                              <div className="text-white">npm run dev</div>
                            </div>
                            <CopyButton 
                              text="npm run dev" 
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                            />
                          </div>
                          <p className="text-[10px] text-emerald-900/60">
                            终端显示 <span className="text-emerald-600 font-bold">Server running on http://localhost:3000</span> 即表示成功。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white/50 rounded-2xl border border-emerald-500/10">
                    <p className="text-[10px] text-emerald-800/70 italic leading-relaxed">
                      <b>提示：</b> 启动后，建议在浏览器地址栏输入 <span className="text-emerald-600 font-bold underline">https://yt-dlp.324893.xyz</span> 访问。
                      此时页面右下角会显示“连接成功”，即可解锁“启动下载”按钮。
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  环境依赖安装 (macOS)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-zinc-900 rounded-3xl text-white space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">yt-dlp</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-[8px] font-bold uppercase">核心</span>
                    </div>
                    <div className="bg-black/50 rounded-xl p-3 font-mono text-[9px] text-zinc-400">
                      brew install yt-dlp
                    </div>
                    <CopyButton 
                      text="brew install yt-dlp" 
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100"
                    />
                  </div>
                  <div className="p-5 bg-zinc-900 rounded-3xl text-white space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">ffmpeg</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-[8px] font-bold uppercase">核心</span>
                    </div>
                    <div className="bg-black/50 rounded-xl p-3 font-mono text-[9px] text-zinc-400">
                      brew install ffmpeg
                    </div>
                    <CopyButton 
                      text="brew install ffmpeg" 
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100"
                    />
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

              {/* OpenClaw API Section */}
              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-black/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  OpenClaw API 接口
                </h4>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-blue-900/60 leading-relaxed font-medium">
                      您可以通过 API 直接调用服务。<b>注意：</b> 如果您在本地运行，请确保 API 地址指向您的本地或映射地址。
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[9px] font-bold text-blue-500 uppercase">Live API</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">1. API 自动发现 (推荐)</h5>
                      <p className="text-[10px] text-blue-900/50">让 OpenClaw 访问此地址，它会自动理解所有接口：</p>
                      <div className="relative group">
                        <div className="bg-black rounded-xl p-4 font-mono text-[10px] text-blue-400/90">
                          GET https://yt-dlp.324893.xyz/api
                        </div>
                        <CopyButton text="https://yt-dlp.324893.xyz/api" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">2. 视频下载接口</h5>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-[8px] font-black rounded uppercase">POST</span>
                        <code className="text-[10px] font-bold text-blue-900">/api/download</code>
                      </div>
                      <div className="relative group">
                        <div className="bg-black rounded-xl p-4 font-mono text-[9px] text-blue-400/90 space-y-2">
                          <div>{"{"}</div>
                          <div className="pl-4">"url": "视频链接",</div>
                          <div className="pl-4">"type": "video", <span className="text-white/20">// video | audio | subtitle</span></div>
                          <div className="pl-4">"outputPath": "/Users/yuliu/Movies/YouTube DL/"</div>
                          <div>{"}"}</div>
                        </div>
                        <CopyButton text={`{"url": "视频链接", "type": "video"}`} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                  </div>
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

