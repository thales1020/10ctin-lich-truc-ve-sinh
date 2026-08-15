/**
 * Backend cho web đăng ký lịch trực vệ sinh — Lớp 10 CTin, THPT Thoại Ngọc Hầu.
 * Deploy dưới dạng Web App (xem README.md ở gốc repo để biết các bước thủ công).
 */

// ==== CẤU HÌNH — điền các giá trị này sau khi tạo Sheet + Drive folder ====
var SHEET_ID = '12z181dHJEYHHJLNaw1VCIQ3-tIHc_JrkDSxL6F-JGE4';
var FOLDER_ID = '1OFhMvtyhVrQ2IMi4SBwvIL-30penYTUv';
var SHEET_NAME = 'Schedule';
var NUM_TO = 5; // số tổ trong lớp
var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
var DAY_LABELS = { Mon: 'Thứ 2', Tue: 'Thứ 3', Wed: 'Thứ 4', Thu: 'Thứ 5', Fri: 'Thứ 6' };

// Cột: WeekStart | Status | Mon_To | Mon_PhotoUrl | Mon_UploadedAt | Tue_To | ... | Fri_UploadedAt
var HEADER = ['WeekStart', 'Status'];
DAYS.forEach(function (d) {
  HEADER.push(d + '_To', d + '_PhotoUrl', d + '_UploadedAt');
});

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
  }
  return sheet;
}

function colIndex_(name) {
  return HEADER.indexOf(name) + 1; // 1-based
}

// Trả về Date là 0h Thứ 2 của tuần chứa `date`.
function mondayOf_(date) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var day = d.getDay(); // 0 = CN, 1 = T2, ...
  var diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function fmtDate_(date) {
  return Utilities.formatDate(date, 'GMT+7', 'yyyy-MM-dd');
}

function findRowByWeek_(sheet, weekStr) {
  var data = sheet.getDataRange().getValues();
  var wsCol = colIndex_('WeekStart') - 1;
  for (var i = 1; i < data.length; i++) {
    var cell = data[i][wsCol];
    var cellStr = cell instanceof Date ? fmtDate_(cell) : String(cell);
    if (cellStr === weekStr) return i + 1; // 1-based row number
  }
  return -1;
}

// Đảm bảo có hàng cho tuần weekStr, tạo mới với Status=open nếu chưa có.
function ensureWeekRow_(sheet, weekStr) {
  var row = findRowByWeek_(sheet, weekStr);
  if (row !== -1) return row;
  var newRow = new Array(HEADER.length).fill('');
  newRow[colIndex_('WeekStart') - 1] = weekStr;
  newRow[colIndex_('Status') - 1] = 'open';
  sheet.appendRow(newRow);
  return sheet.getLastRow();
}

