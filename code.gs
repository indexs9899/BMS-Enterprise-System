
// =====================================================================================
// 1. SYSTEM CONFIGURATION & CONSTANTS
// =====================================================================================

const CONFIG = {
  SPREADSHEET_ID: '1DYjovxQVv7CZp9E31KksK9bW-3CSZOXAavkJ4BAW0eg', // ID ของ Google Sheet
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1459238521964466207/Gv6wn78j4npLWS3UOkUEEe_DZ9kcYo_gFZ9ebf_P7i79dhjkJYlYVKsV_i9XEn8LKoC5',
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwIbSPNKcgA-ObmpVsqRLTM7huGNCUvIseb4QOaoPhdyOKAwjEo_NXyryycLIwqjyfS9A/exec',
  REPORT_EMAIL_TO: 'kunlarot.j@thaibev.com'
};

// =====================================================================================
// 2. API ROUTER (doPost / doGet)
// =====================================================================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('BMS - BMS Enterprise System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const p = params.data || {};
  let result = {};

  try {
    // --- Group 1: Authentication & System Status ---
    if (action === 'loginUser')             result = loginUser(p.u, p.p);
    else if (action === 'getSystemStatus')  result = getSystemStatus();
    else if (action === 'setSystemStatus')  result = setSystemStatus(p.isOpen);
    else if (action === 'getAllMasterData') result = getAllMasterData();

    // --- Group 2: Dashboard & Reports ---
    else if (action === 'getDashboardStats') result = getDashboardStats(p.uid, p.role);
    else if (action === 'getBudgetReport')   result = getBudgetReport(p.m, p.y, p.role, p.uid);
    else if (action === 'getLogs')           result = getLogs();

    else if (action === 'uploadFuelReport')       result = uploadFuelReport(p);
    else if (action === 'getFuelComparison')      result = getFuelComparison(p.month, p.year);
    else if (action === 'remindMissingFuel')      result = remindMissingFuel(p.month, p.year);
    else if (action === 'mergeMonthlySlips')      result = mergeMonthlySlips(p.month, p.year);

    // --- Group 3: Booking Management ---
    else if (action === 'getBookings')            result = getBookings(p.uid, p.role, p.m, p.y);
    else if (action === 'createBooking')          result = createBooking(p);
    else if (action === 'updateBookingDetails')   result = updateBookingDetails(p.id, p.status, p.price, p.notify, p.actorId, p.hotel, p.reason, p.checkIn, p.checkOut);
    else if (action === 'deleteBooking')          result = deleteBooking(p.id, p.actorId);
    else if (action === 'batchUpdateBookings')    result = batchUpdateBookings(p.ids, p.status, p.actorId);

    else if (action === 'getWorkPlans')           result = getWorkPlans(p.uid);
    else if (action === 'saveWorkPlan')           result = saveWorkPlan(p);
    else if (action === 'updateWorkPlanDate')     result = updateWorkPlanDate(p.id, p.date);
    else if (action === 'deleteWorkPlan')         result = deleteWorkPlan(p.id);

    // --- Group 4: User Management (Admin) ---
    else if (action === 'addUser')                result = addUser(p);
    else if (action === 'updateUser')             result = updateUser(p);
    else if (action === 'deleteUser')             result = deleteUser(p.id, p.actorId);
    else if (action === 'updateUserCreditLimit')  result = updateUserCreditLimit(p.uid, p.lim, p.fLim, p.actorId, p.m, p.y);

    // --- Group 5: Master Data (Hotels & Agents) ---
    else if (action === 'addHotel')     result = addHotel(p);
    else if (action === 'updateHotel')  result = updateHotel(p);
    else if (action === 'deleteHotel')  result = deleteHotel(p.id, p.actorId);
    else if (action === 'addAgent')     result = addAgent(p);
    else if (action === 'deleteAgent')  result = deleteAgent(p.id, p.actorId);

    // --- Group 6: Files & PDFs ---
    else if (action === 'uploadReceipt')            result = uploadReceipt(p);
    else if (action === 'uploadTransferSlip')       result = uploadTransferSlip(p);
    else if (action === 'uploadHotelQRCode')        result = uploadHotelQRCode(p);
    else if (action === 'generateBookingPDF')       result = generateBookingPDF(p.id);
    else if (action === 'generateMergedPDF')        result = generateMergedPDF(p.id);
    else if (action === 'generateMonthlyReportPDF') result = generateMonthlyReportPDF(p.m, p.y, p.type, p.status, p.uid, p.role, p.title);

    else result = { error: "Action not found: " + action };

  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================================
// 3. DATABASE CONNECTION & HELPERS
// =====================================================================================

function getDb() {
  let ss;
  try {
    ss = CONFIG.SPREADSHEET_ID && !CONFIG.SPREADSHEET_ID.includes('YOUR_ID') 
      ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) 
      : SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    throw new Error("Database Connection Error: " + e.message);
  }

  const tables = {
    'Users': ['UserID', 'Username', 'Password', 'Role', 'FullName', 'Level', 'AccommodationRights', 'Phone', 'CreditLimit', 'CreatedDate', 'AssignedAgents', 'FlowLimit'],
    'Bookings': ['BookingID', 'UserID', 'HotelName', 'CheckIn', 'CheckOut', 'Status', 'ReceiptURL', 'LastUpdated', 'AgentName', 'TransferSlipURL', 'Price', 'PaymentType'],
    'Hotels': ['ID', 'Name', 'RegisteredName', 'Phone', 'Bank', 'AccountNumber', 'AccountName', 'DocType', 'CreatedDate', 'QRCodeURL', 'Province'],
    'Agents': ['ID', 'Name', 'Province', 'CreatedDate'],
    'Logs': ['LogID', 'ActorID', 'ActorName', 'Action', 'Details', 'Timestamp'],
    'MonthlyLimits': ['ID', 'UserID', 'Month', 'Year', 'CashLimit', 'FlowLimit', 'UpdatedAt'],
    'WorkPlans': ['PlanID', 'UserID', 'AgentName', 'Date', 'CreatedAt'],
    'FuelReports': ['ReportID', 'UserID', 'Month', 'Year', 'ExcelURL', 'PdfURL', 'TotalCost', 'Timestamp']
  };

  let db = {};
  for (let key in tables) {
    let sheet = ss.getSheetByName(key);
    if (!sheet) {
      sheet = ss.insertSheet(key);
      sheet.appendRow(tables[key]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, tables[key].length).setFontWeight("bold").setBackground("#f3f4f6");
    }
    db[key.charAt(0).toLowerCase() + key.slice(1) + 'Sheet'] = sheet;
  }
  return db;
}

// --- Helpers ---
function _isSystemOpen() {
  try {
    const val = PropertiesService.getScriptProperties().getProperty('SYSTEM_OPEN');
    return val !== 'false';
  } catch (e) { return true; }
}
function getSystemStatus() { return { success: true, isOpen: _isSystemOpen() }; }
function setSystemStatus(isOpen) { PropertiesService.getScriptProperties().setProperty('SYSTEM_OPEN', String(isOpen)); return { success: true, isOpen: isOpen }; }
function formatDate(d) { if (!d) return ''; try { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "yyyy-MM-dd") } catch (e) { return '' } }
function parseMoney(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  let clean = String(val).replace(/,/g, '').replace(/\s/g, '');
  let num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// --- Log System ---
function logAction(userId, action, details) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const db = getDb();
    const sheet = db.logsSheet;
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "User / ID", "Action", "Details"]);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#EFEFEF");
    }
    sheet.appendRow([new Date(), userId, action, details]);
    SpreadsheetApp.flush();
  } catch (e) {
    console.error("Log Error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}
// =========================================
// 🌟 ระบบประวัติการใช้งาน (Smart Audit Logs)
// =========================================

// 1. ฟังก์ชันสร้างชีต Logs อัตโนมัติ (ถ้ายังไม่มี)
function ensureLogsSheetExists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Logs");
  
  if (!sheet) {
    // ถ้าไม่มีชีต ให้สร้างใหม่
    sheet = ss.insertSheet("Logs");
    
    // สร้างหัวตาราง (Headers)
    sheet.appendRow(["Timestamp", "Actor", "Action", "Details"]);
    
    // ตกแต่งหัวตารางให้สวยงามและอ่านง่าย
    const headerRange = sheet.getRange("A1:D1");
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4F46E5"); // สีน้ำเงิน Indigo
    headerRange.setFontColor("white");
    sheet.setFrozenRows(1); // แช่แข็งแถวแรก
    
    // ปรับความกว้างคอลัมน์
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 400);
  }
  return sheet;
}

