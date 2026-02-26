import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import { app } from "./src/app";

export { app };

export async function createServerApp() {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: "*",
    },
  });
  const PORT = 3000;

  // WebSocket logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("start-download", (command: string) => {
      console.log("Starting download with command:", command);
      
      let modifiedCommand = command;
      if (command.includes("yt-dlp")) {
        modifiedCommand = command.replace("yt-dlp", "yt-dlp --newline --progress-template \"[progress] %(progress.percentage)s%\"");
      }

      const process = spawn("bash", ["-c", modifiedCommand]);

      process.stdout.on("data", (data) => {
        const output = data.toString();
        socket.emit("download-log", output);

        const progressMatch = output.match(/\[progress\]\s+(\d+(\.\d+)?)%/);
        if (progressMatch) {
          socket.emit("download-progress", parseFloat(progressMatch[1]));
        } else {
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
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  return { httpServer, PORT };
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  createServerApp().then(({ httpServer, PORT }) => {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}
