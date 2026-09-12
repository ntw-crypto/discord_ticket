const express = require('express');

function startWebServer(client) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.get('/', (req, res) => {
    const isReady = client?.isReady?.() || false;
    res.json({
      status: 'online',
      message: 'Discord Ticket Bot Server is running!',
      bot_status: isReady ? 'connected' : 'connecting',
      bot_tag: isReady ? client.user.tag : null,
      uptime: process.uptime()
    });
  });

  // Health check endpoint สำหรับบริการ Web Hosting / UptimeRobot
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  app.listen(PORT, () => {
    console.log(`[Web Server] HTTP server is running on port ${PORT}`);
  });
}

module.exports = { startWebServer };
