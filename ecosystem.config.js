// ecosystem.config.js
module.exports = {
  apps: [
    {
      // ─── PROCESSUS 1 : Serveur HTTP / API / WhatsApp ───────────────────
      name: 'saas-vendor-api',
      script: 'app.js',
      instances: 1,           // 1 seule instance obligatoire (Puppeteer non compatible cluster)
      exec_mode: 'fork',      // mode fork, pas cluster (évite les conflits WhatsApp/Chrome)
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PROCESS_ROLE: 'api'   // Permet à app.js de savoir qu'il est le serveur HTTP
      },
      error_file: 'logs/api-err.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      // ─── PROCESSUS 2 : Worker Tâches Planifiées (Cron) ─────────────────
      name: 'saas-worker',
      script: 'src/worker.js',
      instances: 1,           // 1 seule instance — les crons ne doivent JAMAIS tourner en doublon
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PROCESS_ROLE: 'worker'
      },
      error_file: 'logs/worker-err.log',
      out_file: 'logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};