// 2. ฟังก์ชันดึงข้อมูลไปแสดงหน้าเว็บ (ดึง 100 รายการล่าสุด)
function getLogs() {
  try {
    const sheet = ensureLogsSheetExists(); // ระบบจะสร้างชีตให้ทันทีถ้าไม่มี
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) return []; // ถ้ามีแค่หัวตาราง ส่งค่าว่างกลับไป

    // ดึงเฉพาะ 100 บรรทัดล่าสุด เพื่อให้หน้าเว็บโหลดไว
    const maxRows = 100;
    const startRow = Math.max(2, lastRow - maxRows + 1);
    const numRows = lastRow - startRow + 1;
    
    const data = sheet.getRange(startRow, 1, numRows, 4).getValues();
    let logs = [];
    
    // วนลูปจากล่างขึ้นบน (Reverse) เพื่อให้รายการล่าสุดอยู่บนสุดเสมอ
    for (let i = data.length - 1; i >= 0; i--) {
      let row = data[i];
      if (row[0] !== "") { // ต้องมีข้อมูล
        let timeStr = "-";
        if (row[0] instanceof Date) {
          timeStr = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
        } else {
          timeStr = String(row[0]);
        }

        logs.push({
          timestamp: timeStr,
          actor: String(row[1] || "System"),
          action: String(row[2] || "-"),
          details: String(row[3] || "-")
        });
      }
    }
    return logs;
  } catch (e) {
    console.error("Get Logs Error: " + e.message);
    return [];
  }
}

// 3. ฟังก์ชันสำหรับบันทึกข้อมูล (เอาไว้ให้ระบบเรียกใช้ตอน User ทำรายการ)
function addLog(actor, action, details) {
  try {
    const sheet = ensureLogsSheetExists();
    sheet.appendRow([new Date(), actor, action, details]);
  } catch (e) {
    console.error("Add Log Error: " + e.message);
  }
}

// 🎯 ฟังก์ชันสำหรับทดสอบสร้างข้อมูลจำลอง (ให้คุณกดปุ่ม Run เพื่อทดสอบ)
function testCreateLog() {
  addLog("Admin (ทดสอบ)", "ตั้งค่าระบบ", "สร้างชีต Logs อัตโนมัติสำเร็จแล้ว!");
  addLog("User1 (ทดสอบ)", "เข้าสู่ระบบ", "เข้าสู่ระบบผ่านเบราว์เซอร์");
}

// =====================================================================================
// --- 4. AUTHENTICATION (Optimized with Cache) ---

function loginUser(u, p) { 
    const cache = CacheService.getScriptCache();
    // 1. ลองดึงข้อมูลผู้ใช้จาก Cache ก่อน (เร็วมาก)
    const cachedUsers = cache.get("ALL_USERS_DATA");
    let usersList = [];

    if (cachedUsers) {
        usersList = JSON.parse(cachedUsers);
    } else {
        // 2. ถ้าไม่มีใน Cache ค่อยไปเปิด Sheet (ช้าหน่อย แต่ทำทีเดียว)
        try {
            const { usersSheet } = getDb();
            const d = usersSheet.getDataRange().getValues();
            
            // แปลงข้อมูลจาก Sheet เป็น Array of Objects
            for(let i=1; i<d.length; i++) { 
                if(!d[i][0]) continue;
                usersList.push({
                    id: String(d[i][0]), 
                    username: String(d[i][1]).toLowerCase().trim(), 
                    password: String(d[i][2]).trim(),
                    role: String(d[i][3]), 
                    fullName: String(d[i][4] || d[i][1]), 
                    assignedAgents: String(d[i][10]||'') 
                });
            }
            
            // 3. บันทึกลง Cache ไว้ 20 นาที (1200 วินาที)
            // ครั้งต่อไปใครมา Login ก็ไม่ต้องเปิด Sheet แล้ว
            cache.put("ALL_USERS_DATA", JSON.stringify(usersList), 1200);
            
        } catch (e) {
            return {success:false, message:'ระบบขัดข้องทางเทคนิค (Database Error)'};
        }
    }
    
    // 4. ตรวจสอบ Username / Password (จากข้อมูลใน RAM)
    const inputUser = String(u).toLowerCase().trim();
    const inputPass = String(p).trim();
    
    const found = usersList.find(user => user.username === inputUser && user.password === inputPass);

    if(found) { 
        return { 
            success: true, 
            user: { 
                id: found.id, 
                username: found.username, 
                role: found.role, 
                fullName: found.fullName, 
                assignedAgents: found.assignedAgents 
            } 
        }; 
    } 
    
    return {success:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'};
}
// 🔥 ระบบ Cache สำหรับข้อมูลการจองทั้งหมด (เร่งความเร็ว)
function _getRawBookingsCached() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("RAW_BOOKINGS");
  if (cached) return JSON.parse(cached);

  const data = getDb().bookingsSheet.getDataRange().getValues();
  try {
    // เก็บลง Cache ไว้ 30 นาที (1800 วินาที)
    cache.put("RAW_BOOKINGS", JSON.stringify(data), 1800); 
  } catch(e) { /* ถ้าข้อมูลใหญ่เกิน 100KB ระบบจะข้ามการทำ Cache ไปเอง */ }
  return data;
}

function _clearBookingCache() {
  CacheService.getScriptCache().remove("RAW_BOOKINGS");
}

// ฟังก์ชันช่วยล้าง Cache (Internal Use)
function _clearUserCache() {
    CacheService.getScriptCache().remove("ALL_USERS_DATA");
}

// =====================================================================================
// 5. BOOKING MANAGEMENT
// =====================================================================================

function getBookings(userId, role, month, year) {
  const { bookingsSheet, usersSheet } = getDb();
  const data = _getRawBookingsCached();
  const uData = usersSheet.getDataRange().getValues();
  let uMap = {}; uData.slice(1).forEach(r => { if (r[0]) uMap[String(r[0])] = { username: r[1], fullName: r[4] }; });

  let bookings = [];
  let filterMonth = (month !== undefined && month !== null && month !== "") ? parseInt(month) : null;
  let filterYear = (year !== undefined && year !== null && year !== "") ? parseInt(year) : null;

  if (data.length > 1) {
    for (let i = data.length - 1; i >= 1; i--) {
      if (!data[i][0]) continue;

      if (filterMonth !== null && filterYear !== null) {
        const checkInDate = new Date(data[i][3]);
        if (checkInDate.getMonth() !== filterMonth || checkInDate.getFullYear() !== filterYear) continue;
      }

      const bookerId = String(data[i][1]).trim();
      if (role === 'Admin' || bookerId === String(userId).trim()) {
        const uInfo = uMap[bookerId] || { username: 'Unknown', fullName: 'Unknown' };
        bookings.push({
          id: String(data[i][0]), userId: bookerId, username: uInfo.fullName || uInfo.username,
          hotelName: data[i][2], checkIn: formatDate(data[i][3]), checkOut: formatDate(data[i][4]),
          status: data[i][5], receiptUrl: data[i][6], agentName: data[i][8],
          transferSlipUrl: data[i][9], price: parseMoney(data[i][10]), paymentType: data[i][11] || 'ประจำเดือน'
        });
      }
    }
  }
  return { data: bookings };
}

function createBooking(d) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(20000)) return { success: false, message: "ระบบกำลังทำงานหนัก กรุณากดบันทึกใหม่อีกครั้ง" };
    if (typeof _isSystemOpen === 'function' && !_isSystemOpen() && d.userId && d.role !== 'Admin') {
      return { success: false, message: 'ระบบปิดรับการจองชั่วคราว' };
    }
    if (parseMoney(d.price) < 0) return { success: false, message: 'ยอดเงินไม่ถูกต้อง' };

    const checkInDate = new Date(d.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(d.checkOut); checkOutDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const db = getDb();
    const { bookingsSheet, usersSheet } = db;

    if (d.role !== 'Admin') {
      const overlap = _checkOverlap(db, d.userId, d.checkIn, d.checkOut);
      if (overlap.found) return { success: false, message: `ไม่สามารถจองได้! ช่วงเวลานี้ซ้อนกับ: ${overlap.hotel}` };
    }

    let bookerName = d.userId;
    try {
      const users = usersSheet.getDataRange().getValues();
      const userRow = users.find(u => String(u[0]) === String(d.userId));
      if (userRow) bookerName = userRow[4] || userRow[1];
    } catch (e) { }

    const bookingId = 'BK-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");
    let hotelName = d.hotelName || "รอระบุ";

    bookingsSheet.appendRow([bookingId, d.userId, hotelName, d.checkIn, d.checkOut, 'Pending', '', new Date(), d.agentName, '', parseMoney(d.price), d.paymentType]);
    SpreadsheetApp.flush();
    
    // ✅ ล้าง Cache ทันทีที่มีการเพิ่มข้อมูลใหม่
    _clearBookingCache(); 

    lock.releaseLock();

    // 2. ส่งข้อมูลไปสร้างใหม่ใน Firebase ทันที
    updateBookingToFirebase({
      id: bookingId, userId: d.userId, bookerName: bookerName, hotel: hotelName, checkIn: d.checkIn, checkOut: d.checkOut, status: 'Pending', receiptUrl: '', remark: '', agent: d.agentName || '', slipUrl: '', price: parseMoney(d.price), paymentType: d.paymentType || 'ประจำเดือน'
    });

   logAction(d.actorId || d.userId, "Create Booking", `ID: ${bookingId}, Hotel: ${hotelName}, Price: ${d.price}, Type: ${d.paymentType}`);
    
    // 🌟 แก้ไขชื่อตัวแปรให้ตรงกับหน้าเว็บ (d.notify) และใช้ฟังก์ชันเดิมของคุณ
    if (d.notify || d.sendDiscord) {
      sendDiscordNotify({ 
        type: 'New Booking', 
        id: bookingId, 
        booker: bookerName, 
        hotel: hotelName, 
        checkIn: d.checkIn, 
        checkOut: d.checkOut, 
        agent: d.agentName, 
        payment: d.paymentType, 
        status: 'Pending', 
        price: parseMoney(d.price) 
      });
    }

    return { success: true };
  } catch (e) { 
    return { success: false, message: e.toString() };
  } finally { 
    if (lock.hasLock()) lock.releaseLock(); 
  }
}

