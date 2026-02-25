import express from "express";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import { createServer } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";

async function startServer() {
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: "*",
    },
  });
  const PORT = 3000;

  // API routes
  app.get("/api/info", async (req, res) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
      // === 1. Bilibili 处理逻辑 ===
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

          // --- 解析分辨率 ---
          let resolution = '1080P';
          if (data.dimension) {
              const { width, height } = data.dimension;
              if (width >= 3840 || height >= 2160) resolution = '4K';
              else if (width >= 2560 || height >= 1440) resolution = '2K';
              else if (width >= 1920 || height >= 1080) resolution = '1080P';
              else resolution = '720P';
          }

          // --- 解析字幕 ---
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

      // === 2. YouTube 处理逻辑 ===
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

  app.post("/api/download", (req, res) => {
    const { url, type, outputPath } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing URL' });
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
    
    const process = spawn("bash", ["-c", command]);
    let logs = "";

    process.stdout.on("data", (data) => {
      logs += data.toString();
    });

    process.stderr.on("data", (data) => {
      logs += `ERROR: ${data.toString()}`;
    });

    process.on("close", (code) => {
      console.log(`API Download finished with code ${code}`);
    });

    res.json({ 
      status: "started", 
      command,
      message: "Download process started in background. Check server logs for details."
    });
  });

  // WebSocket logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("start-download", (command: string) => {
      console.log("Starting download with command:", command);
      
      // Add --newline and a custom progress template to make parsing easier
      // We append it to the command if it's a yt-dlp call
      let modifiedCommand = command;
      if (command.includes("yt-dlp")) {
        modifiedCommand = command.replace("yt-dlp", "yt-dlp --newline --progress-template \"[progress] %(progress.percentage)s%\"");
      }

      const process = spawn("bash", ["-c", modifiedCommand]);

      process.stdout.on("data", (data) => {
        const output = data.toString();
        socket.emit("download-log", output);

        // Parse progress from our custom template
        // [progress] 10.5%
        const progressMatch = output.match(/\[progress\]\s+(\d+(\.\d+)?)%/);
        if (progressMatch) {
          socket.emit("download-progress", parseFloat(progressMatch[1]));
        } else {
          // Fallback to standard yt-dlp progress format
          const fallbackMatch = output.match(/(\d+(\.\d+)?)%/);
          if (fallbackMatch) {
            socket.emit("download-progress", parseFloat(fallbackMatch[1]));
          }
        }
      });

      process.stderr.on("data", (data) => {
        socket.emit("download-log", `ERROR: ${data.toString()}`);
      });

      process.on("close", (code) => {
        socket.emit("download-complete", code === 0);
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
