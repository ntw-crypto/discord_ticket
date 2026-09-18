const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const sheetsConfigPath = path.join(dataDir, 'sheets_config.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getSheetsConfig() {
  try {
    if (fs.existsSync(sheetsConfigPath)) {
      const data = JSON.parse(fs.readFileSync(sheetsConfigPath, 'utf-8'));
      if (data && data.webAppUrl) return data;
    }
  } catch (e) {}

  if (process.env.GOOGLE_SHEETS_URL) {
    return { webAppUrl: process.env.GOOGLE_SHEETS_URL };
  }
  return null;
}

function saveSheetsConfig(config) {
  try {
    fs.writeFileSync(sheetsConfigPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving sheets_config.json:', e);
  }
}

/**
 * ทดสอบการเชื่อมต่อกับ Google Apps Script Web App
 * @param {string} url 
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
async function testSheetsConnection(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      redirect: 'follow'
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ไม่สามารถเชื่อมต่อกับ Web App ได้` };
    }

    const data = await res.json();
    if (data && data.success) {
      return { success: true, data };
    } else {
      return { success: false, error: data?.error || 'ข้อมูลตอบกลับจาก Google Sheet ไม่ถูกต้อง' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * ดึงข้อมูลยอดคงเหลือและสถานะคีย์จาก Google Sheets
 * @returns {Promise<object|null>}
 */
async function fetchSheetsStock() {
  const config = getSheetsConfig();
  if (!config || !config.webAppUrl) return null;

  try {
    const res = await fetch(config.webAppUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success) {
      return data;
    }
  } catch (err) {
    console.error('[GoogleSheets] Fetch stock error:', err.message);
  }
  return null;
}

/**
 * ส่งคำขอดึงคีย์และตัดยอดใน Google Sheets
 * @param {string} userId 
 * @param {string} username 
 * @returns {Promise<object>}
 */
async function claimKeyFromSheets(userId, username) {
  const config = getSheetsConfig();
  if (!config || !config.webAppUrl) {
    return { success: false, noSheetsConfig: true };
  }

  try {
    const res = await fetch(config.webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Google Apps Script handles text/plain without CORS preflight issues
      },
      body: JSON.stringify({
        action: 'claim',
        userId: String(userId),
        username: String(username)
      }),
      redirect: 'follow'
    });

    if (!res.ok) {
      throw new Error(`Google Web App returned status ${res.status}`);
    }

    const result = await res.json();
    return result;
  } catch (err) {
    console.error('[GoogleSheets] Claim key error:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  getSheetsConfig,
  saveSheetsConfig,
  testSheetsConnection,
  fetchSheetsStock,
  claimKeyFromSheets
};