function updateBookingDetails(id, status, price, notify, actorId, hotelName, reason, checkIn, checkOut) {
  try {
    const { bookingsSheet, usersSheet } = getDb();
    const data = bookingsSheet.getDataRange().getValues();
    let found = false;
    let bData = {};
    let userId = "";
    let isDateChanged = false; // ตัวแปรจับตาดูว่ามีการเปลี่ยนวันหรือไม่

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        // เก็บวันที่เดิมมาเปรียบเทียบ
        const oldCheckIn = formatDate(data[i][3]);
        const oldCheckOut = formatDate(data[i][4]);

        bookingsSheet.getRange(i + 1, 6).setValue(status);
        bookingsSheet.getRange(i + 1, 11).setValue(parseMoney(price));
        if (hotelName) bookingsSheet.getRange(i + 1, 3).setValue(hotelName);
        
        // 🌟 บันทึกวันที่เข้าพักและออกใหม่ (ถ้ามีการส่งมา)
        if (checkIn) bookingsSheet.getRange(i + 1, 4).setValue(checkIn);
        if (checkOut) bookingsSheet.getRange(i + 1, 5).setValue(checkOut);
        
        bookingsSheet.getRange(i + 1, 8).setValue(new Date());
        
        const r = bookingsSheet.getRange(i + 1, 1, 1, 12).getValues()[0];
        bData = { id: r[0], userId: r[1], hotel: r[2], checkIn: formatDate(r[3]), checkOut: formatDate(r[4]), status: r[5], agent: r[8], price: r[10], payment: r[11] };
        userId = r[1];
        found = true; 
        
        // เช็คว่าวันเข้าพักถูกแก้ไขจริงหรือไม่
        if (oldCheckIn !== bData.checkIn || oldCheckOut !== bData.checkOut) {
            isDateChanged = true;
        }

        SpreadsheetApp.flush();
        _clearBookingCache();

        updateBookingToFirebase({
          id: bData.id, status: bData.status, price: bData.price, hotel: bData.hotel, checkIn: bData.checkIn, checkOut: bData.checkOut, remark: reason || '', paymentType: bData.payment || 'ประจำเดือน'
        });
        break;
      }
    }
    if (!found) return { success: false, message: 'Booking not found' };

    let logMsg = `Booking ${id}: Status=${status}, Price=${price}`;
    if (isDateChanged) logMsg += `, Date changed to ${bData.checkIn} - ${bData.checkOut}`;
    if (reason) logMsg += `, Reason=${reason}`;
    logAction(actorId || 'System', "Update Details", logMsg);

    if (notify === true || notify === "true" || notify === 1) {
      let bookerName = userId;
      const uData = usersSheet.getDataRange().getValues();
      for (let k = 1; k < uData.length; k++) { if (String(uData[k][0]) === String(userId)) { bookerName = uData[k][4] || uData[k][1]; break; } }
      
      // 🌟 แนบข้อความแจ้งเตือนพิเศษเข้า Discord ถ้าย้ายวันเข้าพัก
      let notifyReason = reason || "";
      if (isDateChanged) {
          const dateMsg = `📅 มีการแก้ไข/เลื่อนวันเข้าพักใหม่\n(เข้าพัก: ${bData.checkIn} ถึง ${bData.checkOut})`;
          notifyReason = notifyReason ? notifyReason + `\n${dateMsg}` : dateMsg;
      }

      sendDiscordNotify({ type: 'Update Status', id: bData.id, booker: bookerName, hotel: bData.hotel, checkIn: bData.checkIn, checkOut: bData.checkOut, agent: bData.agent, payment: bData.payment, status: status, price: price, reason: notifyReason });
    }
    return { success: true };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function deleteBooking(id, actorId) {
  try {
    const { bookingsSheet } = getDb();
    const data = bookingsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        bookingsSheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        
        // ✅ ล้าง Cache เมื่อลบข้อมูล
        _clearBookingCache();

        deleteBookingFromFirebase(id);
        logAction(actorId, "Delete Booking", "ID: " + id);
        return { success: true };
      }
    }
    return { success: false, message: 'Not found' };
  } catch (e) { return { success: false, message: e.toString() } }
}

function batchUpdateBookings(ids, status, actorId) {
  try {
    const db = getDb();
    const sheet = db.bookingsSheet;
    const data = sheet.getDataRange().getValues();
    let updatedCount = 0; let totalAmount = 0;

    for (let i = 1; i < data.length; i++) {
      if (ids.includes(String(data[i][0]))) {
        sheet.getRange(i + 1, 6).setValue(status);
        sheet.getRange(i + 1, 8).setValue(new Date());
        
        updateBookingToFirebase({ id: String(data[i][0]), status: status });
        updatedCount++;
        totalAmount += Number(data[i][10] || 0);
      }
    }
    if (updatedCount > 0) {
      SpreadsheetApp.flush();
      // ✅ ล้าง Cache ทันทีที่มีการอัปเดตแบบกลุ่ม
      _clearBookingCache();
      logAction(actorId, "Batch Update", `Updated ${updatedCount} items to ${status}`);
    }
    return { success: true, count: updatedCount };
  } catch (e) { return { success: false, message: e.toString() }; }
}

// =====================================================================================
// 6. MASTER DATA MANAGEMENT (Optimized with CacheService)
// =====================================================================================

function getAllMasterData() { 
  return { users: getUsers(), hotels: getHotels(), agents: getAgents() };
}

function getUsers() { 
  try { 
    const data = getDb().usersSheet.getDataRange().getValues(); 
    let users = [];
    if (data.length > 1) { 
      for (let i = 1; i < data.length; i++) { 
        if (!data[i][0]) continue;
        users.push({ id: String(data[i][0]), username: String(data[i][1]), password: String(data[i][2]), role: String(data[i][3]), fullName: String(data[i][4]), level: String(data[i][5]), rights: String(data[i][6]), phone: String(data[i][7]), creditLimit: parseMoney(data[i][8]), assignedAgents: String(data[i][10] || ''), flowLimit: parseMoney(data[i][11]) });
      } 
    } 
    return users; 
  } catch (e) { return []; } 
}

// -----------------------------------------------------
// 🔥 ระบบ Cache สำหรับข้อมูลโรงแรม (Hotels)
// -----------------------------------------------------
function getHotels() { 
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get("ALL_HOTELS_DATA");
  if (cachedData) return JSON.parse(cachedData); // โหลดจาก Cache ถ้ามี (เร็วมาก)

  try { 
    const d = getDb().hotelsSheet.getDataRange().getValues();
    let h = []; 
    if (d.length > 1) {
      for (let i = 1; i < d.length; i++) {
        if (d[i][0]) h.push({ id: String(d[i][0]), name: d[i][1], registeredName: d[i][2], phone: d[i][3], bank: d[i][4], accNum: d[i][5], accName: d[i][6], docType: d[i][7], qrCodeUrl: d[i][9], province: d[i][10], remark: d[i][11] || '' });
      }
    }
    cache.put("ALL_HOTELS_DATA", JSON.stringify(h), 1800); // เก็บลง Cache 30 นาที
    return h; 
  } catch (e) { return [] } 
}

function _clearHotelCache() {
  CacheService.getScriptCache().remove("ALL_HOTELS_DATA");
}

// -----------------------------------------------------
// 🔥 ระบบ Cache สำหรับข้อมูลเอเย่นต์ (Agents)
// -----------------------------------------------------
function getAgents() { 
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get("ALL_AGENTS_DATA");
  if (cachedData) return JSON.parse(cachedData); // โหลดจาก Cache ถ้ามี (เร็วมาก)

  try { 
    const d = getDb().agentsSheet.getDataRange().getValues();
    let a = []; 
    if (d.length > 1) {
      for (let i = 1; i < d.length; i++) {
        if (d[i][0]) a.push({ id: String(d[i][0]), name: d[i][1], province: d[i][2] });
      }
    }
    cache.put("ALL_AGENTS_DATA", JSON.stringify(a), 1800); // เก็บลง Cache 30 นาที
    return a; 
  } catch (e) { return [] } 
}

function _clearAgentCache() {
  CacheService.getScriptCache().remove("ALL_AGENTS_DATA");
}


// --- Users (ยังคงโค้ดเดิมของคุณที่แก้เพิ่ม _clearUserCache ไว้แล้ว) ---
// ... (วางฟังก์ชัน addUser, updateUser, deleteUser ของเดิมของคุณไว้ตรงนี้) ...


