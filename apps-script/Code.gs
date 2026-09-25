const APP_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1sutuKsvCeJD3yJUkUcET-wml8aGUR2IjTGLJdD4DZAo',
  TEMPLATE_SPREADSHEET_ID: '1RCm1GNWnNzfFgZmm-DYIAjNJS56pr-jAv3_i7yb3REc',
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
    if (payload.action === 'provisionClassSpreadsheet') return json_(provisionClassSpreadsheet_(payload.class));
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

    appendUnique_(spreadsheet.getSheetByName(APP_CONFIG.SHEETS.CLASSES), 1, batch.class.code, [batch.class.code, batch.class.name || '', batch.class.course || '', new Date()]);
    appendUnique_(spreadsheet.getSheetByName(APP_CONFIG.SHEETS.LESSONS), 1, batch.lesson.id, [batch.lesson.id, batch.class.code, asDate_(batch.lesson.date), batch.lesson.startTime || '', batch.lesson.endTime || '', batch.lesson.status || '', batch.teacher?.name || '', batch.teacher?.email || '', new Date()]);
    const studentRows = batch.records.map((record) => [record.studentId, record.studentName, new Date()]);
    const attendanceRows = batch.records.map((record) => [batch.batchId, batch.lesson.id, batch.class.code, asDate_(batch.lesson.date), record.studentId, record.studentName, record.status, record.observation || '', record.recordedAt ? new Date(record.recordedAt) : new Date()]);
    appendUniqueRows_(spreadsheet.getSheetByName(APP_CONFIG.SHEETS.STUDENTS), 1, studentRows);
    const attendanceSheet = spreadsheet.getSheetByName(APP_CONFIG.SHEETS.ATTENDANCE);
    if (attendanceRows.length) attendanceSheet.getRange(attendanceSheet.getLastRow() + 1, 1, attendanceRows.length, attendanceRows[0].length).setValues(attendanceRows);
    control.appendRow([batch.batchId, 'SYNCED', new Date(), `Registros: ${batch.records.length}`]);
    if (batch.class.spreadsheetId) syncClassMatrix_(batch);
  } finally {
    lock.releaseLock();
  }
}

function provisionClassSpreadsheet_(classInfo) {
  if (!classInfo?.id || !classInfo.code || !classInfo.name) throw new Error('Dados da turma inválidos.');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const template = DriveApp.getFileById(APP_CONFIG.TEMPLATE_SPREADSHEET_ID);
    const fileName = `Presença — ${classInfo.code} — ${classInfo.name}`;
    const existing = DriveApp.getFilesByName(fileName);
    if (existing.hasNext()) {
      const file = existing.next();
      return { ok: true, spreadsheetId: file.getId(), spreadsheetUrl: file.getUrl(), message: 'Planilha já existente.' };
    }
    const copy = template.makeCopy(fileName);
    const spreadsheet = SpreadsheetApp.openById(copy.getId());
    spreadsheet.setSpreadsheetLocale('pt_BR');
    spreadsheet.setSpreadsheetTimeZone('America/Sao_Paulo');
    const page = spreadsheet.getSheets()[0];
    page.setName('Página1');
    page.getRange('C4').setValue(classInfo.course || '');
    page.getRange('C6').setValue(classInfo.teacherName || '');
    page.getRange('C7').setValue('Gerenciada pelo Plug Presença');
    page.getRange('C8').setValue(`${weekdayName_(classInfo.dayOfWeek)}${classInfo.startTime ? ` — ${classInfo.startTime}` : ''}${classInfo.endTime ? ` às ${classInfo.endTime}` : ''}`);
    page.getRange('C9').setValue(classInfo.code);
    page.getRange('A11:AR65').clearContent();
    page.getRange('AS11:AS65').clearContent();
    const statusFormulas = [];
    for (let row = 11; row <= 65; row += 1) statusFormulas.push([`=IF(C${row}="","",IF(COUNTIF(E${row}:AR${row},"P")=0,"Não impactado",IF(COUNTIF(E${row}:AR${row},"F")>=3,"Ausente","Presente")))`]);
    page.getRange(11, 45, statusFormulas.length, 1).setFormulas(statusFormulas);
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(['P', 'F', 'J', 'N/A'], true).setAllowInvalid(false).build();
    page.getRange('E11:AR65').setDataValidation(rule);
    page.setFrozenRows(10);
    page.hideColumns(45);
    const config = ensureSheet_(spreadsheet, 'Configuração', ['Campo', 'Valor']);
    config.clearContent();
    config.getRange(1, 1, 1, 2).setValues([['Campo', 'Valor']]);
    config.getRange(2, 1, 8, 2).setValues([
      ['classId', String(classInfo.id)], ['code', classInfo.code], ['name', classInfo.name], ['course', classInfo.course || ''],
      ['teacherName', classInfo.teacherName || ''], ['teacherEmail', classInfo.teacherEmail || ''], ['createdAt', new Date()], ['template', APP_CONFIG.TEMPLATE_SPREADSHEET_ID],
    ]);
    config.hideSheet();
    ensureSheet_(spreadsheet, 'Alunos', ['ID do aluno', 'Nome', 'Linha', 'Ativo', 'Atualizado em']).hideSheet();
    ensureSheet_(spreadsheet, 'Controle_Sincronização', ['Lote', 'Status', 'Processado em', 'Mensagem']).hideSheet();
    return { ok: true, spreadsheetId: copy.getId(), spreadsheetUrl: copy.getUrl(), message: 'Planilha individual criada.' };
  } finally {
    lock.releaseLock();
  }
}

