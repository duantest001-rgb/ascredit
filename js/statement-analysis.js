(function () {
  const $ = (id) => document.getElementById(id);

  let rawRows = [];
  let headers = [];
  let lastSummary = null;

  const keywordRules = {
    cash: ['cash', 'atm', 'withdraw', 'withdrawal', 'ຖອນ', 'ຖອນເງິນ'],
    loan: ['loan', 'repay', 'repayment', 'installment', 'finance', 'interest', 'ຜ່ອນ', 'ຊຳລະ', 'ກູ້', 'ດອກເບ້ຍ', 'ຄ່າງວດ'],
    salary: ['salary', 'payroll', 'wage', 'ເງິນເດືອນ', 'ເງິນເດືອນເຂົ້າ'],
    transfer: ['transfer', 'trf', 'ໂອນ', 'ໂອນເງິນ'],
    bill: ['bill', 'utility', 'electric', 'water', 'internet', 'ໄຟຟ້າ', 'ນ້ຳປະປາ', 'ອິນເຕີເນັດ']
  };

  function money(value) {
    return Number(value || 0).toLocaleString('en-US') + ' LAK';
  }

  function setMessage(text, type = '') {
    const el = $('statementMessage');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'message ' + type;
  }

  function parseAmount(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let text = String(value).trim();
    if (!text || text === '-' || text === '—') return 0;
    const isNegative = /^\(.*\)$/.test(text) || text.startsWith('-');
    text = text.replace(/[(),\s]/g, '').replace(/[^\d.-]/g, '');
    const num = Number(text);
    if (!Number.isFinite(num)) return 0;
    return isNegative ? -Math.abs(num) : Math.abs(num);
  }

  function normalizeDate(value) {
    if (!value) return '';
    if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);
    if (typeof value === 'number') {
      try {
        const d = XLSX.SSF.parse_date_code(value);
        if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      } catch (e) {}
    }
    const text = String(value).trim();
    const m1 = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m1) {
      let y = m1[3].length === 2 ? '20' + m1[3] : m1[3];
      return `${y}-${String(m1[2]).padStart(2, '0')}-${String(m1[1]).padStart(2, '0')}`;
    }
    const m2 = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m2) return `${m2[1]}-${String(m2[2]).padStart(2, '0')}-${String(m2[3]).padStart(2, '0')}`;
    return text;
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

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    headers = rows[0].map((h, i) => String(h || `Column ${i + 1}`).trim() || `Column ${i + 1}`);
    return rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] ?? '');
      return obj;
    }).filter(obj => Object.values(obj).some(v => String(v).trim() !== ''));
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
    fillSelect('mapDate', guessHeader(['date', 'ວັນ', 'txn']));
    fillSelect('mapDescription', guessHeader(['description', 'detail', 'narration', 'remark', 'ລາຍ', 'ໝາຍ']));
    fillSelect('mapDebit', guessHeader(['debit', 'withdraw', 'money out', 'outflow', 'dr', 'ອອກ', 'ຖອນ']));
    fillSelect('mapCredit', guessHeader(['credit', 'deposit', 'money in', 'inflow', 'cr', 'ເຂົ້າ', 'ຝາກ']));
    fillSelect('mapBalance', guessHeader(['balance', 'bal', 'ຄົງເຫຼືອ', 'ຍອດ']));
  }

  function renderPreview() {
    const table = $('statementPreviewTable');
    if (!table) return;
    const previewRows = rawRows.slice(0, 15);
    table.innerHTML = `
      <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${previewRows.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(row[h] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
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

  function normalizeTransactions() {
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

    return rawRows.map(row => {
      const debit = parseAmount(row[mapping.debit]);
      const credit = parseAmount(row[mapping.credit]);
      const description = row[mapping.description] || '';
      return {
        date: normalizeDate(row[mapping.date]),
        description: String(description).trim(),
        debit,
        credit,
        balance: mapping.balance ? parseAmount(row[mapping.balance]) : 0,
        month: monthKey(row[mapping.date]),
        category: categorize(description, debit, credit)
      };
    }).filter(t => t.debit > 0 || t.credit > 0);
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
    const monthlyOutflow = {};
    transactions.forEach(t => {
      monthlyInflow[t.month] = (monthlyInflow[t.month] || 0) + t.credit;
      monthlyOutflow[t.month] = (monthlyOutflow[t.month] || 0) + t.debit;
    });
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

    return {
      transactionCount: transactions.length,
      months,
      totalCredit,
      totalDebit,
      avgMonthlyInflow,
      avgMonthlyOutflow,
      netCashFlow,
      cashWithdrawalTotal,
      cashWithdrawalRatio,
      largeDeposits,
      loanPayments,
      repeatedTransfers,
      incomeVariation,
      behaviorScore: score,
      riskLevel,
      flags,
      questions,
      transactions
    };
  }

  function normalizeCounterparty(desc) {
    return String(desc || '').toLowerCase()
      .replace(/\d+/g, '')
      .replace(/[^\p{L}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  }

  function renderSummary(summary) {
    $('statementResultPanel')?.classList.remove('hidden');
    $('stTotalCredit').textContent = money(summary.totalCredit);
    $('stTotalDebit').textContent = money(summary.totalDebit);
    $('stNetCashFlow').textContent = money(summary.netCashFlow);
    $('stBehaviorScore').textContent = `${summary.behaviorScore}/100`;

    const metrics = [
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
      setMessage('V1 ຍັງບໍ່ອ່ານ PDF ໂດຍກົງ. ກະລຸນາ export/convert ເປັນ Excel/CSV ກ່ອນ. PDF Extractor ຈະເຮັດເປັນ V2.', 'warning');
      return;
    }

    try {
      setMessage('ກຳລັງອ່ານ file...', '');
      let rows;
      if (name.endsWith('.csv')) {
        const text = await file.text();
        rows = parseCsv(text);
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') throw new Error('XLSX library ຍັງໂຫຼດບໍ່ສຳເລັດ. ກະລຸນາ refresh ແລ້ວລອງໃໝ່.');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      } else {
        throw new Error('ຮອງຮັບສະເພາະ CSV, XLSX, XLS');
      }

      rawRows = rowsToObjects(rows);
      if (!rawRows.length || !headers.length) throw new Error('ບໍ່ພົບຂໍ້ມູນ transaction ໃນ file');
      setupMapping();
      renderPreview();
      $('mappingPanel')?.classList.remove('hidden');
      $('previewPanel')?.classList.remove('hidden');
      $('statementResultPanel')?.classList.add('hidden');
      setMessage(`ອ່ານ file ສຳເລັດ: ${rawRows.length} ແຖວ. ກະລຸນາກວດ column mapping ແລ້ວກົດ Analyze.`, 'success');
    } catch (err) {
      setMessage(err.message || 'ອ່ານ file ບໍ່ສຳເລັດ', 'error');
    }
  }

  function clearStatement() {
    rawRows = [];
    headers = [];
    lastSummary = null;
    if ($('statementFile')) $('statementFile').value = '';
    ['mappingPanel', 'previewPanel', 'statementResultPanel'].forEach(id => $(id)?.classList.add('hidden'));
    if ($('statementPreviewTable')) $('statementPreviewTable').innerHTML = '';
    if ($('statementPrompt')) $('statementPrompt').value = '';
    setMessage('', '');
  }

  $('statementFile')?.addEventListener('change', (e) => handleFile(e.target.files[0]));

  $('analyzeStatementBtn')?.addEventListener('click', () => {
    try {
      const transactions = normalizeTransactions();
      if (!transactions.length) throw new Error('ບໍ່ພົບ transaction ຫຼັງຈາກ mapping. ກະລຸນາກວດ column ອີກຄັ້ງ.');
      lastSummary = analyzeTransactions(transactions);
      renderSummary(lastSummary);
      $('statementResultPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setMessage(err.message || 'Analyze ບໍ່ສຳເລັດ', 'error');
    }
  });

  $('clearStatementBtn')?.addEventListener('click', clearStatement);

  $('copyStatementPromptBtn')?.addEventListener('click', async () => {
    const text = $('statementPrompt')?.value || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    $('statementCopyMessage').textContent = 'ຄັດລອກ Statement Prompt ແລ້ວ';
    $('statementCopyMessage').className = 'message success';
  });
})();