// --- Hotels (เพิ่มการเคลียร์ Cache เมื่อมีการแก้ไข) ---
function addHotel(d) { 
  try { 
    getDb().hotelsSheet.appendRow(['H' + Date.now(), d.name, d.registeredName, d.phone, d.bank, d.accNum, d.accName, d.docType, new Date(), d.qrCodeUrl || '', d.province,d.remark || '']);
    logAction(d.actorId || 'Admin', "Add Hotel", `Name: ${d.name}`); 
    _clearHotelCache(); // ✅ ล้าง Cache ทันทีเมื่อเพิ่มข้อมูลใหม่
    return { success: true };
  } catch (e) { return { success: false } } 
}

function updateHotel(d) { 
  try { 
    const s = getDb().hotelsSheet;
    const r = s.getDataRange().getValues(); 
    for (let i = 1; i < r.length; i++) {
      if (String(r[i][0]) == String(d.id)) { 
        s.getRange(i + 1, 2).setValue(d.name);
        s.getRange(i + 1, 3).setValue(d.registeredName); s.getRange(i + 1, 4).setValue(d.phone); s.getRange(i + 1, 5).setValue(d.bank); s.getRange(i + 1, 6).setValue(d.accNum); s.getRange(i + 1, 7).setValue(d.accName);
        s.getRange(i + 1, 8).setValue(d.docType); if (d.qrCodeUrl) s.getRange(i + 1, 10).setValue(d.qrCodeUrl); s.getRange(i + 1, 11).setValue(d.province); s.getRange(i + 1, 12).setValue(d.remark || '');
        logAction(d.actorId || 'Admin', "Update Hotel", `ID: ${d.id}`); 
        _clearHotelCache(); // ✅ ล้าง Cache เมื่อแก้ไขข้อมูล
        return { success: true }; 
      }
    } 
    return { success: false };
  } catch (e) { return { success: false } } 
}

function deleteHotel(id, actorId) { 
  try { 
    const s = getDb().hotelsSheet;
    const d = s.getDataRange().getValues(); 
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]) == String(id)) { 
        s.deleteRow(i + 1);
        logAction(actorId || 'Admin', "Delete Hotel", "ID: " + id); 
        _clearHotelCache(); // ล้าง Cache เมื่อลบข้อมูลเสร็จ
        return { success: true }; 
      }
    } 
    return { success: false, message: 'ไม่พบข้อมูลโรงแรมนี้ในระบบ' };
  } catch (e) { 
    return { success: false, message: e.toString() };
  } 
}

// --- Agents (เพิ่มการเคลียร์ Cache เมื่อมีการแก้ไข) ---
function addAgent(d) { 
  try { 
    getDb().agentsSheet.appendRow(['A' + Date.now(), d.name, d.province, new Date()]);
    logAction(d.actorId || 'Admin', "Add Agent", `Name: ${d.name}`); 
    _clearAgentCache(); // ✅ ล้าง Cache ทันทีเมื่อเพิ่มข้อมูลใหม่
    return { success: true };
  } catch (e) { return { success: false } } 
}

function deleteAgent(id, actorId) { 
  try { 
    const s = getDb().agentsSheet;
    const d = s.getDataRange().getValues(); 
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]) == String(id)) { 
        s.deleteRow(i + 1);
        logAction(actorId || 'Admin', "Delete Agent", "ID: " + id); 
        _clearAgentCache(); // ✅ ล้าง Cache เมื่อลบข้อมูล
        return { success: true }; 
      }
    } 
    return { success: false };
  } catch (e) { return { success: false } } 
}

// --- Monthly Limits ---
function updateUserCreditLimit(userId, newLimit, newFlowLimit, actorId, month, year) {
  try {
    const db = getDb();
    if (month !== null && month !== undefined && year !== null && year !== undefined) {
      const sheet = db.monthlyLimitsSheet;
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(userId) && parseInt(data[i][2]) === parseInt(month) && parseInt(data[i][3]) === parseInt(year)) {
          sheet.getRange(i + 1, 5).setValue(parseMoney(newLimit));
          sheet.getRange(i + 1, 6).setValue(parseMoney(newFlowLimit));
          sheet.getRange(i + 1, 7).setValue(new Date());
          found = true; break;
        }
      }
      if (!found) { sheet.appendRow(['ML-' + Date.now(), userId, parseInt(month), parseInt(year), parseMoney(newLimit), parseMoney(newFlowLimit), new Date()]); }
      logAction(actorId, "Update Monthly Limit", `User: ${userId}, Month: ${month}/${year}, Limit: ${newLimit}`);
      return { success: true };
    }
    return { success: false, message: 'Invalid Month/Year' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

// =====================================================================================
// 7. DASHBOARD & REPORTS
// =====================================================================================

function getDashboardStats(userId, role) {
  try {
    const today = new Date();
    const { bookingsSheet, usersSheet } = getDb();
    const bookings = _getRawBookingsCached();

    const creditReport = getBudgetReport(today.getMonth(), today.getFullYear(), role, userId);
    let userCreditInfo = { limit: 0, used: 0, remaining: 0, limitFlow: 0, usedFlow: 0, remainingFlow: 0 };
    if (creditReport.success && creditReport.data.length > 0) {
      if (role !== 'Admin') {
        const d = creditReport.data[0];
        userCreditInfo = { limit: d.limitCash, used: d.usedCash, remaining: d.remainingCash, limitFlow: d.limitFlow, usedFlow: d.usedFlow, remainingFlow: d.remainingFlow };
      }
    }

    let total = 0, pending = 0, confirmed = 0, noReceipt = 0, recent = [];
    let reservePendingAmount = 0; // ยอดรอเบิกคืน (สำรองจ่าย)

    if (bookings.length > 1) {
      for (let i = bookings.length - 1; i >= 1; i--) {
        const r = bookings[i];
        if (!r[0]) continue;

        if (role === 'Admin' || String(r[1]).trim() === String(userId).trim()) {
          total++;
          const status = r[5];
          const paymentType = r[11] || 'ประจำเดือน';
          
          // ประกาศตัวแปร price แค่ครั้งเดียวตรงนี้
          const price = parseMoney(r[10]);
          
          if (status === 'Pending') pending++;
          
          // 🔥 [UPDATED] นับรวม 'Reimbursed' (เบิกจ่ายคืนแล้ว) เป็นรายการที่สำเร็จ
          if (status === 'Booking Confirmed' || status === 'Payment Completed' || status === 'Reimbursed') {
              confirmed++;
              if (!r[6]) noReceipt++;
          }

          // 🔥 [UPDATED] คำนวณยอดรอเบิกคืน
          // ถ้าเป็น 'Reimbursed' ไปแล้ว จะไม่ถูกนำมาบวกในยอดนี้ ทำให้ตัวเลขหน้า Dashboard ลดลงตามจริง
          if (paymentType === 'สำรองจ่าย' && (status === 'Booking Confirmed' || status === 'Payment Completed')) {
              reservePendingAmount += price;
          }

          if (recent.length < 5) recent.push({ hotelName: r[2], checkIn: formatDate(r[3]), status: status });
        }
      }
    }
    
    return { 
        totalBookings: total, 
        pending, 
        confirmed, 
        noReceipt, 
        recent, 
        totalUsers: usersSheet.getLastRow() - 1, 
        systemOpen: _isSystemOpen(), 
        userCredit: userCreditInfo,
        reservePendingAmount: reservePendingAmount
    };
  } catch (e) { 
      return { totalBookings: 0, pending: 0, confirmed: 0, noReceipt: 0, recent: [], totalUsers: 0, systemOpen: true, userCredit: { limit: 0, used: 0, remaining: 0, limitFlow: 0, usedFlow: 0, remainingFlow: 0 }, reservePendingAmount: 0 };
  }
}

function getBudgetReport(month, year, role, userId) {
  try {
    const db = getDb();
    const usersData = db.usersSheet.getDataRange().getValues();
    const bookingsData = _getRawBookingsCached();
    const monthlyLimitsData = db.monthlyLimitsSheet.getDataRange().getValues();

    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);
    let reportData = [];

    for (let i = 1; i < usersData.length; i++) {
      const u = usersData[i];
      if (!u[0]) continue;
      const currentUid = String(u[0]).trim();
      if (role !== 'Admin' && currentUid !== String(userId).trim()) continue;

      let limitCash = parseMoney(u[8]);
      let limitFlow = parseMoney(u[11]);
      // Override with monthly limit
      for (let j = 1; j < monthlyLimitsData.length; j++) {
        if (String(monthlyLimitsData[j][1]).trim() === currentUid && parseInt(monthlyLimitsData[j][2]) === targetMonth && parseInt(monthlyLimitsData[j][3]) === targetYear) {
          limitCash = parseMoney(monthlyLimitsData[j][4]);
          limitFlow = parseMoney(monthlyLimitsData[j][5]);
          break;
        }
      }
      reportData.push({ id: currentUid, name: String(u[4] || u[1]), role: u[3], limitCash: limitCash, limitFlow: limitFlow, usedCash: 0, usedFlow: 0, count: 0 });
    }

    if (bookingsData.length > 1) {
      for (let i = 1; i < bookingsData.length; i++) {
        const b = bookingsData[i];
        if (!b[0]) continue;
        const status = b[5];
        if (status === 'Cancelled' || status === 'Hotel Cancelled') continue;

        let bDate = new Date(b[3]);
        if (!isNaN(bDate.getTime()) && bDate.getMonth() === targetMonth && bDate.getFullYear() === targetYear) {
          const bookerId = String(b[1]).trim();
          const userRecord = reportData.find(u => u.id === bookerId);
          if (userRecord) {
            const price = parseMoney(b[10]);
            const type = String(b[11] || 'ประจำเดือน').trim();
            
            // [UPDATED] Check Logic
            if (type === 'Flow') {
                userRecord.usedFlow += price;
            } else if (type === 'ประจำเดือน') {
                userRecord.usedCash += price;
            }
            // 'เงินสำรองจ่าย' ไม่นำไปหักวงเงิน
            
            userRecord.count++;
          }
        }
      }
    }

    reportData = reportData.map(u => ({ ...u, remainingCash: u.limitCash - u.usedCash, remainingFlow: u.limitFlow - u.usedFlow, statusCash: (u.usedCash > u.limitCash) ? 'Over' : (u.usedCash / u.limitCash > 0.8 ? 'Warning' : 'OK'), statusFlow: (u.usedFlow > u.limitFlow) ? 'Over' : (u.usedFlow / u.limitFlow > 0.8 ? 'Warning' : 'OK') }));
    return { success: true, data: reportData };
  } catch (e) { return { success: false, message: e.toString() }; }
}

