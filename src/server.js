const express = require('express');

function startWebServer(client) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Helper ตรวจสอบความสมบูรณ์ของการเชื่อมต่อ Discord Gateway
  const getBotHealth = () => {
    const isReady = Boolean(client && client.isReady && client.isReady());
    const wsStatus = client?.ws?.status ?? -1;
    const ping = client?.ws?.ping ?? -1;

    // wsStatus: 0 = READY
    const isHealthy = isReady && wsStatus === 0 && ping >= 0;

    const statusMap = {
      0: 'READY',
      1: 'CONNECTING',
      2: 'RECONNECTING',
      3: 'IDLE',
      4: 'NEARLY',
      5: 'DISCONNECTED',
      6: 'WAITING_FOR_GUILDS',
      7: 'IDENTIFYING',
      8: 'RESUMING'
    };

    return {
      isHealthy,
      isReady,
      wsStatus,
      wsStatusText: statusMap[wsStatus] || 'UNKNOWN',
      ping,
      uptime: process.uptime(),
      botTag: isReady ? client.user?.tag : null
    };
  };

  // Route / แสดงภาพรวมสถานะบอท
  app.get('/', (req, res) => {
    const health = getBotHealth();

    const responseData = {
      status: health.isHealthy ? 'online' : (process.uptime() < 45 ? 'starting' : 'degraded'),
      message: health.isHealthy 
        ? 'Discord Ticket Bot Server is running and healthy!' 
        : (process.uptime() < 45 
            ? 'Bot is initializing and connecting to Discord...' 
            : 'Bot gateway is degraded or reconnecting.'),
      bot_status: health.isHealthy ? 'connected' : 'connecting/reconnecting',
      bot_tag: health.botTag,
      websocket: {
        status: health.wsStatus,
        status_text: health.wsStatusText,
        ping_ms: health.ping
      },
      uptime_seconds: Math.floor(health.uptime)
    };

    // ส่ง 200 ถ้าสุขภาพดี หรือกำลังสตาร์ท (<45 วิ) แต่ส่ง 503 ถ้าบอทค้าง/หลุด
    const statusCode = (health.isHealthy || process.uptime() < 45) ? 200 : 503;
    res.status(statusCode).json(responseData);
  });

  // Health check endpoint สำหรับบริการ Web Hosting / UptimeRobot
  app.get('/health', (req, res) => {
    const health = getBotHealth();

    // ในช่วง 45 วินาทีแรกที่บอทเพิ่งสตาร์ท อนุโลมให้ตอบ 200 เพื่อไม่ให้ Render deployment fail
    if (process.uptime() < 45 && !health.isHealthy) {
      return res.status(200).json({
        status: 'STARTING',
        ws_status: health.wsStatusText,
        uptime: Math.floor(health.uptime)
      });
    }

    if (health.isHealthy) {
      return res.status(200).json({
        status: 'OK',
        ws_status: health.wsStatusText,
        ping: health.ping,
        uptime: Math.floor(health.uptime)
      });
    } else {
      // ส่ง 503 ทันทีเมื่อ WebSocket หลุด/ค้าง เพื่อให้ UptimeRobot หรือโฮสต์ทราบว่าบอทมีปัญหา
      return res.status(503).json({
        status: 'UNHEALTHY',
        ws_status: health.wsStatusText,
        ping: health.ping,
        uptime: Math.floor(health.uptime),
        error: 'Discord Gateway WebSocket is not READY'
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`[Web Server] HTTP server is running on port ${PORT}`);
  });
}

module.exports = { startWebServer };
