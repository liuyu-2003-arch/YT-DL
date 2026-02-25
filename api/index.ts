import { app, createServerApp } from '../server';

// Initialize the app for Vercel
let initialized = false;

export default async function handler(req: any, res: any) {
  if (!initialized) {
    await createServerApp();
    initialized = true;
  }
  return app(req, res);
}
