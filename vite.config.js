import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import dataHandler from './api/data.js'
import activityHandler from './api/activity.js'

import templatesHandler from './api/templates.js'
import fs from 'fs'
import path from 'path'


// Load environment variables and assign them to process.env
const env = loadEnv('', process.cwd(), '');
Object.assign(process.env, env);

// Middleware helper to convert Vite's dev server request/response to match Vercel's
const vercelApiMiddleware = (handler) => {
  return async (req, res, next) => {
    try {
      // Parse query parameters
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      req.query = Object.fromEntries(url.searchParams.entries());

      // Parse JSON body if applicable
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
        const bodyPromise = new Promise((resolve) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve({});
            }
          });
        });
        req.body = await bodyPromise;
      }

      // Add Express-like helpers to res
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };
      res.send = (data) => {
        res.end(data);
      };

      await handler(req, res);
    } catch (error) {
      console.error("Vite API Middleware Error:", error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vercel-api-emulator',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Parse url pathname safely
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          if (url.pathname === '/api/data') {
            vercelApiMiddleware(dataHandler)(req, res, next);
          } else if (url.pathname === '/api/activity') {
            vercelApiMiddleware(activityHandler)(req, res, next);
          } else if (url.pathname === '/api/gemini') {
            vercelApiMiddleware(geminiHandler)(req, res, next);
          } else if (url.pathname === '/api/templates') {
            vercelApiMiddleware(templatesHandler)(req, res, next);
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 3000,
    strictPort: true
  }
})