// =====================================================================================
// 8. FILE UPLOADS
// =====================================================================================

function uploadReceipt(d) {
  const result = handleFileUpload(d, "HotelReceipts_Uploads", 7);
  if (result.success) {
    try {
      const db = getDb();
      const bookings = db.bookingsSheet.getDataRange().getValues();
      const row = bookings.find(r => String(r[0]) === String(d.bookingId));
      if (row) {
        sendReceiptUploadNotify({ id: row[0], uploadedBy: d.username || "Unknown", hotel: row[2], checkIn: formatDate(row[3]), checkOut: formatDate(row[4]), price: row[10], receiptUrl: result.url });
      }
    } catch (e) { console.error("Error sending receipt notify: " + e.toString()); }
  }
  return result;
}

function uploadTransferSlip(d) { return handleFileUpload(d, "HotelTransferSlips", 10); }
function uploadHotelQRCode(d) { return handleFileUpload(d, "Hotel_QR_Codes", -1); }

function handleFileUpload(data, rootFolderId, columnIdx) {
  try {
    if (!rootFolderId || rootFolderId.includes('วาง_ID')) rootFolderId = "BMS_Uploads_Fallback";
    let finalFileName = data.fileName;
    let bookerName = "Unknown_User";
    let refDate = new Date();

    if (data.bookingId) {
      const db = getDb();
      const bookings = db.bookingsSheet.getDataRange().getValues();
      const users = db.usersSheet.getDataRange().getValues();
      const bookingRow = bookings.find(r => String(r[0]) === String(data.bookingId));
      if (bookingRow) {
        if (bookingRow[3]) refDate = new Date(bookingRow[3]);
        const userId = String(bookingRow[1]);
        const userRow = users.find(u => String(u[0]) === userId);
        if (userRow) bookerName = (userRow[4] || userRow[1]).toString().replace(/[^a-zA-Z0-9ก-๙ ]/g, "").trim();
        const dateStr = Utilities.formatDate(refDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        const ext = data.fileName.includes('.') ? data.fileName.substring(data.fileName.lastIndexOf('.')) : '';
        finalFileName = `${dateStr}_${data.bookingId}${ext}`;
      }
    }

    const targetFolder = getTargetFolderByPath(rootFolderId, bookerName, refDate);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.base64 || data.base), data.mimeType, finalFileName);
    const file = targetFolder.createFile(blob);
    //file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    let url = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";

    if (columnIdx !== -1 && data.bookingId) {
      const s = getDb().bookingsSheet;
      const d = s.getDataRange().getValues();
      for (let i = 1; i < d.length; i++) {
        if (String(d[i][0]) == String(data.bookingId)) {
          s.getRange(i + 1, columnIdx).setValue(url);
          s.getRange(i + 1, 8).setValue(new Date());
          logAction(data.username || 'System', "Upload File", `Booking: ${data.bookingId}, File: ${finalFileName}`);
          break;
        }
      }
    }
    return { success: true, url: url };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function getTargetFolderByPath(rootIdOrName, employeeName, dateObj) {
  let currentFolder;
  try { currentFolder = DriveApp.getFolderById(rootIdOrName); } catch (e) {
    const iter = DriveApp.getFoldersByName(rootIdOrName);
    currentFolder = iter.hasNext() ? iter.next() : DriveApp.createFolder(rootIdOrName);
  }
  currentFolder = getOrCreateSubFolder(currentFolder, Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy"));
  currentFolder = getOrCreateSubFolder(currentFolder, Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "MM"));
  currentFolder = getOrCreateSubFolder(currentFolder, employeeName);
  return currentFolder;
}

function getOrCreateSubFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
}

// =====================================================================================
// 9. PDF GENERATION
// =====================================================================================

function generateMergedPDF(bookingId) {
  try {
    const db = getDb();
    const data = db.bookingsSheet.getDataRange().getValues();
    const users = db.usersSheet.getDataRange().getValues();
    let booking = null;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(bookingId)) {
        let bookerName = data[i][1];
        const userRow = users.find(u => String(u[0]) === String(data[i][1]));
        if (userRow) bookerName = userRow[4] || userRow[1];
        booking = { id: data[i][0], hotel: data[i][2], checkIn: formatDate(data[i][3]), checkOut: formatDate(data[i][4]), status: data[i][5], receiptUrl: data[i][6], agent: data[i][8] || '-', slipUrl: data[i][9], price: Number(data[i][10]), bookerName: bookerName, createdDate: formatDate(new Date()) };
        break;
      }
    }

    if (!booking) return { success: false, message: 'ไม่พบข้อมูลการจอง' };
    if (!booking.receiptUrl && !booking.slipUrl) return { success: false, message: 'รายการนี้ไม่มีไฟล์แนบ' };

    const docName = `Voucher_${booking.id}_${booking.hotel}`;
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();
    const margin = 36;
    body.setMarginTop(margin).setMarginBottom(margin).setMarginLeft(margin).setMarginRight(margin);

    const brandColor = '#1a237e'; const accentColor = '#f5f5f5'; const grayText = '#616161';
    const setFont = (elem, size, bold, color) => { const style = {}; style[DocumentApp.Attribute.FONT_FAMILY] = 'Sarabun'; style[DocumentApp.Attribute.FONT_SIZE] = size; style[DocumentApp.Attribute.BOLD] = bold; style[DocumentApp.Attribute.FOREGROUND_COLOR] = color; elem.setAttributes(style); };

    // Header
    const headerTable = body.appendTable([['']]); headerTable.setBorderWidth(0); headerTable.getRow(0).setMinimumHeight(15).getCell(0).setBackgroundColor(brandColor); body.appendParagraph("");

    // Title
    const titleTable = body.appendTable(); const titleRow = titleTable.appendTableRow();
    const tCell1 = titleRow.appendTableCell("BOOKING CONFIRMATION\nใบยืนยันการจองห้องพัก"); setFont(tCell1.getChild(0), 16, true, brandColor);
    const tCell2 = titleRow.appendTableCell(`REF NO: #${booking.id}\nDATE: ${booking.createdDate}`); const tPara2 = tCell2.getChild(0); setFont(tPara2, 9, false, grayText); tPara2.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    titleTable.setBorderWidth(0); body.appendHorizontalRule();

    // Details Grid
    const gridTable = body.appendTable(); const gridRow = gridTable.appendTableRow();
    const leftCell = gridRow.appendTableCell(); const leftP = leftCell.appendParagraph("");
    leftP.appendText("GUEST NAME:\n").setFontSize(9).setBold(true).setForegroundColor(grayText); leftP.appendText(booking.bookerName + "\n").setFontSize(11).setBold(true).setForegroundColor('#000000');
    leftP.appendText(`Agent: ${booking.agent}\n\n`).setFontSize(9).setForegroundColor('#000000'); leftP.appendText("HOTEL:\n").setFontSize(9).setBold(true).setForegroundColor(grayText); leftP.appendText(booking.hotel).setFontSize(11).setBold(true).setForegroundColor(brandColor);

    const rightCell = gridRow.appendTableCell(); rightCell.setBackgroundColor(accentColor).setPaddingTop(10).setPaddingBottom(10).setPaddingLeft(10).setPaddingRight(10);
    const rightP = rightCell.appendParagraph(""); rightP.appendText("CHECK-IN:   ").setBold(true).setFontSize(9); rightP.appendText(booking.checkIn + "\n").setBold(false).setFontSize(9); rightP.appendText("CHECK-OUT: ").setBold(true).setFontSize(9); rightP.appendText(booking.checkOut + "\n\n").setBold(false).setFontSize(9);

    const priceP = rightCell.appendParagraph("TOTAL AMOUNT:\n"); priceP.setAlignment(DocumentApp.HorizontalAlignment.RIGHT); setFont(priceP.getChild(0), 9, false, grayText);
    const priceVal = priceP.appendText(booking.price.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " THB"); setFont(priceVal, 14, true, brandColor);

    const statusP = rightCell.appendParagraph(""); statusP.setAlignment(DocumentApp.HorizontalAlignment.CENTER); statusP.setSpacingBefore(10);
    const statusColor = (booking.status.includes('Confirmed') || booking.status.includes('Approved')) ? '#2e7d32' : '#c62828';
    const statusText = statusP.appendText(`[ ${booking.status.toUpperCase()} ]`); setFont(statusText, 11, true, statusColor);
    gridTable.setBorderWidth(0); body.appendParagraph("").setSpacingAfter(15);

    // Attachments
    const getBlobFromUrl = (url) => { try { if (!url) return null; let fileId = ""; if (url.indexOf("id=") > -1) fileId = url.split("id=")[1].split("&")[0]; else if (url.indexOf("/d/") > -1) fileId = url.split("/d/")[1].split("/")[0]; if (fileId) return DriveApp.getFileById(fileId).getBlob(); } catch (e) { Logger.log("Blob Err: " + e); } return null; };
    const addAttachment = (title, url) => {
      if (!url) return;
      const pHeader = body.appendParagraph(title); pHeader.setHeading(DocumentApp.ParagraphHeading.HEADING3); setFont(pHeader, 11, true, '#000000'); body.appendHorizontalRule();
      const blob = getBlobFromUrl(url); const pImg = body.appendParagraph(""); pImg.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(10).setSpacingAfter(20);
      if (blob && blob.getContentType().startsWith('image/')) { try { const img = pImg.appendInlineImage(blob); const maxW = 450; const w = img.getWidth(); const h = img.getHeight(); if (w > maxW) { img.setWidth(maxW); img.setHeight(h * (maxW / w)); } } catch (e) { pImg.appendText("(Image Error)"); } } else { pImg.appendText("⚠️ (ไฟล์ PDF - กรุณาดูจากไฟล์แนบ)").setItalic(true).setForegroundColor(grayText); }
    };

    if (booking.slipUrl) addAttachment("ATTACHMENT: Transfer Slip", booking.slipUrl);
    if (booking.receiptUrl) { if (booking.slipUrl) body.appendPageBreak(); addAttachment("ATTACHMENT: Receipt / Tax Invoice", booking.receiptUrl); }

    const footer = doc.addFooter(); const pFooter = footer.appendParagraph("BMS Enterprise System | Generated automatically."); pFooter.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setForegroundColor('#9e9e9e').setFontSize(8);
    doc.saveAndClose();
    const pdfBlob = DriveApp.getFileById(doc.getId()).getAs('application/pdf'); pdfBlob.setName(`Voucher_${booking.id}.pdf`);
    const folder = DriveApp.getFoldersByName("BMS_Merged_Docs").hasNext() ? DriveApp.getFoldersByName("BMS_Merged_Docs").next() : DriveApp.createFolder("BMS_Merged_Docs");
    //const pdfFile = folder.createFile(pdfBlob); pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    DriveApp.getFileById(doc.getId()).setTrashed(true);
    return { success: true, url: pdfFile.getDownloadUrl() };
  } catch (e) { return { success: false, message: "Error: " + e.toString() }; }
}

