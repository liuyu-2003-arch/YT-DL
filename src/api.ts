import express from "express";
import fetch from "node-fetch";
import { spawn } from "child_process";

export const apiRouter = express.Router();

apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", environment: process.env.NODE_ENV || "development" });
});

apiRouter.get("/", (req, res) => {
  res.json({
    name: "YT-DLP Architect API",
    version: "1.0.0",
    description: "API for video information extraction and downloading",
    status: {
      can_download: !!process.env.VERCEL ? "No (Vercel environment)" : "Yes (Local environment)",
      platform: process.env.VERCEL ? "Vercel" : "Local/Container"
    },
    endpoints: {
      info: {
        path: "/api/info",
        method: "GET",
        params: { url: "string (required)" },
        description: "Extract video metadata (title, thumbnail, resolution, etc.)"
      },
      download: {
        path: "/api/download",
        method: "POST",
        body: {
          url: "string (required)",
          type: "video | audio | subtitle (default: video)",
          outputPath: "string (optional)"
        },
        description: "Trigger a local download process. ONLY WORKS ON LOCAL SERVER."
      }
    },
    usage_example: `curl -X POST ${process.env.VERCEL ? 'https://yt-dlp.324893.xyz' : 'http://localhost:3000'}/api/download -H 'Content-Type: application/json' -d '{"url": "YOUR_URL", "type": "video"}'`
  });
});

apiRouter.get("/info", async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const biliMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
    if (biliMatch) {
      const bvid = biliMatch[1];
      const bApiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
      const bRes = await fetch(bApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.bilibili.com/'
        }
      });
      const bJson = (await bRes.json()) as any;

      if (bJson.code === 0) {
        const data = bJson.data;
        let resolution = '1080P';
        if (data.dimension) {
            const { width, height } = data.dimension;
            if (width >= 3840 || height >= 2160) resolution = '4K';
            else if (width >= 2560 || height >= 1440) resolution = '2K';
            else if (width >= 1920 || height >= 1080) resolution = '1080P';
            else resolution = '720P';
        }

        let has_zh = false;
        let has_en = false;
        if (data.subtitle && data.subtitle.list) {
            data.subtitle.list.forEach((sub: any) => {
                const lan = sub.lan;
                const doc = sub.lan_doc;
                if (lan.includes('zh') || doc.includes('中')) has_zh = true;
                if (lan.includes('en') || doc.includes('英')) has_en = true;
            });
        }

        return res.status(200).json({
          title: data.title,
          author_name: data.owner.name,
          thumbnail_url: data.pic.replace('http://', 'https://'),
          provider: 'bilibili',
          max_res: resolution,
          has_zh_sub: has_zh,
          has_en_sub: has_en
        });
      }
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const ytResponse = await fetch(oembedUrl);

    if (ytResponse.ok) {
      const data = (await ytResponse.json()) as any;
      return res.status(200).json({
        title: data.title,
        author_name: data.author_name,
        thumbnail_url: data.thumbnail_url,
        provider: 'youtube',
        max_res: null, 
        has_zh_sub: null,
        has_en_sub: null
      });
    }

    throw new Error('Platform not supported or video not found');
  } catch (error) {
    console.error("API Info Error:", error);
    return res.status(500).json({ error: 'Failed to fetch video details' });
  }
});

apiRouter.post("/download", (req, res) => {
  const { url, type, outputPath } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  if (process.env.VERCEL) {
    return res.status(403).json({ error: 'Download not supported in Vercel environment. Please use local server.' });
  }

  const path = outputPath || "/Users/yuliu/Movies/YouTube DL/";
  const downloadType = type || "video";

  let command = "";
  if (downloadType === "video") {
    command = `yt-dlp --no-playlist "${url}" -o "${path}%(title)s/%(title)s.%(ext)s" --write-subs --write-auto-subs --sub-langs "en.*,zh-Hans,zh-Hant,zh-Hans-en,zh-Hant-en,zh.*" --convert-subs srt --embed-subs --embed-metadata --merge-output-format mkv --ignore-errors --no-cache-dir`;
  } else if (downloadType === "audio") {
    command = `yt-dlp --no-playlist "${url}" -o "${path}%(title)s/%(title)s.%(ext)s" -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --embed-metadata --ignore-errors --no-cache-dir`;
  } else if (downloadType === "subtitle") {
    command = `yt-dlp --no-playlist "${url}" -o "${path}%(title)s/%(title)s.%(ext)s" --write-subs --write-auto-subs --sub-langs "en.*,zh-Hans,zh-Hant,zh-Hans-en,zh-Hant-en,zh.*" --convert-subs srt --skip-download --ignore-errors --no-cache-dir`;
  }

  console.log("API Starting download:", command);
  const downloadProcess = spawn("bash", ["-c", command]);
  downloadProcess.on("close", (code) => {
    console.log(`API Download finished with code ${code}`);
  });

  res.json({ 
    status: "started", 
    command,
    message: "Download process started in background. Check server logs for details."
  });
});
