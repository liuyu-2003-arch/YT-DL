import express from "express";
import { apiRouter } from "./router";

export const app = express();
app.use(express.json());

// Mount API routes
app.use("/api", apiRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: process.env.NODE_ENV || "development" });
});
