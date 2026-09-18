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
    const testUrl = new URL(url);
    testUrl.searchParams.set('action', 'check');

    const res = await fetch(testUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      redirect: 'follow'
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ไม่สามารถเชื่อมต่อกับ Web App ได้` };
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { success: false, error: `Google Sheets ส่งข้อมูลกลับมาไม่ถูกต้อง (ไม่ใช่ JSON)` };
    }

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
    const url = new URL(config.webAppUrl);
    url.searchParams.set('action', 'check');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text);
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
    const cleanId = String(userId).replace(/['\s\t]/g, '').trim();
    const cleanUser = String(username || '').trim();

    // เรียก Web App ผ่าน GET พร้อมส่ง query parameters
    // รองรับ Google Apps Script Redirect 302 ได้อย่างสมบูรณ์แบบ ข้อมูลไม่สูญหาย
    const url = new URL(config.webAppUrl);
    url.searchParams.set('action', 'claim');
    url.searchParams.set('userId', cleanId);
    url.searchParams.set('username', cleanUser);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      redirect: 'follow'
    });

    if (!res.ok) {
      throw new Error(`Google Web App returned HTTP status ${res.status}`);
    }

    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response from Google Sheets: ${text.slice(0, 150)}`);
    }

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
