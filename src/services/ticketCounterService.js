const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const counterFilePath = path.join(dataDir, 'ticket_counter.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getStoredTicketNumber() {
  try {
    if (fs.existsSync(counterFilePath)) {
      const data = JSON.parse(fs.readFileSync(counterFilePath, 'utf-8'));
      return typeof data.lastNumber === 'number' ? data.lastNumber : 0;
    }
  } catch (e) {}
  return 0;
}

function saveTicketNumber(num) {
  try {
    fs.writeFileSync(counterFilePath, JSON.stringify({ lastNumber: num }, null, 2), 'utf-8');
  } catch (e) {}
}

/**
 * คำนวณและดึงชื่อห้อง Ticket ถัดไปในรูปแบบรันตัวเลข 4 หลัก (เช่น 🎫・0001)
 * พร้อมระบบตรวจสอบห้องเดิมใน Discord เผื่อกรณี Render restart ข้อมูล local ไม่หาย
 */
async function getNextTicketChannelName(guild, padding = 4) {
  let currentNum = getStoredTicketNumber();

  // สแกนห้องในกิลด์เผื่อกรณี container ถูกรีเซ็ต
  try {
    let highestInGuild = 0;
    guild.channels.cache.forEach((ch) => {
      // ค้นหาห้องที่เป็นรูปแบบตัวเลข เช่น 🎫・0001 หรือ ticket-0001
      const match = ch.name && ch.name.match(/(?:ticket|🎫)[^\d]*(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > highestInGuild) {
          highestInGuild = n;
        }
      }
    });

    if (highestInGuild > currentNum) {
      currentNum = highestInGuild;
    }
  } catch (e) {}

  const nextNum = currentNum + 1;
  saveTicketNumber(nextNum);

  const paddedStr = String(nextNum).padStart(padding, '0');
  return `🎫・${paddedStr}`;
}

module.exports = {
  getNextTicketChannelName,
  getStoredTicketNumber,
  saveTicketNumber
};
