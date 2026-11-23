const path = require("node:path");

const backendDirectory = __dirname;
const frontendDirectory = path.resolve(backendDirectory, "../frontend");

module.exports = {
  apps: [
    {
      name: "kafaat-backend",
      cwd: backendDirectory,
      script: "dist/main.js",
      node_args: "--env-file=.env.production",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "kafaat-frontend",
      cwd: frontendDirectory,
      script: ".next/standalone/server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3000",
        BACKEND_API_URL: "http://127.0.0.1:3001/api/v1",
      },
    },
  ],
};