function rowToWeekObject_(sheet, row) {
  var values = sheet.getRange(row, 1, 1, HEADER.length).getValues()[0];
  var obj = { row: row, weekStart: '', status: 'open', days: {} };
  HEADER.forEach(function (h, i) {
    if (h === 'WeekStart') {
      var v = values[i];
      obj.weekStart = v instanceof Date ? fmtDate_(v) : String(v);
    } else if (h === 'Status') {
      obj.status = values[i] || 'open';
    }
  });
  DAYS.forEach(function (d) {
    obj.days[d] = {
      label: DAY_LABELS[d],
      to: values[colIndex_(d + '_To') - 1] || null,
      photoUrl: values[colIndex_(d + '_PhotoUrl') - 1] || null,
      uploadedAt: values[colIndex_(d + '_UploadedAt') - 1] || null
    };
  });
  return obj;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET ?action=schedule&weeks=2026-08-10,2026-08-17
 * Không truyền `weeks` -> trả về tuần hiện tại + tuần kế tiếp.
 */
function doGet(e) {
  try {
    var sheet = getSheet_();
    var params = e && e.parameter ? e.parameter : {};
    var weekStrs;
    if (params.weeks) {
      weekStrs = params.weeks.split(',');
    } else {
      var today = new Date();
      var thisMonday = mondayOf_(today);
      var nextMonday = new Date(thisMonday);
      nextMonday.setDate(nextMonday.getDate() + 7);
      weekStrs = [fmtDate_(thisMonday), fmtDate_(nextMonday)];
    }
    var weeks = weekStrs.map(function (ws) {
      var row = ensureWeekRow_(sheet, ws);
      return rowToWeekObject_(sheet, row);
    });
    return jsonResponse_({ ok: true, weeks: weeks, numTo: NUM_TO, days: DAYS });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/**
 * POST body (text/plain, JSON-encoded) — { action, week, day, to, imageBase64, filename }
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = getSheet_();
    var result;
    switch (body.action) {
      case 'register':
        result = registerSlot_(sheet, body);
        break;
      case 'unregister':
        result = unregisterSlot_(sheet, body);
        break;
      case 'uploadPhoto':
        result = uploadPhoto_(sheet, body);
        break;
      default:
        result = { ok: false, error: 'Unknown action' };
    }
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function validateDayTo_(day, to) {
  if (DAYS.indexOf(day) === -1) return 'Ngày không hợp lệ';
  var toNum = Number(to);
  if (!toNum || toNum < 1 || toNum > NUM_TO) return 'Tổ không hợp lệ';
  return null;
}

function registerSlot_(sheet, body) {
  var err = validateDayTo_(body.day, body.to);
  if (err) return { ok: false, error: err };
  var row = ensureWeekRow_(sheet, body.week);
  var week = rowToWeekObject_(sheet, row);
  if (week.status !== 'open') return { ok: false, error: 'Tuần này đã đóng đăng ký' };
  if (week.days[body.day].to) return { ok: false, error: 'Ngày này đã có tổ đăng ký' };
  var toNum = Number(body.to);
  var alreadyHasDay = DAYS.some(function (d) { return Number(week.days[d].to) === toNum; });
  if (alreadyHasDay) return { ok: false, error: 'Tổ này đã đăng ký 1 ngày khác trong tuần rồi' };
  sheet.getRange(row, colIndex_(body.day + '_To')).setValue(toNum);
  return { ok: true, week: rowToWeekObject_(sheet, row) };
}

function unregisterSlot_(sheet, body) {
  var err = validateDayTo_(body.day, body.to || 1);
  if (err && body.day && DAYS.indexOf(body.day) === -1) return { ok: false, error: err };
  var row = findRowByWeek_(sheet, body.week);
  if (row === -1) return { ok: false, error: 'Không tìm thấy tuần' };
  var week = rowToWeekObject_(sheet, row);
  if (week.status !== 'open') return { ok: false, error: 'Tuần này đã đóng, không thể hủy' };
  sheet.getRange(row, colIndex_(body.day + '_To')).setValue('');
  return { ok: true, week: rowToWeekObject_(sheet, row) };
}

function uploadPhoto_(sheet, body) {
  var err = validateDayTo_(body.day, body.to);
  if (err) return { ok: false, error: err };
  var row = findRowByWeek_(sheet, body.week);
  if (row === -1) return { ok: false, error: 'Không tìm thấy tuần' };
  var week = rowToWeekObject_(sheet, row);
  var registeredTo = Number(week.days[body.day].to);
  if (!registeredTo) return { ok: false, error: 'Ngày này chưa có tổ đăng ký' };
  if (registeredTo !== Number(body.to)) return { ok: false, error: 'Tổ đăng ký ngày này không khớp' };

  var folder = DriveApp.getFolderById(FOLDER_ID);
  var base64 = body.imageBase64.split(',').pop(); // bỏ tiền tố data:image/...;base64,
  var mimeType = (body.imageBase64.match(/^data:(.*?);base64,/) || [])[1] || 'image/jpeg';
  var ext = mimeType.indexOf('png') !== -1 ? 'png' : 'jpg';
  var filename = week.weekStart + '_' + body.day + '_To' + body.to + '.' + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var photoUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();

  sheet.getRange(row, colIndex_(body.day + '_PhotoUrl')).setValue(photoUrl);
  sheet.getRange(row, colIndex_(body.day + '_UploadedAt')).setValue(new Date());
  return { ok: true, week: rowToWeekObject_(sheet, row) };
}

/**
 * Chạy bởi time-driven trigger (đặt Thứ Hai, 0:00–1:00).
 * Với mọi tuần "open" mà WeekStart <= hôm nay: random gán tổ còn thiếu vào ngày còn trống,
 * khóa tuần đó (Status=locked), rồi đảm bảo tuần kế tiếp được mở.
 */
function assignRandomSlots() {
  var sheet = getSheet_();
  var today = mondayOf_(new Date());
  var lastRow = sheet.getLastRow();
  for (var row = 2; row <= lastRow; row++) {
    var week = rowToWeekObject_(sheet, row);
    if (week.status !== 'open') continue;
    var weekMonday = new Date(week.weekStart + 'T00:00:00');
    if (weekMonday > today) continue; // tuần này vẫn còn ở tương lai, chưa tới hạn

    var usedTo = {};
    var emptyDays = [];
    DAYS.forEach(function (d) {
      if (week.days[d].to) {
        usedTo[Number(week.days[d].to)] = true;
      } else {
        emptyDays.push(d);
      }
    });
    var freeTo = [];
    for (var t = 1; t <= NUM_TO; t++) {
      if (!usedTo[t]) freeTo.push(t);
    }
    shuffle_(freeTo);
    emptyDays.forEach(function (d, i) {
      if (i < freeTo.length) {
        sheet.getRange(row, colIndex_(d + '_To')).setValue(freeTo[i]);
      }
    });
    sheet.getRange(row, colIndex_('Status')).setValue('locked');
  }

  // Đảm bảo tuần kế tiếp sau tuần hiện tại luôn có mặt và đang mở.
  var nextMonday = new Date(today);
  nextMonday.setDate(nextMonday.getDate() + 7);
  ensureWeekRow_(sheet, fmtDate_(nextMonday));
}

function shuffle_(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
