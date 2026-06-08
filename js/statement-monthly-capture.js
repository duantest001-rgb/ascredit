(function () {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'ascredit.statement.monthlyCapture.v1';
  let rows = [];
  let pdfObjectUrl = '';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  }

  function num(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[,\s]/g, '').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    return num(value).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' LAK';
  }

  function monthLabel(value) {
    if (!value) return '';
    const m = String(value).match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : String(value);
  }

  function setMessage(text, type = '') {
    const el = $('manualCaptureMessage');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'message ' + type;
  }

  function getMeta() {
    return {
      bank: $('manualBank')?.value || '',
      customerName: $('manualCustomerName')?.value || '',
      accountNo: $('manualAccountNo')?.value || '',
      periodStart: $('manualPeriodStart')?.value || '',
      periodEnd: $('manualPeriodEnd')?.value || '',
      currency: $('manualCurrency')?.value || 'LAK'
    };
  }

  function defaultRow(month = '') {
    return {
      month,
      opening: 0,
      credit: 0,
      debit: 0,
      closing: 0,
      salary: 0,
      cashWithdrawal: 0,
      loanLike: 0,
      largeDeposit: 0,
      remark: ''
    };
  }

  function readRowsFromDom() {
    const body = $('monthlyCaptureRows');
    if (!body) return;
    rows = [...body.querySelectorAll('tr')].map((tr) => ({
      month: tr.querySelector('[data-field="month"]')?.value || '',
      opening: num(tr.querySelector('[data-field="opening"]')?.value),
      credit: num(tr.querySelector('[data-field="credit"]')?.value),
      debit: num(tr.querySelector('[data-field="debit"]')?.value),
      closing: num(tr.querySelector('[data-field="closing"]')?.value),
      salary: num(tr.querySelector('[data-field="salary"]')?.value),
      cashWithdrawal: num(tr.querySelector('[data-field="cashWithdrawal"]')?.value),
      loanLike: num(tr.querySelector('[data-field="loanLike"]')?.value),
      largeDeposit: num(tr.querySelector('[data-field="largeDeposit"]')?.value),
      remark: tr.querySelector('[data-field="remark"]')?.value || ''
    }));
  }

  function renderRows() {
    const body = $('monthlyCaptureRows');
    if (!body) return;
    if (!rows.length) rows = [defaultRow()];
    body.innerHTML = rows.map((r, i) => `
      <tr data-index="${i}">
        <td><input type="month" data-field="month" value="${esc(r.month)}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="opening" value="${esc(r.opening || '')}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="credit" value="${esc(r.credit || '')}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="debit" value="${esc(r.debit || '')}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="closing" value="${esc(r.closing || '')}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="salary" value="${esc(r.salary || '')}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="cashWithdrawal" value="${esc(r.cashWithdrawal || '')}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="loanLike" value="${esc(r.loanLike || '')}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="largeDeposit" value="${esc(r.largeDeposit || '')}" /></td>
        <td><input data-field="remark" value="${esc(r.remark)}" placeholder="ຈຸດຄວນກວດ..." /></td>
        <td><button type="button" class="danger-btn mini-btn" data-remove-row="${i}">ລຶບ</button></td>
      </tr>
    `).join('');
  }

  function monthRange(start, end) {
    if (!start || !end) return [];
    const s = new Date(start + '-01T00:00:00');
    const e = new Date(end + '-01T00:00:00');
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return [];
    const out = [];
    const d = new Date(s);
    while (d <= e && out.length < 36) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }

  function generateMonthRows() {
    const start = $('manualPeriodStart')?.value;
    const end = $('manualPeriodEnd')?.value;
    const months = monthRange(start, end);
    if (!months.length) {
      setMessage('ກະລຸນາເລືອກໄລຍະເດືອນເລີ່ມ ແລະ ສິ້ນສຸດໃຫ້ຖືກ', 'error');
      return;
    }
    readRowsFromDom();
    const existing = new Map(rows.map(r => [r.month, r]));
    rows = months.map(m => existing.get(m) || defaultRow(m));
    renderRows();
    saveDraft(false);
    setMessage(`ສ້າງແຖວ ${months.length} ເດືອນແລ້ວ`, 'success');
  }

  function validateBalanceRows() {
    return rows.map((r) => {
      const expected = num(r.opening) + num(r.credit) - num(r.debit);
      const diff = expected - num(r.closing);
      return { month: r.month, expectedClosing: expected, reportedClosing: num(r.closing), difference: diff, ok: Math.abs(diff) <= 1 };
    });
  }

  function analyzeRows() {
    readRowsFromDom();
    const usableRows = rows.filter(r => r.month || r.credit || r.debit || r.opening || r.closing);
    if (!usableRows.length) throw new Error('ກະລຸນາເພີ່ມຂໍ້ມູນຢ່າງໜ້ອຍ 1 ເດືອນ');
    rows = usableRows;
    const monthCount = rows.length;
    const totalCredit = rows.reduce((s, r) => s + num(r.credit), 0);
    const totalDebit = rows.reduce((s, r) => s + num(r.debit), 0);
    const totalSalary = rows.reduce((s, r) => s + num(r.salary), 0);
    const totalCashWithdrawal = rows.reduce((s, r) => s + num(r.cashWithdrawal), 0);
    const totalLoanLike = rows.reduce((s, r) => s + num(r.loanLike), 0);
    const totalLargeDeposit = rows.reduce((s, r) => s + num(r.largeDeposit), 0);
    const avgCredit = totalCredit / monthCount;
    const avgDebit = totalDebit / monthCount;
    const netCashFlow = totalCredit - totalDebit;
    const avgNetCashFlow = netCashFlow / monthCount;
    const expenseIncomeRatio = totalCredit > 0 ? totalDebit / totalCredit : 0;
    const cashWithdrawalRatio = totalDebit > 0 ? totalCashWithdrawal / totalDebit : 0;
    const salaryRatio = totalCredit > 0 ? totalSalary / totalCredit : 0;
    const loanLikeRatio = totalCredit > 0 ? totalLoanLike / totalCredit : 0;
    const balanceChecks = validateBalanceRows();
    const failedBalance = balanceChecks.filter(x => !x.ok);
    const negativeMonths = rows.filter(r => num(r.credit) - num(r.debit) < 0);
    const lowClosingMonths = rows.filter(r => num(r.closing) > 0 && num(r.closing) < Math.max(avgDebit * 0.1, 100000));
    const incomeValues = rows.map(r => num(r.credit)).filter(v => v > 0);
    const minIncome = incomeValues.length ? Math.min(...incomeValues) : 0;
    const maxIncome = incomeValues.length ? Math.max(...incomeValues) : 0;
    const incomeSpreadRatio = avgCredit > 0 ? (maxIncome - minIncome) / avgCredit : 0;

    const flags = [];
    if (failedBalance.length) flags.push(`ມີ ${failedBalance.length} ເດືອນທີ່ opening + credit - debit ບໍ່ຕົງກັບ closing`);
    if (negativeMonths.length) flags.push(`ມີ ${negativeMonths.length} ເດືອນ Net Cash Flow ຕິດລົບ`);
    if (expenseIncomeRatio > 0.9) flags.push('ລາຍຈ່າຍລວມສູງກວ່າ 90% ຂອງລາຍຮັບລວມ');
    if (cashWithdrawalRatio > 0.45) flags.push('ສັດສ່ວນຖອນເງິນສົດສູງ ຄວນກວດພຶດຕິກຳການໃຊ້ເງິນ');
    if (loanLikeRatio > 0.25) flags.push('ລາຍການຄ້າຍຊຳລະໜີ້ສູງ ຄວນກວດພາລະໜີ້ເພີ່ມ');
    if (incomeSpreadRatio > 1.2) flags.push('ລາຍຮັບຜັນຜວນສູງ ຄວນຢືນຢັນແຫຼ່ງລາຍຮັບ');
    if (lowClosingMonths.length) flags.push(`ມີ ${lowClosingMonths.length} ເດືອນທີ່ closing balance ຕ່ຳ`);
    if (totalLargeDeposit > avgCredit) flags.push('ມີເງິນເຂົ້າກ້ອນໃຫຍ່ ຄວນຖາມທີ່ມາຂອງເງິນ');
    if (!flags.length) flags.push('ບໍ່ພົບ red flag ຫຼັກຈາກ monthly capture');

    const score = Math.max(0, Math.min(100,
      100
      - failedBalance.length * 8
      - negativeMonths.length * 7
      - (expenseIncomeRatio > 0.9 ? 15 : expenseIncomeRatio > 0.75 ? 8 : 0)
      - (cashWithdrawalRatio > 0.45 ? 8 : 0)
      - (loanLikeRatio > 0.25 ? 10 : 0)
      - (incomeSpreadRatio > 1.2 ? 10 : 0)
    ));

    return {
      meta: getMeta(),
      rows,
      totals: { monthCount, totalCredit, totalDebit, netCashFlow, totalSalary, totalCashWithdrawal, totalLoanLike, totalLargeDeposit },
      averages: { avgCredit, avgDebit, avgNetCashFlow },
      ratios: { expenseIncomeRatio, cashWithdrawalRatio, salaryRatio, loanLikeRatio, incomeSpreadRatio },
      balanceChecks,
      flags,
      score: Math.round(score)
    };
  }

  function renderAnalysis(result) {
    const panel = $('manualAnalysisPanel');
    if (!panel) return;
    panel.classList.remove('hidden');
    $('manualSummaryCards').innerHTML = `
      <div class="value-card"><span>Avg Monthly Income</span><strong>${money(result.averages.avgCredit)}</strong></div>
      <div class="value-card"><span>Avg Monthly Expense</span><strong>${money(result.averages.avgDebit)}</strong></div>
      <div class="value-card"><span>Avg Net Cash Flow</span><strong>${money(result.averages.avgNetCashFlow)}</strong></div>
      <div class="value-card"><span>Statement Score</span><strong>${result.score}/100</strong></div>
    `;
    $('manualRatioCards').innerHTML = `
      <div><span>Expense / Income</span><strong>${(result.ratios.expenseIncomeRatio * 100).toFixed(1)}%</strong></div>
      <div><span>Cash Withdrawal / Debit</span><strong>${(result.ratios.cashWithdrawalRatio * 100).toFixed(1)}%</strong></div>
      <div><span>Salary / Credit</span><strong>${(result.ratios.salaryRatio * 100).toFixed(1)}%</strong></div>
      <div><span>Loan-like / Credit</span><strong>${(result.ratios.loanLikeRatio * 100).toFixed(1)}%</strong></div>
    `;
    $('manualFlagList').innerHTML = result.flags.map(f => `<li>${esc(f)}</li>`).join('');
    $('manualMonthlySummary').innerHTML = result.rows.map(r => {
      const net = num(r.credit) - num(r.debit);
      return `<tr><td>${esc(monthLabel(r.month))}</td><td>${money(r.credit)}</td><td>${money(r.debit)}</td><td>${money(net)}</td><td>${money(r.closing)}</td><td>${esc(r.remark || '-')}</td></tr>`;
    }).join('');
  }

  function buildPrompt(result) {
    return `ເຈົ້າແມ່ນ Credit Analysis Assistant. ກະລຸນາຂຽນບົດວິເຄາະ statement ເປັນພາສາລາວແບບມືອາຊີບ. ຫ້າມຕັດສິນອະນຸມັດ ຫຼື ປະຕິເສດແທນຄົນ.\n\nIMPORTANT:\n- ຂໍ້ມູນນີ້ແມ່ນ Monthly Capture ຈາກ PDF statement.\n- User/credit officer ໄດ້ກວດຍອດຈາກ PDF preview ແລ້ວກ່ອນກົດ Analyze.\n- Code ເປັນຜູ້ຄຳນວນ ratios, average, net cash flow ແລະ red flags.\n- AI ມີໜ້າທີ່ອະທິບາຍເທົ່ານັ້ນ.\n\nStatement Info:\n${JSON.stringify(result.meta, null, 2)}\n\nMonthly Rows:\n${JSON.stringify(result.rows, null, 2)}\n\nTotals:\n${JSON.stringify(result.totals, null, 2)}\n\nAverages:\n${JSON.stringify(result.averages, null, 2)}\n\nRatios:\n${JSON.stringify(result.ratios, null, 2)}\n\nBalance Checks:\n${JSON.stringify(result.balanceChecks, null, 2)}\n\nRed Flags:\n${result.flags.map(x => '- ' + x).join('\n')}\n\nຂໍໃຫ້ຂຽນໂຄງສ້າງນີ້:\n1. ສະຫຼຸບພາບລວມ statement\n2. ວິເຄາະລາຍຮັບລາຍເດືອນ\n3. ວິເຄາະລາຍຈ່າຍ ແລະ ພຶດຕິກຳຖອນເງິນ\n4. ວິເຄາະ Net Cash Flow\n5. ຈຸດແຂງ\n6. ຈຸດສ່ຽງ/Red Flags\n7. ຄຳຖາມທີ່ຄວນຖາມລູກຄ້າ\n8. ເອກະສານ/ຫຼັກຖານຄວນຂໍເພີ່ມ\n9. ຂໍ້ຄວນກວດກ່ອນສົ່ງພິຈາລະນາ`;
  }

  function runAnalyze() {
    try {
      const result = analyzeRows();
      renderRows();
      renderAnalysis(result);
      if ($('manualStatementPrompt')) $('manualStatementPrompt').value = buildPrompt(result);
      saveDraft(false);
      setMessage('ຄຳນວນ monthly capture ສຳເລັດ. ກວດ summary ແລະ copy prompt ໄດ້.', 'success');
    } catch (e) {
      setMessage(e.message || 'ຄຳນວນບໍ່ສຳເລັດ', 'error');
    }
  }

  function toCsvValue(value) {
    const t = String(value ?? '');
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }

  function exportCsv() {
    readRowsFromDom();
    const header = ['month','opening','credit','debit','closing','salary','cashWithdrawal','loanLike','largeDeposit','remark'];
    const lines = [header.join(',')].concat(rows.map(r => header.map(h => toCsvValue(r[h])).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'statement-monthly-capture.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveDraft(showMessage = true) {
    readRowsFromDom();
    const data = { meta: getMeta(), rows };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (showMessage) setMessage('ບັນທຶກ draft ໃນ browser ແລ້ວ', 'success');
  }

  function loadDraft() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) return;
      const meta = data.meta || {};
      if ($('manualBank')) $('manualBank').value = meta.bank || '';
      if ($('manualCustomerName')) $('manualCustomerName').value = meta.customerName || '';
      if ($('manualAccountNo')) $('manualAccountNo').value = meta.accountNo || '';
      if ($('manualPeriodStart')) $('manualPeriodStart').value = meta.periodStart || '';
      if ($('manualPeriodEnd')) $('manualPeriodEnd').value = meta.periodEnd || '';
      if ($('manualCurrency')) $('manualCurrency').value = meta.currency || 'LAK';
      rows = Array.isArray(data.rows) && data.rows.length ? data.rows : [defaultRow()];
    } catch (e) {
      rows = [defaultRow()];
    }
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY);
    rows = [defaultRow()];
    ['manualCustomerName','manualAccountNo','manualPeriodStart','manualPeriodEnd'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('manualBank')) $('manualBank').value = '';
    if ($('manualCurrency')) $('manualCurrency').value = 'LAK';
    if ($('manualStatementPrompt')) $('manualStatementPrompt').value = '';
    $('manualAnalysisPanel')?.classList.add('hidden');
    renderRows();
    setMessage('ລ້າງ monthly capture ແລ້ວ', 'warning');
  }

  function updatePdfPreview() {
    const file = $('pdfStatementFile')?.files?.[0];
    const frame = $('manualPdfPreview');
    const box = $('manualPdfPreviewBox');
    if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    pdfObjectUrl = '';
    if (!file || !frame || !box) {
      box?.classList.add('hidden');
      return;
    }
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) return;
    pdfObjectUrl = URL.createObjectURL(file);
    frame.src = pdfObjectUrl;
    box.classList.remove('hidden');
  }

  function wire() {
    $('addMonthlyRowBtn')?.addEventListener('click', () => { readRowsFromDom(); rows.push(defaultRow()); renderRows(); });
    $('generateMonthRowsBtn')?.addEventListener('click', generateMonthRows);
    $('analyzeMonthlyCaptureBtn')?.addEventListener('click', runAnalyze);
    $('exportMonthlyCsvBtn')?.addEventListener('click', exportCsv);
    $('saveMonthlyDraftBtn')?.addEventListener('click', () => saveDraft(true));
    $('clearMonthlyCaptureBtn')?.addEventListener('click', clearDraft);
    $('copyManualPromptBtn')?.addEventListener('click', async () => {
      const text = $('manualStatementPrompt')?.value || '';
      if (!text) { setMessage('ຍັງບໍ່ມີ prompt. ກົດ Calculate & Generate Prompt ກ່ອນ.', 'error'); return; }
      await navigator.clipboard.writeText(text);
      setMessage('ຄັດລອກ prompt ແລ້ວ', 'success');
    });
    $('monthlyCaptureRows')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-row]');
      if (!btn) return;
      readRowsFromDom();
      rows.splice(Number(btn.dataset.removeRow), 1);
      if (!rows.length) rows.push(defaultRow());
      renderRows();
    });
    $('monthlyCaptureRows')?.addEventListener('input', () => saveDraft(false));
    ['manualBank','manualCustomerName','manualAccountNo','manualPeriodStart','manualPeriodEnd','manualCurrency'].forEach(id => $(id)?.addEventListener('input', () => saveDraft(false)));
    $('pdfStatementFile')?.addEventListener('change', updatePdfPreview);
  }

  loadDraft();
  renderRows();
  wire();
  updatePdfPreview();
})();
