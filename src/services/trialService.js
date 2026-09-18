const fs = require('fs');
const path = require('path');
const { getSheetsConfig, claimKeyFromSheets, fetchSheetsStock } = require('./sheetsService');

const dataDir = path.join(__dirname, '../../data');
const trialsFilePath = path.join(dataDir, 'trials.json');
const keysPoolFilePath = path.join(dataDir, 'trial_keys.json');

const trialConfigPath = path.join(dataDir, 'trial_config.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getTrialConfig() {
  try {
    if (fs.existsSync(trialConfigPath)) {
      return JSON.parse(fs.readFileSync(trialConfigPath, 'utf-8'));
    }
  } catch (e) {}
  if (process.env.TRIAL_REQUIRED_ROLE_ID) {
    return { requiredRoleId: process.env.TRIAL_REQUIRED_ROLE_ID };
  }
  return {};
}

function saveTrialConfig(config) {
  try {
    fs.writeFileSync(trialConfigPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving trial_config.json:', e);
  }
}

// ตรวจสอบและสร้างไฟล์ trials.json (บันทึกคนเคยกดรับ)
if (!fs.existsSync(trialsFilePath)) {
  fs.writeFileSync(trialsFilePath, JSON.stringify({}, null, 2), 'utf-8');
}

// ตรวจสอบและสร้างไฟล์ trial_keys.json (คลัง Key สำหรับแจก)
if (!fs.existsSync(keysPoolFilePath)) {
  fs.writeFileSync(keysPoolFilePath, JSON.stringify([], null, 2), 'utf-8');
}

function getClaimedUsers() {
  try {
    return JSON.parse(fs.readFileSync(trialsFilePath, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveClaimedUsers(data) {
  fs.writeFileSync(trialsFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getTrialKeysPool() {
  try {
    return JSON.parse(fs.readFileSync(keysPoolFilePath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveTrialKeysPool(keys) {
  fs.writeFileSync(keysPoolFilePath, JSON.stringify(keys, null, 2), 'utf-8');
}

// เพิ่ม Key เข้าคลังในระบบ
function addKeysToPool(newKeys) {
  const currentPool = getTrialKeysPool();
  const updated = [...currentPool, ...newKeys];
  saveTrialKeysPool(updated);
  return updated.length;
}

// ล้าง Key ทั้งหมดในคลังระบบ
function clearAllTrialKeys() {
  const currentPool = getTrialKeysPool();
  const deletedCount = currentPool.length;
  saveTrialKeysPool([]);
  return deletedCount;
}

// ลบ Key เฉพาะคีย์ที่ระบุ
function removeSpecificKey(keyToRemove) {
  const currentPool = getTrialKeysPool();
  const index = currentPool.indexOf(keyToRemove);
  if (index !== -1) {
    currentPool.splice(index, 1);
    saveTrialKeysPool(currentPool);
    return true;
  }
  return false;
}

/**
 * ขอดึง Key แจกให้ผู้ใช้ (รองรับทั้ง Google Sheets แบบ Real-time และ Local Pool)
 * @param {string} userId 
 * @param {string} username 
 * @returns {Promise<object>}
 */
async function claimTrialKey(userId, username) {
  const sheetsConfig = getSheetsConfig();

  // 1. ถ้ามีการตั้งค่า Google Sheets ให้ดึงและตัดยอดใน Google Sheets เป็นหลัก
  if (sheetsConfig && sheetsConfig.webAppUrl) {
    const sheetsResult = await claimKeyFromSheets(userId, username);

    if (sheetsResult.alreadyClaimed) {
      return {
        success: false,
        alreadyClaimed: true,
        claimedAt: sheetsResult.claimedAt,
        key: sheetsResult.key
      };
    }

    if (sheetsResult.outOfKeys) {
      return {
        success: false,
        outOfKeys: true
      };
    }

    if (sheetsResult.success && sheetsResult.key) {
      // บันทึกสำเนาลง trials.json ภายในระบบด้วย
      const claimed = getClaimedUsers();
      claimed[userId] = {
        username: username,
        key: sheetsResult.key,
        claimedAt: new Date().toISOString()
      };
      saveClaimedUsers(claimed);

      return {
        success: true,
        key: sheetsResult.key,
        remainingInPool: sheetsResult.remaining,
        fromGoogleSheets: true
      };
    }

    // ถ้า Google Sheets ส่ง error หรือผลลัพธ์ไม่ถูกต้อง ให้แจ้ง error ตรงๆ ห้าม fall through ไปแจ้งว่าคีย์หมด
    if (sheetsResult.error) {
      console.warn('[GoogleSheets] เกิดข้อผิดพลาดในการดึงคีย์จากชีต:', sheetsResult.error);
      return {
        success: false,
        error: sheetsResult.error
      };
    }

    return {
      success: false,
      error: sheetsResult.message || 'Google Sheets ส่งผลลัพธ์ไม่ถูกต้อง หรือยังไม่ได้อัปเดตเวอร์ชันใน Apps Script'
    };
  }

  // 2. ถ้าไม่ได้ตั้งค่า Google Sheets ให้ตรวจสอบจากคลังภายในเครื่อง
  const claimed = getClaimedUsers();
  if (claimed[userId]) {
    return {
      success: false,
      alreadyClaimed: true,
      claimedAt: claimed[userId].claimedAt,
      key: claimed[userId].key
    };
  }

  const pool = getTrialKeysPool();
  if (pool.length === 0) {
    // หากไม่ได้ตั้งค่า Google Sheets และคลังในเครื่องว่างเปล่า ให้แจ้งให้ชัดเจน
    return {
      success: false,
      noSheetsConfig: true,
      outOfKeys: true
    };
  }

  const assignedKey = pool.shift();
  saveTrialKeysPool(pool);

  claimed[userId] = {
    username: username,
    key: assignedKey,
    claimedAt: new Date().toISOString()
  };
  saveClaimedUsers(claimed);

  return {
    success: true,
    key: assignedKey,
    remainingInPool: pool.length
  };
}

module.exports = {
  claimTrialKey,
  addKeysToPool,
  clearAllTrialKeys,
  removeSpecificKey,
  getTrialKeysPool,
  getClaimedUsers,
  getTrialConfig,
  saveTrialConfig
};
