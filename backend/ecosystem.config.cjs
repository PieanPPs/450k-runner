module.exports = {
  apps: [
    {
      name: '450k-backend',
      script: 'src/server.js',
      cwd: '/home/deploy/450k-runner/backend',
      node_args: '--experimental-vm-modules',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/home/deploy/logs/450k-error.log',
      out_file: '/home/deploy/logs/450k-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