function generateBookingPDF(id) { return { success: true, url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' }; }

// =====================================================================================
// 10. NOTIFICATIONS (DISCORD)
// =====================================================================================

function sendDiscordNotify(data) {
  // 🛡️ 1. ระบบป้องกัน: ถ้าไม่มีข้อมูลส่งมาเลย ให้หยุดทำงานเงียบๆ ไม่ให้ระบบ Error
  if (!data) return; 
  
  if (!CONFIG.DISCORD_WEBHOOK_URL || CONFIG.DISCORD_WEBHOOK_URL.includes('xxxx')) return;
  
  // 🛡️ 2. ดักจับค่า price เผื่อส่งมาเป็น undefined จะได้ไม่ Error
  const price = Number(data.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  
  const formatDateTH = (dateStr) => { 
    if (!dateStr) return '-'; 
    if (dateStr instanceof Date) return Utilities.formatDate(dateStr, "GMT+7", "dd/MM/yyyy"); 
    const parts = String(dateStr).split('-'); 
    if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    return dateStr; 
  };

  const checkInTH = formatDateTH(data.checkIn);
  const checkOutTH = formatDateTH(data.checkOut);
  const reasonText = data.reason ? `**📝 หมายเหตุ:** ${data.reason}` : null;
  let color, title, desc, thumbUrl;

  switch (data.type === 'New Booking' ? 'New' : data.status) {
    case 'New': color = 5793266; title = "🆕 New Booking Request"; desc = "มีรายการจองใหม่เข้าสู่ระบบ"; thumbUrl = "https://cdn-icons-png.flaticon.com/512/2933/2933942.png"; break;
    case 'Booking Confirmed': color = 5763719; title = "✅ Booking Confirmed"; desc = "รายการได้รับการอนุมัติ"; thumbUrl = "https://cdn-icons-png.flaticon.com/512/148/148767.png"; break;
    case 'Payment Completed': color = 10181046; title = "💸 Payment Received"; desc = "ได้รับชำระเงินเรียบร้อยแล้ว"; thumbUrl = "https://cdn-icons-png.flaticon.com/512/2489/2489756.png"; break;
    case 'Cancelled': case 'Hotel Cancelled': case 'Rejected': color = 15548997; title = "❌ Booking Cancelled"; desc = reasonText ? `⚠️ **ยกเลิก**\n${reasonText}` : "รายการถูกยกเลิก"; thumbUrl = "https://cdn-icons-png.flaticon.com/512/1828/1828843.png"; break;
    case 'Reimbursed': color = 3066993; title = "💵 Reimbursed"; desc = "บัญชีทำจ่ายคืนเงินสำรองจ่ายเรียบร้อยแล้ว"; thumbUrl = "https://cdn-icons-png.flaticon.com/512/3135/3135706.png"; break;
    default: color = 16776960; title = `📝 Status: ${data.status || 'Unknown'}`; desc = reasonText || "มีการเปลี่ยนแปลงสถานะ"; thumbUrl = "https://cdn-icons-png.flaticon.com/512/3524/3524335.png"; break;
  }

  const payload = {
    "username": "BMS Notification",
    "avatar_url": "https://cdn-icons-png.flaticon.com/512/5968/5968756.png",
    "embeds": [{
      "title": title, "url": CONFIG.WEB_APP_URL, "description": desc, "color": color, "thumbnail": { "url": thumbUrl },
      "fields": [
        { "name": "🆔 Ref", "value": `\`${data.id || '-'}\``, "inline": true },
        { "name": "👤 User", "value": `**${data.booker || 'N/A'}**`, "inline": true },
        { "name": "🏨 Hotel", "value": `${data.hotel || '-'}`, "inline": false },
        { "name": "📅 In-Out", "value": `${checkInTH} - ${checkOutTH}`, "inline": true },
        { "name": "💰 Total", "value": `**${price}**`, "inline": true },
        { "name": "💳 Payment", "value": `${data.payment || 'N/A'}`, "inline": true }
      ],
      "footer": { "text": "BMS System • " + Utilities.formatDate(new Date(), "GMT+7", "HH:mm") }, "timestamp": new Date().toISOString()
    }]
  };
  
  try { 
    UrlFetchApp.fetch(CONFIG.DISCORD_WEBHOOK_URL, { 
        'method': 'post', 
        'headers': { 'Content-Type': 'application/json' }, 
        'payload': JSON.stringify(payload) 
    }); 
  } catch (e) { 
    Logger.log("Discord Error: " + e); 
  }
}

function sendReceiptUploadNotify(data) {
  if (!CONFIG.DISCORD_WEBHOOK_URL) return;
  const payload = {
    "username": "BMS Document", "avatar_url": "https://cdn-icons-png.flaticon.com/512/942/942748.png",
    "embeds": [{
      "title": "📄 New Receipt Uploaded", "url": data.receiptUrl, "description": `**${data.uploadedBy}** อัปโหลดเอกสาร`, "color": 3066993,
      "fields": [
        { "name": "🆔 Ref", "value": `\`${data.id}\``, "inline": true },
        { "name": "🏨 Hotel", "value": data.hotel, "inline": true },
        { "name": "📎 Link", "value": `[Click to View](${data.receiptUrl})`, "inline": true }
      ],
      "timestamp": new Date().toISOString()
    }]
  };
  try { UrlFetchApp.fetch(CONFIG.DISCORD_WEBHOOK_URL, { 'method': 'post', 'headers': { 'Content-Type': 'application/json' }, 'payload': JSON.stringify(payload) }); } catch (e) { }
}

function sendDiscordOverdue(data) {
  if (!CONFIG.DISCORD_WEBHOOK_URL) return;
  const payload = {
    "username": "BMS Reminder", "avatar_url": "https://cdn-icons-png.flaticon.com/512/10308/10308066.png",
    "embeds": [{
      "title": "⚠️ Overdue Receipt", "url": CONFIG.WEB_APP_URL, "description": `เรียนคุณ **${data.booker}**\nท่านยังไม่ส่งใบเสร็จ`, "color": 16753920,
      "fields": [{ "name": "🏨 Hotel", "value": data.hotel, "inline": false }, { "name": "⏳ Overdue", "value": `**${data.days} วัน**`, "inline": true }],
      "timestamp": new Date().toISOString()
    }]
  };
  try { UrlFetchApp.fetch(CONFIG.DISCORD_WEBHOOK_URL, { 'method': 'post', 'headers': { 'Content-Type': 'application/json' }, 'payload': JSON.stringify(payload) }); } catch (e) { }
}

function sendMissingAlertDiscord(names, start, end) {
  if (!CONFIG.DISCORD_WEBHOOK_URL) return;
  const range = `${formatDate(start)} - ${formatDate(end)}`;
  const list = Array.isArray(names) ? names.join('\n') : names;
  const payload = {
    "username": "BMS Reminder", "avatar_url": "https://cdn-icons-png.flaticon.com/512/945/945209.png",
    "embeds": [{
      "title": "⚠️ Missing Bookings Alert", "description": `รายชื่อผู้ที่ยังไม่จองสำหรับสัปดาห์หน้า:\n**${range}**`, "color": 16728128,
      "fields": [{ "name": "รายชื่อ", "value": `\`\`\`${list}\`\`\``, "inline": false }],
      "timestamp": new Date().toISOString()
    }]
  };
  try { UrlFetchApp.fetch(CONFIG.DISCORD_WEBHOOK_URL, { 'method': 'post', 'headers': { 'Content-Type': 'application/json' }, 'payload': JSON.stringify(payload) }); } catch (e) { }
}

// =====================================================================================
// 11. SYSTEM MAINTENANCE & TRIGGERS
// =====================================================================================

function checkWeeklyMissingBookings() {
  const db = getDb();
  const today = new Date();
  const nextMon = new Date(today); nextMon.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7); nextMon.setHours(0, 0, 0, 0);
  const nextSun = new Date(nextMon); nextSun.setDate(nextMon.getDate() + 6); nextSun.setHours(23, 59, 59, 999);

  const ignore = ["กุลโรจน์ จรัสสุนทรวงศ์", "ณัฐฐ์ณิพา ทรัพย์โสภณ", "ศุภิสรา คชเวช", "วัชรี แก้วชูใส"];
  const users = db.usersSheet.getDataRange().getValues();
  const bookings = db.bookingsSheet.getDataRange().getValues();
  let bookedIds = [];

  for (let i = 1; i < bookings.length; i++) {
    const r = bookings[i]; if (!r[0]) continue;
    if (!String(r[5]).includes('Cancel')) {
      const d = new Date(r[3]);
      if (d >= nextMon && d <= nextSun) bookedIds.push(String(r[1]));
    }
  }

  let missing = [];
  for (let i = 1; i < users.length; i++) {
    const u = users[i]; if (!u[0]) continue;
    const name = u[4] || u[1];
    if (!String(u[3]).includes('Admin') && !ignore.some(x => name.includes(x)) && !bookedIds.includes(String(u[0]))) {
      missing.push(`- ${name}`);
    }
  }

  if (missing.length) sendMissingAlertDiscord(missing, nextMon, nextSun);
}

// =====================================================================================
// 12. WORK PLAN MANAGEMENT (Optimized)
// =====================================================================================

// 🌟 1. เพิ่มระบบ Cache เพื่อลดภาระการเปิด Sheet
function _getRawWorkplansCached() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("RAW_WORKPLANS");
    if (cached) return JSON.parse(cached);

    const data = getDb().workPlansSheet.getDataRange().getValues();
    try { cache.put("RAW_WORKPLANS", JSON.stringify(data), 1800); } catch(e) {} // เก็บไว้ 30 นาที
    return data;
}

function _clearWorkplanCache() {
    CacheService.getScriptCache().remove("RAW_WORKPLANS");
}

// 🌟 2. ปรับการดึงข้อมูล (ให้ส่งกลับไปแค่ 6 เดือนล่าสุด)
function getWorkPlans(userId) {
  try {
    const data = _getRawWorkplansCached();
    let plans = [];
    
    // ตั้งค่าลิมิต: ดึงข้อมูลย้อนหลังไม่เกิน 6 เดือน (ช่วยให้หน้าเว็บไม่กระตุก)
    const today = new Date();
    const limitDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);

    // วนลูปจากล่างขึ้นบน (ข้อมูลใหม่สุด)
    for(let i = data.length - 1; i >= 1; i--) {
      if(String(data[i][1]) === String(userId)) {
        const planDate = new Date(data[i][3]);
        
        // ถ้าเก่ากว่า 6 เดือน ให้ข้ามไปเลย ไม่ต้องส่งไปให้หนักหน้าเว็บ
        if (planDate < limitDate) continue; 

        plans.push({ id: String(data[i][0]), agent: data[i][2], date: formatDate(data[i][3]) });
      }
    }
    return plans;
  } catch(e) { return []; }
}

