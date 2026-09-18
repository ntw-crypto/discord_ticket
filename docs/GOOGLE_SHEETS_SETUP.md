# 📊 คู่มือการเชื่อมต่อ Google Sheets กับบอท Discord สำหรับคลัง License Key

คุณสามารถนำ Google Sheets มาใช้เป็นคลังเก็บ License Key ทดลองใช้ฟรีได้ โดยสามารถเปิดดู, เพิ่ม, ลบ หรือแก้ไขคีย์ได้ตลอดเวลาผ่านมือถือหรือคอมพิวเตอร์ และบอทจะตัดยอดบันทึกชื่อคนกดรับลงในตารางให้โดยอัตโนมัติแบบ Real-time!

---

## 🚀 ขั้นตอนการติดตั้ง (ทำเพียงครั้งเดียวใน 1 นาที)

### ขั้นตอนที่ 1: สร้าง Google Sheet ใหม่
1. เข้าไปที่ [Google Sheets](https://sheets.new) เพื่อสร้างตารางใหม่
2. ตั้งชื่อไฟล์ตามต้องการ เช่น `CookieRun License Keys`
3. ในแถวที่ 1 (หัวตาราง) ให้พิมพ์หัวข้อดังนี้:
   - **คอลัมน์ A**: `Key`
   - **คอลัมน์ B**: `Status`
   - **คอลัมน์ C**: `Claimed By`
   - **คอลัมน์ D**: `User ID`
   - **คอลัมน์ E**: `Claimed Date`
4. นำ License Key ที่ต้องการแจกมาวางใน **คอลัมน์ A** (เริ่มตั้งแต่แถวที่ 2 ลงไป)

---

### ขั้นตอนที่ 2: วางโค้ด Google Apps Script
1. ที่เมนูด้านบนของ Google Sheet ให้คลิกที่ **ส่วนขยาย (Extensions)** ➔ เลือก **Apps Script**
2. ลบโค้ดเดิมทั้งหมดในหน้าต่าง แล้วคัดลอกโค้ดด้านล่างนี้ไปวาง:

```javascript
/**
 * Google Apps Script สำหรับเชื่อมต่อระบบแจก License Key กับ Discord Bot
 */
const SHEET_NAME = 'Sheet1'; // หากเปลี่ยนชื่อแผ่นงาน ให้แก้ชื่อตรงนี้

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

// ตรวจสอบสถานะและยอดคีย์คงเหลือ
function handleCheck() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getDisplayValues();
  
  let total = 0;
  let available = 0;
  let claimed = 0;
  const availableKeys = [];

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0] || '').trim();
    const status = String(data[i][1] || '').trim().toLowerCase();
    
    if (key) {
      total++;
      if (status === 'claimed' || status === 'ใช้แล้ว' || status === 'รับแล้ว') {
        claimed++;
      } else {
        available++;
        if (availableKeys.length < 20) availableKeys.push(key);
      }
    }
  }

  return createJsonResponse({
    success: true,
    total: total,
    available: available,
    claimed: claimed,
    availableKeys: availableKeys
  });
}

// ประมวลผลการขอรับสิทธิ์ Key และตัดยอดในตาราง
function handleClaim(rawUserId, rawUsername) {
  const lock = LockService.getScriptLock();
  // ล็อกคิว 10 วินาที ป้องกันคนกดพร้อมกันแล้วได้คีย์ซ้ำ
  lock.waitLock(10000);

  try {
    const sheet = getSheet();
    // ใช้ getDisplayValues เพื่อให้อ่านตัวเลข User ID เป็นข้อความแท้ 100% ไม่เพี้ยนเป็นตัวเลขชี้กำลัง (Scientific Notation)
    const displayData = sheet.getDataRange().getDisplayValues();
    const cleanUserId = String(rawUserId || '').replace(/['\s\t]/g, '').trim();
    const username = String(rawUsername || '').trim();

    if (!cleanUserId) {
      return createJsonResponse({ success: false, error: 'User ID is required' });
    }

    // 1. ตรวจสอบ User ID ของคนกดรับกับ Google Sheets ว่าเคยรับไปแล้วหรือไม่
    for (let i = 1; i < displayData.length; i++) {
      const rowUserId = String(displayData[i][3] || '').replace(/['\s\t]/g, '').trim();
      const rowUsername = String(displayData[i][2] || '').trim();
      const rowKey = String(displayData[i][0] || '').trim();

      // ตรวจสอบว่าตรงกับ User ID ในคอลัมน์ D หรือคอลัมน์ C
      if ((rowUserId && rowUserId === cleanUserId) || (rowUsername && rowUsername === cleanUserId)) {
        return createJsonResponse({
          success: false,
          alreadyClaimed: true,
          key: rowKey,
          claimedAt: displayData[i][4] || 'ก่อนหน้านี้'
        });
      }
    }

    // 2. ค้นหา Key แรกที่ยังไม่ได้ถูกรับ
    let targetRow = -1;
    let assignedKey = '';

    for (let i = 1; i < displayData.length; i++) {
      const key = String(displayData[i][0] || '').trim();
      const status = String(displayData[i][1] || '').trim().toLowerCase();

      if (key && status !== 'claimed' && status !== 'ใช้แล้ว' && status !== 'รับแล้ว') {
        targetRow = i + 1; // แปลง index เป็น row number (1-based)
        assignedKey = key;
        break;
      }
    }

    // หากไม่พบคีย์ว่าง (คีย์หมด)
    if (targetRow === -1 || !assignedKey) {
      return createJsonResponse({
        success: false,
        outOfKeys: true,
        message: 'License keys in stock are exhausted'
      });
    }

    // 3. บันทึกข้อมูลลงตารางแถวนั้นทันที
    const now = new Date();
    const timeString = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // บันทึกข้อมูลลงตารางแถวนั้นทันทีแบบ Batch (รวดเร็วและประหยัดเวลา)
    sheet.getRange(targetRow, 4).setNumberFormat('@'); // Column D: ตั้งค่าเป็น Plain Text ป้องกันตัวเลข User ID เพี้ยน
    sheet.getRange(targetRow, 2, 1, 4).setValues([['Claimed', username, cleanUserId, timeString]]); // บันทึกพร้อมกัน 4 คอลัมน์ (B ถึง E) ใน 1 คำสั่ง

    // คำนวณยอดคงเหลือ
    let remaining = 0;
    for (let i = 1; i < displayData.length; i++) {
      if (i + 1 !== targetRow) {
        const k = String(displayData[i][0] || '').trim();
        const s = String(displayData[i][1] || '').trim().toLowerCase();
        if (k && s !== 'claimed' && s !== 'ใช้แล้ว' && s !== 'รับแล้ว') {
          remaining++;
        }
      }
    }

    return createJsonResponse({
      success: true,
      key: assignedKey,
      remaining: remaining
    });

  } catch (err) {
    return createJsonResponse({ success: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// รองรับคำขอผ่าน GET (ทำงานร่วมกับการ Redirect ของ Google ได้ดีที่สุด)
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || 'check';
  if (action === 'claim') {
    return handleClaim(params.userId, params.username);
  }
  return handleCheck();
}

// รองรับคำขอผ่าน POST
function doPost(e) {
  let params = {};
  try {
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
  } catch (err) {}

  const action = params.action || (e && e.parameter && e.parameter.action) || 'claim';
  const userId = params.userId || (e && e.parameter && e.parameter.userId);
  const username = params.username || (e && e.parameter && e.parameter.username);

  if (action === 'check') {
    return handleCheck();
  }
  return handleClaim(userId, username);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. กดปุ่ม **💾 บันทึกโครงการ (รูปแผ่นดิสก์)**

---

### ขั้นตอนที่ 3: ทำให้ใช้งานได้ (Deploy as Web App)
1. ที่มุมขวาบน ให้คลิกปุ่มสีน้ำเงิน **ทำให้ใช้งานได้ (Deploy)** ➔ เลือก **การจัดการทำให้ใช้งานได้ใหม่ (New deployment)**
2. คลิกรูปฟันเฟือง ⚙️ ข้างคำว่า "เลือกประเภท" ➔ เลือก **เว็บแอป (Web app)**
3. ตั้งค่าการทำให้ใช้งานได้:
   - **คำอธิบาย (Description)**: `Discord Key Bot API`
   - **เรียกใช้ในฐานะ (Execute as)**: `ฉัน (อีเมลของคุณ)`
   - **ผู้มีสิทธิ์เข้าถึง (Who has access)**: `ทุกคน (Anyone)` *(สำคัญมาก! เพื่อให้บอทสามารถเชื่อมต่อได้)*
4. คลิกปุ่ม **ทำให้ใช้งานได้ (Deploy)**
5. หากมีหน้าต่างขออนุญาตสิทธิ์ ให้คลิก **ให้สิทธิ์การเข้าถึง (Authorize Access)** ➔ เลือกบัญชี Google ➔ คลิก **ขั้นสูง (Advanced)** ➔ คลิก **ไปที่โครงการ (ไม่ปลอดภัย)** ➔ คลิก **อนุญาต (Allow)**
6. คัดลอก **URL เว็บแอป (Web app URL)** ที่ขึ้นต้นด้วย `https://script.google.com/macros/s/.../exec`

---

### ขั้นตอนที่ 4: เชื่อมต่อใน Discord
เปิด Discord แล้วพิมพ์คำสั่ง:
```
/setup-sheets url:https://script.google.com/macros/s/xxxxxx/exec
```
บอทจะทำการตรวจสอบการเชื่อมต่อทันที และรายงานจำนวน Key ที่พร้อมแจกใน Google Sheet ให้ทราบ พร้อมเริ่มใช้งานได้ทันที!

---

## 🔄 ระบบอัปเดตข้อมูลแดชบอร์ดอัตโนมัติ (Auto-Sync)

เมื่อคุณเปิด Google Sheets บนมือถือหรือคอมพิวเตอร์เพื่อ **เพิ่มคีย์, ลบคีย์ หรือเปลี่ยนสถานะคีย์เป็น Claimed / ใช้แล้ว**:

1. **Auto-Sync อัตโนมัติทุก 30 วินาที**:
   - บอทจะคอยตรวจสอบความเปลี่ยนแปลงใน Google Sheets อยู่ตลอดเวลาในเบื้องหลัง
   - เมื่อตรวจพบว่าคุณแก้ไขคีย์หรือเปลี่ยนสถานะ การ์ดแดชบอร์ดในห้องสต็อก (`/setup-stock`) จะทำการแก้ไขข้อความและอัปเดตตัวเลขให้เองโดยอัตโนมัติภายใน 30 วินาทีโดยที่คุณไม่ต้องกดอะไรเลย!
2. **กดปุ่ม "🔄 รีเฟรชข้อมูล" เพื่ออัปเดตทันที**:
   - หากต้องการดูผลลัพธ์ทันทีโดยไม่ต้องรอ 30 วินาที สามารถกดปุ่ม **"🔄 รีเฟรชข้อมูล"** ใต้การ์ดสต็อกใน Discord เพื่อสั่งดึงข้อมูลล่าสุดจาก Google Sheet ได้ทันทีใน 1 วินาทีครับ