function syncClassMatrix_(batch) {
  const spreadsheet = SpreadsheetApp.openById(batch.class.spreadsheetId);
  const page = spreadsheet.getSheetByName('Página1') || spreadsheet.getSheets()[0];
  const students = ensureSheet_(spreadsheet, 'Alunos', ['ID do aluno', 'Nome', 'Linha', 'Ativo', 'Atualizado em']);
  const control = ensureSheet_(spreadsheet, 'Controle_Sincronização', ['Lote', 'Status', 'Processado em', 'Mensagem']);
  const studentRows = students.getLastRow() > 1 ? students.getRange(2, 1, students.getLastRow() - 1, 5).getValues() : [];
  const rowById = new Map(studentRows.map((row) => [String(row[0]), Number(row[2])]));
  batch.records.forEach((record) => {
    let row = rowById.get(String(record.studentId));
    if (!row) {
      row = firstEmptyStudentRow_(page);
      page.getRange(row, 1, 1, 3).setValues([[row - 10, '', record.studentName || '']]);
      students.appendRow([String(record.studentId), record.studentName || '', row, true, new Date()]);
      rowById.set(String(record.studentId), row);
    }
    const column = findOrCreateLessonColumn_(page, batch.lesson.date);
    const value = record.status === 'PRESENT' ? 'P' : record.status === 'ABSENT' ? 'F' : record.status === 'EXCUSED' ? 'J' : 'N/A';
    page.getRange(row, column).setValue(value);
  });
  control.appendRow([batch.batchId, 'SYNCED', new Date(), `Matriz atualizada: ${batch.records.length} registros`]);
}

function firstEmptyStudentRow_(page) {
  for (let row = 11; row <= 65; row += 1) if (!page.getRange(row, 3).getValue()) return row;
  throw new Error('A planilha atingiu o limite visual de 55 alunos; amplie o modelo antes de cadastrar mais alunos.');
}

function findOrCreateLessonColumn_(page, dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  for (let column = 5; column <= 44; column += 1) if (Number(page.getRange(8, column).getValue()) === day && Number(page.getRange(9, column).getValue()) === month) return column;
  for (let column = 5; column <= 44; column += 1) {
    if (!page.getRange(8, column).getValue() && !page.getRange(9, column).getValue()) {
      page.getRange(8, column).setValue(day);
      page.getRange(9, column).setValue(month);
      page.getRange(10, column).setValue(Math.max(1, column - 4));
      return column;
    }
  }
  throw new Error('A planilha atingiu o limite de 40 datas visuais.');
}

function weekdayName_(dayOfWeek) {
  return ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'][Number(dayOfWeek)] || 'DIA';
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
  return value ? new Date(`${value}T12:00:00`) : '';
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