function saveWorkPlan(d) {
  try {
    const id = 'WP-' + Date.now();
    getDb().workPlansSheet.appendRow([id, d.userId, d.agent, d.date, new Date()]);
    _clearWorkplanCache(); // 🌟 เคลียร์ Cache เมื่อมีการเพิ่มข้อมูล
    return { success: true, id: id };
  } catch(e) { return { success: false, message: e.toString() }; }
}

function updateWorkPlanDate(id, newDate) {
  try {
    const sheet = getDb().workPlansSheet;
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(String(data[i][0]) === String(id)) {
        sheet.getRange(i+1, 4).setValue(newDate);
        _clearWorkplanCache(); // 🌟 เคลียร์ Cache
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) { return { success: false }; }
}

function deleteWorkPlan(id) {
  try {
    const sheet = getDb().workPlansSheet;
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(String(data[i][0]) === String(id)) {
        sheet.deleteRow(i+1);
        _clearWorkplanCache(); // 🌟 เคลียร์ Cache
        return { success: true };
      }
    }
    return { success: false };
  } catch(e) { return { success: false }; }
}

// =====================================================================================
// 13. FUEL & FLEET PORTAL (UPDATED WITH MONTHLY FOLDERS & PDF MERGE)
// =====================================================================================

// ใส่ ID ของโฟลเดอร์หลักที่คุณสร้างไว้ใน Google Drive
const FUEL_ROOT_FOLDER_ID = 'ใส่_ID_FOLDER_หลัก_ที่นี่'; 

