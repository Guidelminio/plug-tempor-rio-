const APP_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1sutuKsvCeJD3yJUkUcET-wml8aGUR2IjTGLJdD4DZAo',
  SHEETS: {
    CLASSES: 'Turmas',
    STUDENTS: 'Alunos',
    LESSONS: 'Aulas',
    ATTENDANCE: 'Presenças',
    CONTROL: 'Controle_Sincronização',
  },
  SECRET_PROPERTY: 'PLUG_PRESENCA_SYNC_SECRET',
});

function doPost(e) {
  try {
    const envelope = JSON.parse(e.postData?.contents || '{}');
    if (!envelope.payload || !envelope.signature) throw new Error('Requisição incompleta.');
    const expected = Utilities.base64Encode(Utilities.computeHmacSha256Signature(canonicalPayload_(envelope.payload), getSecret_()));
    if (!safeEqual_(expected, envelope.signature)) throw new Error('Assinatura inválida.');

    const payload = envelope.payload;
    if (payload.action === 'syncAttendance') {
      syncAttendance_(payload.batch);
      return json_({ ok: true, message: 'Lote sincronizado.' });
    }
    if (payload.action === 'sendNotification') {
      sendNotification_(payload.notification);
      return json_({ ok: true, message: 'Mensagem enviada.' });
    }
    throw new Error('Ação não reconhecida.');
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function setupSheets() {
  const spreadsheet = SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);
  ensureSheet_(spreadsheet, APP_CONFIG.SHEETS.CLASSES, ['Código', 'Turma', 'Curso', 'Atualizado em']);
  ensureSheet_(spreadsheet, APP_CONFIG.SHEETS.STUDENTS, ['ID do aluno', 'Nome', 'Atualizado em']);
  ensureSheet_(spreadsheet, APP_CONFIG.SHEETS.LESSONS, ['ID da aula', 'Código da turma', 'Data', 'Início', 'Fim', 'Status', 'Professor', 'E-mail do professor', 'Atualizado em']);
  ensureSheet_(spreadsheet, APP_CONFIG.SHEETS.ATTENDANCE, ['Lote', 'ID da aula', 'Código da turma', 'Data', 'ID do aluno', 'Aluno', 'Situação', 'Observação', 'Registrado em']);
  ensureSheet_(spreadsheet, APP_CONFIG.SHEETS.CONTROL, ['Lote', 'Status', 'Processado em', 'Mensagem']);
}

function syncAttendance_(batch) {
  if (!batch?.batchId || !batch?.class || !batch?.lesson || !Array.isArray(batch.records)) throw new Error('Lote de presença inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    setupSheets();
    const spreadsheet = SpreadsheetApp.openById(APP_CONFIG.SPREADSHEET_ID);
    const control = spreadsheet.getSheetByName(APP_CONFIG.SHEETS.CONTROL);
    if (hasBatch_(control, batch.batchId)) return;

    const classSheet = spreadsheet.getSheetByName(APP_CONFIG.SHEETS.CLASSES);
    appendUnique_(classSheet, 1, batch.class.code, [batch.class.code, batch.class.name || '', batch.class.course || '', new Date()]);

    const lessonSheet = spreadsheet.getSheetByName(APP_CONFIG.SHEETS.LESSONS);
    appendUnique_(lessonSheet, 1, batch.lesson.id, [batch.lesson.id, batch.class.code, asDate_(batch.lesson.date), batch.lesson.startTime || '', batch.lesson.endTime || '', batch.lesson.status || '', batch.teacher?.name || '', batch.teacher?.email || '', new Date()]);

    const studentSheet = spreadsheet.getSheetByName(APP_CONFIG.SHEETS.STUDENTS);
    const attendanceSheet = spreadsheet.getSheetByName(APP_CONFIG.SHEETS.ATTENDANCE);
    const studentRows = batch.records.map((record) => [record.studentId, record.studentName, new Date()]);
    const attendanceRows = batch.records.map((record) => [batch.batchId, batch.lesson.id, batch.class.code, asDate_(batch.lesson.date), record.studentId, record.studentName, record.status, record.observation || '', record.recordedAt ? new Date(record.recordedAt) : new Date()]);
    appendUniqueRows_(studentSheet, 1, studentRows);
    if (attendanceRows.length) attendanceSheet.getRange(attendanceSheet.getLastRow() + 1, 1, attendanceRows.length, attendanceRows[0].length).setValues(attendanceRows);
    control.appendRow([batch.batchId, 'SYNCED', new Date(), `Registros: ${batch.records.length}`]);
  } finally {
    lock.releaseLock();
  }
}

function sendNotification_(notification) {
  if (!notification?.to || !notification?.subject || !notification?.body) throw new Error('Mensagem de e-mail inválida.');
  MailApp.sendEmail({ to: notification.to, subject: notification.subject, htmlBody: notification.body, body: notification.body.replace(/<[^>]*>/g, ' ') });
}

function getSecret_() {
  const value = PropertiesService.getScriptProperties().getProperty(APP_CONFIG.SECRET_PROPERTY);
  if (!value) throw new Error('Defina a propriedade PLUG_PRESENCA_SYNC_SECRET antes de publicar.');
  return value;
}

function canonicalPayload_(payload) {
  return Utilities.base64Encode(JSON.stringify(payload), Utilities.Charset.UTF_8);
}

function hasBatch_(sheet, batchId) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  return sheet.getRange(2, 1, last - 1, 1).getValues().flat().includes(batchId);
}

function appendUnique_(sheet, keyColumn, key, row) {
  const last = sheet.getLastRow();
  if (last > 1 && sheet.getRange(2, keyColumn, last - 1, 1).getValues().flat().includes(key)) return;
  sheet.appendRow(row);
}

function appendUniqueRows_(sheet, keyColumn, rows) {
  if (!rows.length) return;
  const last = sheet.getLastRow();
  const keys = new Set(last > 1 ? sheet.getRange(2, keyColumn, last - 1, 1).getValues().flat() : []);
  const pending = rows.filter((row) => !keys.has(row[keyColumn - 1]));
  if (pending.length) sheet.getRange(sheet.getLastRow() + 1, 1, pending.length, pending[0].length).setValues(pending);
}

function ensureSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  return sheet;
}

function asDate_(value) {
  return value ? new Date(value) : '';
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
