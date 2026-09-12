const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const trialsFilePath = path.join(dataDir, 'trials.json');
const keysPoolFilePath = path.join(dataDir, 'trial_keys.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
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

// สุ่มสร้าง Key สำรอง (เช่น CKRX-FREE-XXXX-XXXX)
function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const seg2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CKRX-TRIAL-${seg1}-${seg2}`;
}

// เพิ่ม Key เข้าคลัง (สำหรับแอดมิน)
function addKeysToPool(newKeys) {
  const currentPool = getTrialKeysPool();
  const updated = [...currentPool, ...newKeys];
  saveTrialKeysPool(updated);
  return updated.length;
}

// ขอดึง Key แจกให้ผู้ใช้
function claimTrialKey(userId, username) {
  const claimed = getClaimedUsers();
  
  // ตรวจสอบว่าเคยรับสิทธิ์ไปแล้วหรือไม่
  if (claimed[userId]) {
    return {
      success: false,
      alreadyClaimed: true,
      claimedAt: claimed[userId].claimedAt,
      key: claimed[userId].key
    };
  }

  const pool = getTrialKeysPool();
  let assignedKey = '';

  if (pool.length > 0) {
    // ถ้ามี Key ในคลังที่แอดมินใส่ไว้ ให้หยิบมา 1 คีย์
    assignedKey = pool.shift();
    saveTrialKeysPool(pool);
  } else {
    // ถ้าไม่มี Key ในคลัง ให้สุ่มสร้างคีย์รูปแบบ CKRX-TRIAL-XXXX-XXXX อัตโนมัติ
    assignedKey = generateRandomKey();
  }

  // บันทึกประวัติว่าผู้ใช้นี้รับไปแล้ว
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
  getTrialKeysPool,
  getClaimedUsers
};