function uploadFuelReport(data) {
  try {
    const rootFolder = DriveApp.getFolderById(FUEL_ROOT_FOLDER_ID);
    const folderName = `Fuel_${data.year}_${data.month}`; // เช่น Fuel_2026_02
    
    // 1. ตรวจสอบและสร้างโฟลเดอร์ประจำเดือน
    let monthFolder;
    const folders = rootFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      monthFolder = folders.next();
    } else {
      monthFolder = rootFolder.createFolder(folderName);
    }
    
    const id = 'FR-' + Date.now();
    
    // 2. แปลงและบันทึกไฟล์สลิป PDF ลงโฟลเดอร์ของเดือนนั้น
    const pdfBlob = Utilities.newBlob(Utilities.base64Decode(data.pdfBase64), 'application/pdf', `${data.username}_Slip_${data.month}_${data.year}.pdf`);
    const pdfFile = monthFolder.createFile(pdfBlob);
    
    // 3. แปลงและบันทึกไฟล์ Excel ลงโฟลเดอร์ของเดือนนั้น
    const excelBlob = Utilities.newBlob(Utilities.base64Decode(data.excelBase64), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${data.username}_Report_${data.month}_${data.year}.xlsx`);
    const excelFile = monthFolder.createFile(excelBlob);
    
    const extractedTotalCost = 0; 
    
    // 4. บันทึกลง Sheet
    getDb().fuelReportsSheet.appendRow([
      id, data.userId, data.month, data.year, excelFile.getUrl(), pdfFile.getUrl(), extractedTotalCost, new Date()
    ]);
    
    return { success: true };
  } catch(e) { return { success: false, message: e.toString() }; }
}

async function mergeMonthlySlips(month, year) {
  try {
    const rootFolder = DriveApp.getFolderById(FUEL_ROOT_FOLDER_ID);
    const folderName = `Fuel_${year}_${month}`;
    const folders = rootFolder.getFoldersByName(folderName);
    
    if (!folders.hasNext()) {
      return { success: false, message: 'ยังไม่มีโฟลเดอร์ข้อมูลของเดือนนี้' };
    }
    
    const monthFolder = folders.next();
    const files = monthFolder.getFilesByType(MimeType.PDF);
    
    // ดึง Library pdf-lib มาใช้งานแบบ On-the-fly ในฝั่ง Server
    const pdfLibCode = UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js').getContentText();
    eval(pdfLibCode);
    
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();
    let fileCount = 0;
    
    // วนลูปอ่านไฟล์ PDF สลิปของทุกคนในโฟลเดอร์
    while (files.hasNext()) {
      const file = files.next();
      // ข้ามไฟล์ที่เคยรวมไปแล้ว (ป้องกันการดึงไฟล์ซ้ำ)
      if (file.getName().includes('Merged_All_Slips')) continue; 
      
      const fileBytes = file.getBlob().getBytes();
      const pdfToMerge = await PDFDocument.load(fileBytes);
      const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
      
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      fileCount++;
    }
    
    if (fileCount === 0) return { success: false, message: 'ไม่มีไฟล์สลิปของพนักงานให้รวม' };
    
    // บันทึกไฟล์ PDF ที่รวมเสร็จแล้ว
    const mergedPdfBytes = await mergedPdf.save();
    const newBlob = Utilities.newBlob(mergedPdfBytes, 'application/pdf', `Merged_All_Slips_${folderName}.pdf`);
    
    // ลบไฟล์รวมอันเก่าทิ้ง (ถ้ามี) เพื่อแทนที่ด้วยอันใหม่
    const oldFiles = monthFolder.getFilesByName(`Merged_All_Slips_${folderName}.pdf`);
    while (oldFiles.hasNext()) { oldFiles.next().setTrashed(true); }
    
    const finalFile = monthFolder.createFile(newBlob);
    
    return { success: true, url: finalFile.getUrl(), message: `รวมสลิปสำเร็จจำนวน ${fileCount} ไฟล์` };
  } catch(e) { 
    return { success: false, message: e.toString() }; 
  }
}

function checkOverdueReceipts() {
  const db = getDb(); const bookings = db.bookingsSheet.getDataRange().getValues(); const users = db.usersSheet.getDataRange().getValues();
  let userMap = {}; users.slice(1).forEach(u => { if (u[0]) userMap[String(u[0])] = u[4] || u[1]; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let count = 0;

  for (let i = 1; i < bookings.length; i++) {
    const row = bookings[i]; if (!row[0]) continue;
    if ((row[5] === 'Booking Confirmed' || row[5] === 'Payment Completed') && (!row[6])) {
      let checkOutDate = new Date(row[4]); if (isNaN(checkOutDate.getTime())) continue;
      checkOutDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - checkOutDate.getTime()) / (86400000));
      if (diffDays >= 1) {
        sendDiscordOverdue({ booker: userMap[String(row[1])] || row[1], hotel: row[2], checkOut: formatDate(row[4]), days: diffDays });
        count++;
      }
    }
  }
  console.log(`Checked overdue: ${count} found.`);
}

function autoBackupDatabase() {
  try {
    const folder = DriveApp.getFoldersByName("BMS_Backups").hasNext() ? DriveApp.getFoldersByName("BMS_Backups").next() : DriveApp.createFolder("BMS_Backups");
    const source = SpreadsheetApp.getActiveSpreadsheet();
    const backupName = `Backup_BMS_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm")}`;
    DriveApp.getFileById(source.getId()).makeCopy(backupName, folder);

    // Cleanup old backups (>30 days)
    const files = folder.getFiles();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    while (files.hasNext()) { const f = files.next(); if (f.getDateCreated() < cutoff) f.setTrashed(true); }
  } catch (e) { console.error("Backup Error: " + e); }
}

function Run_All_System_Tests() {
  console.log("🚀 --- เริ่มต้นการทดสอบระบบ BMS (System Test) ---");

  // 1. Connection
  try { const db = getDb(); console.log(db.bookingsSheet ? "✅ Google Sheets: OK" : "❌ Google Sheets: Missing"); } catch (e) { console.error("❌ DB Error"); }

  // 2. Log
  const testMsg = "Auto_Test_" + Date.now();
  logAction("TEST_BOT", "System Test", testMsg);
  const lastLog = getDb().logsSheet.getRange(getDb().logsSheet.getLastRow(), 4).getValue();
  console.log(lastLog === testMsg ? "✅ Log System: OK" : "❌ Log System: Failed");

  // 3. Booking Cycle
  const dummy = { userId: 'U_TEST', hotelName: 'Test Hotel', checkIn: '2026-12-30', checkOut: '2026-12-31', price: 500, role: 'Admin', actorId: 'TEST_ADMIN' };
  createBooking(dummy);
  const bId = getDb().bookingsSheet.getRange(getDb().bookingsSheet.getLastRow(), 1).getValue();
  console.log(bId.startsWith('BK-') ? "✅ Create Booking: OK" : "❌ Create Booking: Failed");

  updateBookingDetails(bId, 'Cancelled', 500, false, 'TEST_ADMIN', 'Test Hotel', 'Auto Test');
  const status = getDb().bookingsSheet.getRange(getDb().bookingsSheet.getLastRow(), 6).getValue();
  console.log(status === 'Cancelled' ? "✅ Update Booking: OK" : "❌ Update Booking: Failed");

  deleteBooking(bId, 'TEST_ADMIN');
  const checkId = getDb().bookingsSheet.getRange(getDb().bookingsSheet.getLastRow(), 1).getValue();
  console.log(checkId !== bId ? "✅ Delete Booking: OK" : "❌ Delete Booking: Failed");

  console.log("🏁 --- จบการทดสอบทั้งหมด ---");
}

// ฟังก์ชันลบประวัติเก่าทิ้งอัตโนมัติ (ป้องกันชีตบวม)
function autoCleanupLogs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Logs");
  if (!sheet) return;
  
  const maxAllowedRows = 1000; // เก็บไว้แค่ 1,000 รายการล่าสุด
  const lastRow = sheet.getLastRow();
  
  // ถ้ามีข้อมูลเกิน 1,000 บรรทัด ให้ลบแถวเก่าด้านบนทิ้ง
  if (lastRow > maxAllowedRows + 1) { 
    const rowsToDelete = lastRow - maxAllowedRows;
    // ลบตั้งแต่บรรทัดที่ 2 (เว้น Header) เป็นจำนวน rowsToDelete แถว
    sheet.deleteRows(2, rowsToDelete); 
  }
}

// =====================================================================================
// HELPER: ตรวจสอบการจองซ้อน (Double Booking)
// =====================================================================================
function _checkOverlap(db, userId, checkInStr, checkOutStr) {
  try {
    const data = db.bookingsSheet.getDataRange().getValues();
    const inDate = new Date(checkInStr);
    inDate.setHours(0, 0, 0, 0);
    const outDate = new Date(checkOutStr);
    outDate.setHours(0, 0, 0, 0);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      // ข้ามรายการที่ยกเลิกไปแล้ว
      const status = row[5];
      if (status === 'Cancelled' || status === 'Hotel Cancelled' || status === 'Rejected') continue;

      // ตรวจสอบเฉพาะของ User คนเดียวกัน
      if (String(row[1]) === String(userId)) {
        const existIn = new Date(row[3]);
        existIn.setHours(0, 0, 0, 0);
        const existOut = new Date(row[4]);
        existOut.setHours(0, 0, 0, 0);
        
        // เช็คว่าวันซ้อนทับกันหรือไม่ (ถ้าวันเข้าพักใหม่อยู่ก่อนวันออกเก่า และ วันออกใหม่อยู่หลังวันเข้าเก่า = ซ้อนทับ)
        if (inDate.getTime() < existOut.getTime() && outDate.getTime() > existIn.getTime()) {
          return { found: true, hotel: row[2] };
        }
      }
    }
    return { found: false };
  } catch (e) {
    return { found: false };
  }
}

// =====================================================================================
// 14. FIREBASE SYNCHRONIZATION (MOCK / PLACEHOLDER)
// =====================================================================================
// เนื่องจากใน createBooking และ updateBookingDetails มีการเรียกใช้ฟังก์ชันเหล่านี้
// ถ้าไม่มีฟังก์ชันพวกนี้อยู่ Script จะพังและหยุดทำงานก่อนที่จะส่ง Discord ครับ

function updateBookingToFirebase(data) {
  // ฟังก์ชันเผื่อไว้สำหรับการเชื่อมต่อ Firebase ในอนาคต
  // ปัจจุบันปล่อยว่างไว้เพื่อให้ Script ทำงานผ่านไปได้โดยไม่ Error
  return true;
}

function deleteBookingFromFirebase(id) {
  return true;
}

function forceAuthPrompt() {
  try {
    // โค้ดชุดนี้ไม่มีผลกับระบบจริง แต่เขียนเพื่อบังคับให้ Google ต้องขอสิทธิ์ทั้งหมดใหม่
    DriveApp.getRootFolder(); 
    SpreadsheetApp.getActive(); 
    DocumentApp.create("Temp_BMS_Auth").setTrashed(true);
    MailApp.getRemainingDailyQuota();
    Logger.log("✅ ขอสิทธิ์ Google ครบทุกบริการสำเร็จแล้ว!");
  } catch (e) {
    Logger.log("❌ รอการอนุญาตสิทธิ์...");
  }
}