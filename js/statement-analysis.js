(function () {
  const $ = (id) => document.getElementById(id);

  let sourceRows = [];
  let sourceSheets = [];
  let headers = [];
  let rawRows = [];
  let cleanedTransactions = [];
  let importInfo = null;
  let lastSummary = null;

  const keywordRules = {
    cash: ['cash', 'atm', 'withdraw', 'withdrawal', 'ຖອນ', 'ຖອນເງິນ'],
    loan: ['loan', 'repay', 'repayment', 'installment', 'finance', 'interest', 'bnpl', 'ຜ່ອນ', 'ຊຳລະ', 'ກູ້', 'ດອກເບ້ຍ', 'ຄ່າງວດ'],
    salary: ['salary', 'payroll', 'wage', 'ເງິນເດືອນ', 'ເງິນເດືອນເຂົ້າ'],
    transfer: ['transfer', 'trf', 'a/c to a/c', 'ໂອນ', 'ໂອນເງິນ'],
    bill: ['bill', 'utility', 'electric', 'water', 'internet', 'ໄຟຟ້າ', 'ນ້ຳປະປາ', 'ອິນເຕີເນັດ']
  };

  function money(value) {
    return Number(value || 0).toLocaleString('en-US') + ' LAK';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function setMessage(text, type = '') {
    const el = $('statementMessage');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'message ' + type;
  }

  function parseAmount(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.abs(value) : 0;
    let text = String(value).trim();
    if (!text || text === '-' || text === '—') return 0;
    const isNegative = /^\(.*\)$/.test(text) || text.startsWith('-');
    text = text.replace(/[(),\s]/g, '').replace(/[^\d.-]/g, '');
    const num = Number(text);
    if (!Number.isFinite(num)) return 0;
    return isNegative ? Math.abs(num) : Math.abs(num);
  }

  function isAmountLike(value) {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) > 0;
    const text = String(value).trim();
    if (!text || text.length > 25) return false;
    return /^[-(]?\s*[\d,]+(\.\d+)?\s*\)?$/.test(text);
  }

  function normalizeDate(value) {
    if (!value) return '';
    if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);
    if (typeof value === 'number' && typeof XLSX !== 'undefined') {
      try {
        const d = XLSX.SSF.parse_date_code(value);
        if (d && d.y > 1990 && d.y < 2100) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } catch (e) {}
    }
    const text = String(value).trim();
    const m0 = text.match(/(\d{1,2})[-\s\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s\/](\d{2,4})/i);
    if (m0) {
      const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
      const y = m0[3].length === 2 ? '20' + m0[3] : m0[3];
      return `${y}-${months[m0[2].slice(0,3).toLowerCase()]}-${String(m0[1]).padStart(2, '0')}`;
    }
    const m1 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m1) {
      let y = m1[3].length === 2 ? '20' + m1[3] : m1[3];
      return `${y}-${String(m1[2]).padStart(2, '0')}-${String(m1[1]).padStart(2, '0')}`;
    }
    const m2 = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m2) return `${m2[1]}-${String(m2[2]).padStart(2, '0')}-${String(m2[3]).padStart(2, '0')}`;
    return '';
  }

  function isDateLike(value) {
    return !!normalizeDate(value);
  }

  function monthKey(dateText) {
    const d = normalizeDate(dateText);
    const m = d.match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : 'unknown';
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (c === '"' && inQuotes && next === '"') { cell += '"'; i++; continue; }
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (c === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
      if ((c === '\n' || c === '\r') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        row.push(cell);
        if (row.some(x => String(x).trim() !== '')) rows.push(row);
        row = []; cell = '';
        continue;
      }
      cell += c;
    }
    row.push(cell);
    if (row.some(x => String(x).trim() !== '')) rows.push(row);
    return rows;
  }

  function makeUniqueHeaders(row) {
    const seen = {};
    return row.map((h, i) => {
      let base = String(h || `Column ${i + 1}`).trim() || `Column ${i + 1}`;
      if (seen[base] !== undefined) {
        seen[base] += 1;
        base = `${base} (${seen[base]})`;
      } else {
        seen[base] = 0;
      }
      return base;
    });
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    headers = makeUniqueHeaders(rows[0]);
    return rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] ?? '');
      return obj;
    }).filter(obj => Object.values(obj).some(v => String(v).trim() !== ''));
  }

  function scoreHeaderRow(row) {
    const text = (row || []).join(' ').toLowerCase();
    let score = 0;
    ['date', 'ວັນ', 'transaction', 'txn', 'posting'].forEach(k => { if (text.includes(k)) score += 2; });
    ['description', 'detail', 'narration', 'remark', 'ລາຍ', 'ໝາຍ'].forEach(k => { if (text.includes(k)) score += 2; });
    ['debit', 'withdraw', 'money out', 'dr', 'ອອກ', 'ຖອນ'].forEach(k => { if (text.includes(k)) score += 2; });
    ['credit', 'deposit', 'money in', 'cr', 'ເຂົ້າ', 'ຝາກ'].forEach(k => { if (text.includes(k)) score += 2; });
    ['balance', 'bal', 'ຄົງເຫຼືອ', 'ຍອດ'].forEach(k => { if (text.includes(k)) score += 2; });
    return score;
  }

  function detectHeaderRow(rows) {
    let best = 0, bestScore = -1;
    rows.slice(0, 100).forEach((row, idx) => {
      const score = scoreHeaderRow(row);
      if (score > bestScore) { bestScore = score; best = idx; }
    });
    return bestScore >= 4 ? best : -1;
  }

  function guessHeader(patterns) {
    const lower = headers.map(h => h.toLowerCase());
    for (const p of patterns) {
      const idx = lower.findIndex(h => h.includes(p));
      if (idx >= 0) return headers[idx];
    }
    return '';
  }

  function fillSelect(id, selected = '') {
    const select = $(id);
    if (!select) return;
    select.innerHTML = '<option value="">-- ເລືອກ column --</option>' + headers.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');
    select.value = selected || '';
  }

  function setupMapping() {
    fillSelect('mapDate', guessHeader(['date', 'ວັນ', 'txn', 'posting']));
    fillSelect('mapDescription', guessHeader(['description', 'detail', 'narration', 'remark', 'ລາຍ', 'ໝາຍ']));
    fillSelect('mapDebit', guessHeader(['debit', 'withdraw', 'money out', 'outflow', 'dr', 'ອອກ', 'ຖອນ']));
    fillSelect('mapCredit', guessHeader(['credit', 'deposit', 'money in', 'inflow', 'cr', 'ເຂົ້າ', 'ຝາກ']));
    fillSelect('mapBalance', guessHeader(['balance', 'bal', 'ຄົງເຫຼືອ', 'ຍອດ']));
  }

  function rowLabel(row, index) {
    const preview = (row || []).map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 5).join(' | ');
    return `Row ${index + 1}: ${preview || '(blank)'}`;
  }

  function fillHeaderRowSelect(rows, selectedIndex = 0) {
    const select = $('headerRowSelect');
    if (!select) return;
    select.innerHTML = rows.slice(0, 100).map((row, idx) => `<option value="${idx}">${escapeHtml(rowLabel(row, idx))}</option>`).join('');
    select.value = String(Math.max(0, selectedIndex));
    updateHeaderHelp(select.value);
  }

  function updateHeaderHelp(index) {
    const el = $('headerHelpText');
    if (!el) return;
    const row = sourceRows[Number(index)] || [];
    el.textContent = 'ແຖວທີ່ເລືອກ: ' + row.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 8).join(' | ');
  }

  function applyHeaderRow(index) {
    const rows = sourceRows.slice(Number(index));
    rawRows = rowsToObjects(rows);
    if (!rawRows.length || !headers.length) throw new Error('Header row ທີ່ເລືອກບໍ່ຖືກ ຫຼືບໍ່ມີ transaction ຕໍ່ຈາກນັ້ນ');
    setupMapping();
    renderRawPreview();
  }

  function normalizeManualTransactions() {
    const mapping = {
      date: $('mapDate')?.value,
      description: $('mapDescription')?.value,
      debit: $('mapDebit')?.value,
      credit: $('mapCredit')?.value,
      balance: $('mapBalance')?.value
    };
    if (!mapping.date || !mapping.description || !mapping.debit || !mapping.credit) {
      throw new Error('ກະລຸນາເລືອກ Date, Description, Debit ແລະ Credit column ໃຫ້ຄົບ');
    }
    const selectedCore = [mapping.date, mapping.description, mapping.debit, mapping.credit].filter(Boolean);
    if (new Set(selectedCore).size < selectedCore.length) {
      throw new Error('Column mapping ຍັງຜິດ: Date/Description/Debit/Credit ບໍ່ຄວນເປັນ column ດຽວກັນ.');
    }

    return rawRows.map(row => {
      const debit = parseAmount(row[mapping.debit]);
      const credit = parseAmount(row[mapping.credit]);
      const description = row[mapping.description] || '';
      return makeTx({
        date: row[mapping.date],
        description,
        debit,
        credit,
        balance: mapping.balance ? parseAmount(row[mapping.balance]) : 0,
        source: 'manual',
        confidence: 90
      });
    }).filter(t => t.debit > 0 || t.credit > 0);
  }

  function makeTx({date, description, debit, credit, balance, source, confidence}) {
    const d = normalizeDate(date);
    const desc = String(description || '').trim();
    const deb = Number(debit || 0);
    const cre = Number(credit || 0);
    return {
      date: d,
      description: desc,
      debit: deb,
      credit: cre,
      balance: Number(balance || 0),
      month: monthKey(d),
      category: categorize(desc, deb, cre),
      source: source || '',
      confidence: confidence || 60
    };
  }

  function categorize(desc, debit, credit) {
    const text = String(desc || '').toLowerCase();
    if (keywordRules.cash.some(k => text.includes(k))) return 'Cash Withdrawal';
    if (keywordRules.loan.some(k => text.includes(k))) return 'Loan/Installment Payment';
    if (keywordRules.salary.some(k => text.includes(k))) return 'Salary/Payroll';
    if (keywordRules.bill.some(k => text.includes(k))) return 'Bill Payment';
    if (keywordRules.transfer.some(k => text.includes(k))) return credit > 0 ? 'Transfer In' : 'Transfer Out';
    return credit > 0 ? 'Other Inflow' : 'Other Outflow';
  }

  function detectCleanTable(rows) {
    const idx = detectHeaderRow(rows);
    if (idx < 0) return null;
    const tableRows = rows.slice(idx);
    const objects = rowsToObjects(tableRows);
    const h = headers.slice();
    const date = guessHeader(['date', 'ວັນ', 'txn', 'posting']);
    const desc = guessHeader(['description', 'detail', 'narration', 'remark', 'ລາຍ', 'ໝາຍ']);
    const debit = guessHeader(['debit', 'withdraw', 'money out', 'outflow', 'dr', 'ອອກ', 'ຖອນ']);
    const credit = guessHeader(['credit', 'deposit', 'money in', 'inflow', 'cr', 'ເຂົ້າ', 'ຝາກ']);
    const balance = guessHeader(['balance', 'bal', 'ຄົງເຫຼືອ', 'ຍອດ']);
    const ok = date && desc && debit && credit;
    if (!ok) {
      headers = h;
      return null;
    }
    const txs = objects.map(row => makeTx({
      date: row[date],
      description: row[desc],
      debit: parseAmount(row[debit]),
      credit: parseAmount(row[credit]),
      balance: balance ? parseAmount(row[balance]) : 0,
      source: 'clean-table',
      confidence: 95
    })).filter(t => (t.debit > 0 || t.credit > 0) && t.date);
    return txs.length >= 3 ? { txs, headerIndex: idx, confidence: 95 } : null;
  }

  function flattenAllSheets(sheets) {
    const flat = [];
    sheets.forEach(sheet => {
      sheet.rows.forEach((row, rowIndex) => {
        flat.push({ sheet: sheet.name, rowIndex, cells: row });
      });
    });
    return flat;
  }

  function findDateInCells(cells) {
    for (const cell of cells) {
      const d = normalizeDate(cell);
      if (d) return { raw: cell, date: d };
    }
    return null;
  }

  function buildDescription(cells) {
    return cells
      .filter(v => {
        const s = String(v ?? '').trim();
        if (!s) return false;
        if (isDateLike(v)) return false;
        if (isAmountLike(v)) return false;
        if (/account statement|customer id|customer name|opening balance|closing balance|total deposits|total withdrawals|address|product|currency/i.test(s)) return false;
        return s.length >= 2;
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanPdfConvertedExcel(sheets) {
    const flat = flattenAllSheets(sheets);
    const txs = [];
    let skippedMeta = 0;
    let dateRows = 0;

    for (const item of flat) {
      const cells = item.cells || [];
      const nonEmpty = cells.map(v => String(v ?? '').trim()).filter(Boolean);
      if (!nonEmpty.length) continue;
      const joined = nonEmpty.join(' ');
      if (/account statement|customer id|customer name|opening balance|closing balance|total deposits|total withdrawals|address|product|currency/i.test(joined)) {
        skippedMeta++;
        continue;
      }

      const dateInfo = findDateInCells(cells);
      if (!dateInfo) continue;
      dateRows++;

      const amounts = cells
        .map((v, idx) => ({ idx, raw: v, amount: parseAmount(v), isAmount: isAmountLike(v) }))
        .filter(x => x.isAmount && x.amount > 0);

      if (!amounts.length) continue;

      const desc = buildDescription(cells);
      if (!desc || desc.length < 2) continue;

      let debit = 0, credit = 0, balance = 0;
      const text = joined.toLowerCase();

      // Heuristic:
      // - If row has 3+ numbers, use last as balance, previous as amount.
      // - If keywords indicate deposit/credit/salary/qr pay incoming, treat amount as credit.
      // - If keywords indicate withdrawal/payment/transfer out/repayment, treat amount as debit.
      // - Otherwise use position: first amount as transaction amount, last as balance if multiple.
      let transactionAmount = amounts[0].amount;
      if (amounts.length >= 2) {
        balance = amounts[amounts.length - 1].amount;
        transactionAmount = amounts[amounts.length - 2].amount || amounts[0].amount;
      }

      const creditLike = /(credit|deposit|salary|payroll|received|qr pay|brown to black|inward|cr|ເຂົ້າ|ຝາກ)/i.test(text);
      const debitLike = /(debit|withdraw|payment|transfer|repay|bnpl|atm|charge|fee|dr|ອອກ|ຖອນ|ຊຳລະ|ຜ່ອນ)/i.test(text);

      if (creditLike && !debitLike) credit = transactionAmount;
      else if (debitLike && !creditLike) debit = transactionAmount;
      else if (creditLike && debitLike) {
        // QR Pay is often incoming merchant payment; BNPL/repay/payment are outgoing
        if (/(bnpl|repay|payment|fee|charge|withdraw|atm|ຊຳລະ|ຜ່ອນ|ຖອນ)/i.test(text)) debit = transactionAmount;
        else credit = transactionAmount;
      } else {
        // Unknown direction: do not force if no clue
        debit = transactionAmount;
      }

      let confidence = 60;
      if (dateInfo.date) confidence += 10;
      if (desc.length > 5) confidence += 10;
      if (amounts.length >= 2) confidence += 8;
      if (creditLike || debitLike) confidence += 10;
      confidence = Math.min(confidence, 92);

      txs.push(makeTx({
        date: dateInfo.date,
        description: desc,
        debit,
        credit,
        balance,
        source: `${item.sheet} Row ${item.rowIndex + 1}`,
        confidence
      }));
    }

    const avgConfidence = txs.length ? Math.round(txs.reduce((s, t) => s + t.confidence, 0) / txs.length) : 0;
    return { txs, avgConfidence, skippedMeta, dateRows };
  }

  function smartImport(rows, sheets) {
    const clean = detectCleanTable(rows);
    if (clean) {
      return {
        type: 'Clean Excel/CSV',
        confidence: clean.confidence,
        txs: clean.txs,
        status: 'green',
        message: `ພົບ clean transaction table ອັດຕະໂນມັດ: ${clean.txs.length} transactions`,
        detail: [`Header Row: ${clean.headerIndex + 1}`]
      };
    }

    const cleaned = cleanPdfConvertedExcel(sheets);
    if (cleaned.txs.length >= 10) {
      const status = cleaned.avgConfidence >= 85 ? 'green' : cleaned.avgConfidence >= 60 ? 'yellow' : 'red';
      return {
        type: 'PDF-converted Excel',
        confidence: cleaned.avgConfidence,
        txs: cleaned.txs,
        status,
        message: `ລະບົບ clean ຈາກ PDF-converted Excel ໄດ້ ${cleaned.txs.length} transactions`,
        detail: [
          `Sheets Found: ${sheets.length}`,
          `Rows with date pattern: ${cleaned.dateRows}`,
          `Metadata rows skipped: ${cleaned.skippedMeta}`
        ]
      };
    }

    return {
      type: 'Unreadable / Not enough transaction data',
      confidence: 20,
      txs: cleaned.txs,
      status: 'red',
      message: 'File ນີ້ຍັງອ່ານ transaction ບໍ່ໄດ້ດີ',
      detail: [
        `Sheets Found: ${sheets.length}`,
        `Possible transactions found: ${cleaned.txs.length}`,
        'ຄວນຂໍ Excel/CSV ຈາກ bank ຫຼືແປງ PDF ໃໝ່'
      ]
    };
  }

  function renderImportStatus(info) {
    const panel = $('importStatusPanel');
    const card = $('importStatusCard');
    if (!panel || !card) return;
    panel.classList.remove('hidden');

    const statusText = info.status === 'green' ? 'ອ່ານໄດ້ດີ'
      : info.status === 'yellow' ? 'ອ່ານໄດ້ປານກາງ'
      : 'ອ່ານໄດ້ຕ່ຳ';

    const advice = info.status === 'green'
      ? 'ສາມາດ Analyze ໄດ້ເລີຍ.'
      : info.status === 'yellow'
        ? 'ຄວນກົດ Review Data ເບິ່ງກ່ອນ Analyze.'
        : 'ບໍ່ແນະນຳໃຫ້ Analyze ທັນທີ. ຄວນຂໍ file ໃໝ່ ຫຼືໃຊ້ Advanced Mapping.';

    card.className = `import-status-card ${info.status}`;
    card.innerHTML = `
      <div class="import-status-top">
        <div>
          <strong>${escapeHtml(statusText)}</strong>
          <p>${escapeHtml(info.message)}</p>
        </div>
        <div class="confidence-pill">${escapeHtml(String(info.confidence))}%</div>
      </div>
      <div class="import-detail">
        <div><span>File Type</span><strong>${escapeHtml(info.type)}</strong></div>
        <div><span>Transactions</span><strong>${escapeHtml(String(info.txs.length))}</strong></div>
        <div><span>Recommendation</span><strong>${escapeHtml(advice)}</strong></div>
      </div>
      <ul>${info.detail.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
    `;

    if ($('analyzeStatementBtn')) $('analyzeStatementBtn').disabled = info.txs.length === 0 || info.status === 'red';
  }

  function renderCleanedPreview() {
    const table = $('statementPreviewTable');
    if (!table) return;
    const rows = cleanedTransactions.slice(0, 50);
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Source</th><th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(t => `
          <tr>
            <td>${escapeHtml(t.date)}</td>
            <td>${escapeHtml(t.description)}</td>
            <td>${t.debit ? money(t.debit) : ''}</td>
            <td>${t.credit ? money(t.credit) : ''}</td>
            <td>${t.balance ? money(t.balance) : ''}</td>
            <td>${escapeHtml(t.source)}</td>
            <td>${escapeHtml(String(t.confidence))}%</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  function renderRawPreview() {
    const table = $('statementPreviewTable');
    if (!table) return;
    const previewRows = rawRows.slice(0, 15);
    table.innerHTML = `
      <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${previewRows.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(row[h] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    `;
  }

  function normalizeCounterparty(desc) {
    return String(desc || '').toLowerCase()
      .replace(/\d+/g, '')
      .replace(/[^\p{L}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  }

  function analyzeTransactions(transactions) {
    const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
    const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
    const validMonths = [...new Set(transactions.map(t => t.month).filter(m => m !== 'unknown'))];
    const months = Math.max(validMonths.length, 1);
    const avgMonthlyInflow = totalCredit / months;
    const avgMonthlyOutflow = totalDebit / months;
    const netCashFlow = avgMonthlyInflow - avgMonthlyOutflow;
    const cashWithdrawalTotal = transactions.filter(t => t.category === 'Cash Withdrawal').reduce((s, t) => s + t.debit, 0);
    const cashWithdrawalRatio = totalCredit ? cashWithdrawalTotal / totalCredit : 0;
    const largeDepositThreshold = avgMonthlyInflow * 0.5;
    const largeDeposits = transactions.filter(t => t.credit > 0 && t.credit >= largeDepositThreshold);
    const loanPayments = transactions.filter(t => t.category === 'Loan/Installment Payment');

    const monthlyInflow = {};
    transactions.forEach(t => { monthlyInflow[t.month] = (monthlyInflow[t.month] || 0) + t.credit; });
    const inflows = Object.values(monthlyInflow).filter(v => v > 0);
    const maxInflow = inflows.length ? Math.max(...inflows) : 0;
    const minInflow = inflows.length ? Math.min(...inflows) : 0;
    const incomeVariation = avgMonthlyInflow ? (maxInflow - minInflow) / avgMonthlyInflow : 0;

    const repeatedMap = {};
    transactions.filter(t => t.debit > 0).forEach(t => {
      const key = normalizeCounterparty(t.description);
      if (!key) return;
      repeatedMap[key] = repeatedMap[key] || { count: 0, amount: 0, sample: t.description };
      repeatedMap[key].count++;
      repeatedMap[key].amount += t.debit;
    });
    const repeatedTransfers = Object.values(repeatedMap).filter(x => x.count >= 3).sort((a, b) => b.count - a.count).slice(0, 5);

    let score = 100;
    const flags = [];
    const questions = [];

    if (importInfo && importInfo.confidence < 70) {
      score -= 10;
      flags.push('ຄວາມໝັ້ນໃຈໃນການອ່ານ statement ບໍ່ສູງ ຄວນກວດ preview ກ່ອນນຳໃຊ້');
      questions.push('ຂໍ້ມູນ transaction ທີ່ clean ແລ້ວຖືກຕ້ອງຕາມ statement ບໍ?');
    }
    if (incomeVariation > 0.3 && inflows.length >= 3) {
      score -= 15;
      flags.push('ລາຍຮັບເຂົ້າແຕ່ລະເດືອນບໍ່ຄົງທີ່ ຄວນກວດທີ່ມາລາຍຮັບ');
      questions.push('ລາຍຮັບບາງເດືອນສູງ/ຕ່ຳກວ່າປົກກະຕິ ເກີດຈາກຫຍັງ?');
    }
    if (avgMonthlyOutflow > avgMonthlyInflow) {
      score -= 20;
      flags.push('ລາຍຈ່າຍສະເລ່ຍສູງກວ່າລາຍຮັບ ເປັນ cash flow ຕິດລົບ');
      questions.push('ມີແຫຼ່ງເງິນອື່ນຊ່ວຍຈ່າຍລາຍຈ່າຍບໍ?');
    }
    if (cashWithdrawalRatio > 0.5) {
      score -= 10;
      flags.push('ຍອດຖອນເງິນສົດສູງກວ່າ 50% ຂອງເງິນເຂົ້າ');
      questions.push('ການຖອນເງິນສົດຈຳນວນຫຼາຍນຳໄປໃຊ້ຈ່າຍຫຍັງ?');
    }
    if (largeDeposits.length > 0) {
      score -= 15;
      flags.push(`ພົບເງິນເຂົ້າກ້ອນໃຫຍ່ ${largeDeposits.length} ລາຍການ ຄວນກວດທີ່ມາ`);
      questions.push('ເງິນເຂົ້າກ້ອນໃຫຍ່ແຕ່ລະລາຍການມາຈາກໃສ?');
    }
    if (loanPayments.length > 0) {
      score -= 15;
      flags.push(`ພົບລາຍການຄ້າຍຊຳລະໜີ້/ຜ່ອນ ${loanPayments.length} ລາຍການ`);
      questions.push('ມີໜີ້ຫຼືຄ່າຜ່ອນອື່ນທີ່ຍັງບໍ່ໄດ້ແຈ້ງບໍ?');
    }
    if (repeatedTransfers.length > 0) {
      score -= 10;
      flags.push(`ພົບການໂອນຊ້ຳໆໄປຫາຜູ້ຮັບ/ລາຍການຄ້າຍກັນ ${repeatedTransfers.length} ກຸ່ມ`);
      questions.push('ລາຍການໂອນຊ້ຳໆແມ່ນຄ່າຫຍັງ ແລະເປັນພາລະປະຈຳບໍ?');
    }

    score = Math.max(0, Math.min(100, score));
    const riskLevel = score >= 80 ? 'ພຶດຕິກຳການເງິນຄ່ອນຂ້າງປົກກະຕິ'
      : score >= 60 ? 'ຄວນກວດບາງຈຸດ'
      : score >= 40 ? 'ມີຄວາມສ່ຽງ ຄວນກວດລຶກ'
      : 'ສ່ຽງສູງ ຂໍ້ມູນຄວນກວດຢືນຢັນຫຼາຍ';

    if (!flags.length) flags.push('ບໍ່ພົບ red flag ສຳຄັນຈາກ rule ເບື້ອງຕົ້ນ');
    if (!questions.length) questions.push('ກວດຢືນຢັນລາຍຮັບ ແລະພາລະໜີ້ຕາມເອກະສານປົກກະຕິ');

    return { transactionCount: transactions.length, months, totalCredit, totalDebit, avgMonthlyInflow, avgMonthlyOutflow, netCashFlow, cashWithdrawalTotal, cashWithdrawalRatio, largeDeposits, loanPayments, repeatedTransfers, incomeVariation, behaviorScore: score, riskLevel, flags, questions, transactions };
  }

  function renderSummary(summary) {
    $('statementResultPanel')?.classList.remove('hidden');
    $('stTotalCredit').textContent = money(summary.totalCredit);
    $('stTotalDebit').textContent = money(summary.totalDebit);
    $('stNetCashFlow').textContent = money(summary.netCashFlow);
    $('stBehaviorScore').textContent = `${summary.behaviorScore}/100`;

    const metrics = [
      ['Import Type', importInfo ? importInfo.type : '-'],
      ['Import Confidence', importInfo ? `${importInfo.confidence}%` : '-'],
      ['ໄລຍະ statement', `${summary.months} ເດືອນ`],
      ['ຈຳນວນ transaction', summary.transactionCount],
      ['ເງິນເຂົ້າສະເລ່ຍ/ເດືອນ', money(summary.avgMonthlyInflow)],
      ['ເງິນອອກສະເລ່ຍ/ເດືອນ', money(summary.avgMonthlyOutflow)],
      ['Net cash flow/ເດືອນ', money(summary.netCashFlow)],
      ['Cash withdrawal ratio', `${(summary.cashWithdrawalRatio * 100).toFixed(1)}%`],
      ['ເງິນເຂົ້າກ້ອນໃຫຍ່', `${summary.largeDeposits.length} ລາຍການ`],
      ['ລາຍການຄ້າຍຊຳລະໜີ້', `${summary.loanPayments.length} ລາຍການ`],
      ['Repeated transfer groups', `${summary.repeatedTransfers.length} ກຸ່ມ`],
      ['Risk Level', summary.riskLevel]
    ];
    $('statementMetrics').innerHTML = metrics.map(([k, v]) => `<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
    $('statementFlags').innerHTML = summary.flags.map(f => `<li>${escapeHtml(f)}</li>`).join('');
    $('statementQuestions').innerHTML = summary.questions.map(q => `<li>${escapeHtml(q)}</li>`).join('');
    $('statementPrompt').value = buildStatementPrompt(summary);
  }

  function buildStatementPrompt(summary) {
    const topLarge = summary.largeDeposits.slice(0, 5).map(t => `- ${t.date} | ${t.description} | Credit ${money(t.credit)}`).join('\n') || '- ບໍ່ພົບ';
    const topLoans = summary.loanPayments.slice(0, 5).map(t => `- ${t.date} | ${t.description} | Debit ${money(t.debit)}`).join('\n') || '- ບໍ່ພົບ';
    const repeated = summary.repeatedTransfers.map(x => `- ${x.sample} | ${x.count} ຄັ້ງ | ${money(x.amount)}`).join('\n') || '- ບໍ່ພົບ';

    return `ເຈົ້າແມ່ນ Credit Statement Analysis Assistant. ກະລຸນາວິເຄາະພຶດຕິກຳການເງິນຈາກ statement summary ນີ້ເປັນພາສາລາວແບບມືອາຊີບ. ຢ່າຕັດສິນອະນຸມັດແທນຄົນ.

Import Quality:
- Type: ${importInfo ? importInfo.type : '-'}
- Confidence: ${importInfo ? importInfo.confidence + '%' : '-'}

Statement Summary:
- ໄລຍະ statement: ${summary.months} ເດືອນ
- ຈຳນວນ transaction: ${summary.transactionCount}
- Total Credit: ${money(summary.totalCredit)}
- Total Debit: ${money(summary.totalDebit)}
- Average Monthly Inflow: ${money(summary.avgMonthlyInflow)}
- Average Monthly Outflow: ${money(summary.avgMonthlyOutflow)}
- Net Cash Flow/Month: ${money(summary.netCashFlow)}
- Cash Withdrawal Ratio: ${(summary.cashWithdrawalRatio * 100).toFixed(1)}%
- Behavior Score: ${summary.behaviorScore}/100
- Risk Level: ${summary.riskLevel}

Red Flags:
${summary.flags.map(f => '- ' + f).join('\n')}

Top Large Deposits:
${topLarge}

Loan/Installment-like Transactions:
${topLoans}

Repeated Transfer Groups:
${repeated}

Questions to Ask Customer:
${summary.questions.map(q => '- ' + q).join('\n')}

ຂໍໃຫ້ສະຫຼຸບ:
1) ພາບລວມພຶດຕິກຳການເງິນ
2) ຈຸດແຂງ
3) ຈຸດສ່ຽງ/ຈຸດຄວນກວດ
4) ຄຳຖາມທີ່ຄວນຖາມລູກຄ້າ
5) ຄຳແນະນຳກ່ອນສົ່ງພິຈາລະນາ`;
  }

  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) {
      setMessage('V2 ນີ້ຍັງຮັບ Excel/CSV. ຖ້າເປັນ PDF ໃຫ້ convert ເປັນ Excel ກ່ອນ ແລ້ວ upload ເຂົ້າມາ.', 'warning');
      return;
    }

    try {
      clearStatement(false);
      setMessage('ກຳລັງກວດ ແລະ clean file...', '');
      let rows = [];
      let sheets = [];

      if (name.endsWith('.csv')) {
        const text = await file.text();
        rows = parseCsv(text);
        sheets = [{ name: 'CSV', rows }];
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') throw new Error('XLSX library ຍັງໂຫຼດບໍ່ສຳເລັດ. ກະລຸນາ refresh ແລ້ວລອງໃໝ່.');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        sheets = workbook.SheetNames.map(name => ({
          name,
          rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' })
        }));
        rows = sheets[0]?.rows || [];
      } else {
        throw new Error('ຮອງຮັບສະເພາະ CSV, XLSX, XLS');
      }

      sourceRows = rows.filter(r => (r || []).some(x => String(x ?? '').trim() !== ''));
      sourceSheets = sheets.map(s => ({ name: s.name, rows: s.rows.filter(r => (r || []).some(x => String(x ?? '').trim() !== '')) }));

      if (!sourceSheets.length || !sourceSheets.some(s => s.rows.length)) {
        throw new Error('ບໍ່ພົບຂໍ້ມູນໃນ file');
      }

      importInfo = smartImport(sourceRows, sourceSheets);
      cleanedTransactions = importInfo.txs || [];

      renderImportStatus(importInfo);
      renderCleanedPreview();

      if (cleanedTransactions.length) {
        $('previewPanel')?.classList.remove('hidden');
      }
      $('statementResultPanel')?.classList.add('hidden');

      // Prepare advanced mapping in background
      const headerIndex = detectHeaderRow(sourceRows);
      fillHeaderRowSelect(sourceRows, headerIndex >= 0 ? headerIndex : 0);
      if (headerIndex >= 0) {
        try { applyHeaderRow(headerIndex); } catch (e) {}
        // Restore cleaned preview after setupMapping overwrote it
        renderCleanedPreview();
      }

      setMessage(importInfo.message, importInfo.status === 'green' ? 'success' : importInfo.status === 'yellow' ? 'warning' : 'error');
    } catch (err) {
      setMessage(err.message || 'ອ່ານ file ບໍ່ສຳເລັດ', 'error');
    }
  }

  function clearStatement(clearFile = true) {
    sourceRows = [];
    sourceSheets = [];
    rawRows = [];
    headers = [];
    cleanedTransactions = [];
    importInfo = null;
    lastSummary = null;
    if (clearFile && $('statementFile')) $('statementFile').value = '';
    ['importStatusPanel', 'advancedPanel', 'previewPanel', 'statementResultPanel'].forEach(id => $(id)?.classList.add('hidden'));
    if ($('statementPreviewTable')) $('statementPreviewTable').innerHTML = '';
    if ($('statementPrompt')) $('statementPrompt').value = '';
    if (clearFile) setMessage('', '');
  }

  $('statementFile')?.addEventListener('change', (e) => handleFile(e.target.files[0]));

  $('analyzeStatementBtn')?.addEventListener('click', () => {
    try {
      if (!cleanedTransactions.length) throw new Error('ບໍ່ມີ transaction ສຳລັບ analyze');
      lastSummary = analyzeTransactions(cleanedTransactions);
      renderSummary(lastSummary);
      $('statementResultPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setMessage(err.message || 'Analyze ບໍ່ສຳເລັດ', 'error');
    }
  });

  $('reviewDataBtn')?.addEventListener('click', () => {
    $('previewPanel')?.classList.toggle('hidden');
    renderCleanedPreview();
  });

  $('toggleAdvancedBtn')?.addEventListener('click', () => {
    $('advancedPanel')?.classList.toggle('hidden');
  });

  $('clearStatementBtn')?.addEventListener('click', () => clearStatement(true));

  $('headerRowSelect')?.addEventListener('change', (e) => updateHeaderHelp(e.target.value));

  $('applyHeaderRowBtn')?.addEventListener('click', () => {
    try {
      applyHeaderRow($('headerRowSelect')?.value || 0);
      setMessage('Apply Header Row ສຳເລັດ. ກວດ column mapping ແລ້ວກົດ Apply Manual Mapping.', 'success');
    } catch (err) {
      setMessage(err.message || 'Apply Header Row ບໍ່ສຳເລັດ', 'error');
    }
  });

  $('applyManualMappingBtn')?.addEventListener('click', () => {
    try {
      cleanedTransactions = normalizeManualTransactions();
      if (!cleanedTransactions.length) throw new Error('Manual mapping ບໍ່ພົບ transaction');
      importInfo = {
        type: 'Manual Mapping',
        confidence: 80,
        status: 'yellow',
        txs: cleanedTransactions,
        message: `Manual mapping ໄດ້ ${cleanedTransactions.length} transactions`,
        detail: ['User selected columns manually']
      };
      renderImportStatus(importInfo);
      renderCleanedPreview();
      $('previewPanel')?.classList.remove('hidden');
      $('statementResultPanel')?.classList.add('hidden');
      setMessage('Manual mapping ສຳເລັດ. ກົດ Analyze Statement ໄດ້.', 'success');
    } catch (err) {
      setMessage(err.message || 'Manual mapping ບໍ່ສຳເລັດ', 'error');
    }
  });

  $('copyStatementPromptBtn')?.addEventListener('click', async () => {
    const text = $('statementPrompt')?.value || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    $('statementCopyMessage').textContent = 'ຄັດລອກ Statement Prompt ແລ້ວ';
    $('statementCopyMessage').className = 'message success';
  });
})();
