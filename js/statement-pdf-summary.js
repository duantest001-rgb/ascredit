(function () {
  const $ = (id) => document.getElementById(id);
  const KEY = 'ascredit_pdf_worker_url';
  let currentResult = null;
  let validation = null;

  function msg(id, text, type = '') {
    const el = $(id); if (!el) return;
    el.textContent = text || '';
    el.className = 'message ' + type;
  }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
  function money(v) { const x = n(v); return x === null ? '-' : x.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' LAK'; }

  function validate(r) {
    const s = r?.summary_values || {};
    const ob = n(s.opening_balance), dep = n(s.total_deposits), wit = n(s.total_withdrawals), cb = n(s.closing_balance);
    const missing = [];
    if (ob === null) missing.push('Opening Balance');
    if (dep === null) missing.push('Total Deposits');
    if (wit === null) missing.push('Total Withdrawals');
    if (cb === null) missing.push('Closing Balance');
    if (missing.length) return { status: 'red', passed: false, calculated: null, reported: cb, difference: null, note: 'ຂາດຄ່າຫຼັກ: ' + missing.join(', ') };
    const calculated = ob + dep - wit;
    const diff = calculated - cb;
    const ad = Math.abs(diff);
    const status = ad <= 1 ? 'green' : ad <= 100 ? 'yellow' : 'red';
    const note = status === 'green' ? 'Validation Passed: ຍອດສົມດຸນກັນ' : status === 'yellow' ? 'Minor Difference: ຄວນກວດ rounding/fee' : 'Validation Warning: ຍອດບໍ່ສົມດຸນ ຄວນ Manual Review';
    return { status, passed: status === 'green', calculated, reported: cb, difference: diff, note };
  }

  function renderStatus(r, v) {
    $('pdfStatusPanel')?.classList.remove('hidden');
    const c = Number(r?.overall_confidence || 0);
    const status = v.status === 'red' || c < 60 ? 'red' : v.status === 'yellow' || c < 80 ? 'yellow' : 'green';
    const label = status === 'green' ? 'ອ່ານໄດ້ດີ' : status === 'yellow' ? 'ຕ້ອງກວດກ່ອນໃຊ້' : 'Manual Review Required';
    const card = $('pdfStatusCard'); if (!card) return;
    card.className = 'import-status-card ' + status;
    card.innerHTML = `<div class="import-status-top"><div><strong>${esc(label)}</strong><p>${esc(r?.recommended_next_step || v.note)}</p></div><div class="confidence-pill">${esc(c)}%</div></div><div class="import-detail"><div><span>Validation</span><strong>${esc(v.note)}</strong></div><div><span>Rule</span><strong>AI reads / Code verifies / User confirms</strong></div></div>`;
  }

  function render(r) {
    currentResult = r;
    validation = validate(r);
    $('pdfResultPanel')?.classList.remove('hidden');
    const s = r.summary_values || {}, info = r.statement_info || {}, b = r.behavior_summary || {};
    $('pdfOpeningBalance').textContent = money(s.opening_balance);
    $('pdfTotalDeposits').textContent = money(s.total_deposits);
    $('pdfTotalWithdrawals').textContent = money(s.total_withdrawals);
    $('pdfClosingBalance').textContent = money(s.closing_balance);
    renderStatus(r, validation);
    const rc = $('recalcCard');
    if (rc) { rc.className = 'recalc-card ' + validation.status; rc.innerHTML = `<strong>${esc(validation.note)}</strong><div class="recalc-grid"><div><span>Calculated Closing</span><b>${money(validation.calculated)}</b></div><div><span>Reported Closing</span><b>${money(validation.reported)}</b></div><div><span>Difference</span><b>${money(validation.difference)}</b></div></div>`; }
    const rows = [['Bank', info.bank_name || '-'], ['Account Name', info.account_name || '-'], ['Account No.', info.account_number_masked || '-'], ['Currency', info.currency || 'LAK'], ['Period', `${info.period_start || '-'} → ${info.period_end || '-'}`], ['Page Count', info.page_count || '-'], ['Transactions Estimate', s.estimated_transaction_count || '-'], ['Overall Confidence', `${r.overall_confidence || 0}%`]];
    $('pdfStatementInfo').innerHTML = rows.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
    $('pdfRiskFlags').innerHTML = (r.risk_flags || []).map(x=>`<li>${esc(x)}</li>`).join('') || '<li>ບໍ່ພົບ risk flag ສຳຄັນ</li>';
    $('pdfQuestions').innerHTML = (r.questions_to_ask_customer || []).map(x=>`<li>${esc(x)}</li>`).join('') || '<li>ກວດຢືນຢັນຍອດຫຼັກຕາມປົກກະຕິ</li>';
    const list = (title, arr) => `<div><h5>${esc(title)}</h5>${Array.isArray(arr)&&arr.length?'<ul>'+arr.map(x=>`<li>${esc(typeof x==='object'?JSON.stringify(x):x)}</li>`).join('')+'</ul>':'<p class="muted">-</p>'}</div>`;
    $('pdfBehaviorSummary').innerHTML = `<div><h5>Cash Withdrawal Behavior</h5><p>${esc(b.cash_withdrawal_behavior || '-')}</p></div><div><h5>Income Stability</h5><p>${esc(b.income_stability || '-')}</p></div>${list('Largest Deposits',b.largest_deposits)}${list('Largest Withdrawals',b.largest_withdrawals)}${list('Repeated Payments',b.repeated_payment_patterns)}${list('Loan / BNPL Keywords',b.loan_or_bnpl_keywords_found)}${list('Unusual Transactions',b.unusual_transactions)}`;
    if ($('confirmKeyTotals')) $('confirmKeyTotals').checked = false;
    if ($('generateMemoPromptBtn')) $('generateMemoPromptBtn').disabled = true;
  }

  function buildPrompt(r, v) {
    return `ເຈົ້າແມ່ນ Credit Analysis Assistant. ກະລຸນາຂຽນບົດວິເຄາະ statement ເປັນພາສາລາວແບບມືອາຊີບ. ຫ້າມຕັດສິນອະນຸມັດ ຫຼື ປະຕິເສດແທນຄົນ.\n\nIMPORTANT:\n- AI PDF Summary Reader ສະຫຼຸບ key values ເທົ່ານັ້ນ.\n- Code ໄດ້ກວດ opening + deposits - withdrawals = closing.\n- User ໄດ້ confirm ຍອດຫຼັກແລ້ວ.\n\nStatement Info:\n${JSON.stringify(r.statement_info || {}, null, 2)}\n\nSummary Values:\n${JSON.stringify(r.summary_values || {}, null, 2)}\n\nSystem Validation:\n${JSON.stringify(v || {}, null, 2)}\n\nBehavior Summary:\n${JSON.stringify(r.behavior_summary || {}, null, 2)}\n\nRisk Flags:\n${(r.risk_flags || []).map(x=>'- '+x).join('\n') || '- ບໍ່ພົບ'}\n\nQuestions to Ask Customer:\n${(r.questions_to_ask_customer || []).map(x=>'- '+x).join('\n') || '- ກວດຢືນຢັນຍອດຫຼັກ'}\n\nຂໍໃຫ້ຂຽນ:\n1. ພາບລວມ statement\n2. ກະແສເງິນເຂົ້າ/ອອກ\n3. ຄວາມສະຖຽນຂອງລາຍຮັບ\n4. ພຶດຕິກຳການໃຊ້ບັນຊີ\n5. ຈຸດແຂງ\n6. ຈຸດສ່ຽງ\n7. ຄຳຖາມ/ເອກະສານຄວນຂໍເພີ່ມ\n8. ຂໍ້ຄວນກວດກ່ອນສົ່ງພິຈາລະນາ`;
  }

  function saveUrl(){ const u=$('pdfWorkerUrl')?.value?.trim(); if(!u) return msg('workerUrlMessage','ກະລຸນາໃສ່ Worker URL','error'); localStorage.setItem(KEY,u); msg('workerUrlMessage','ບັນທຶກ Worker URL ແລ້ວ','success'); }
  async function readPdf(){
    const file=$('pdfStatementFile')?.files?.[0], url=$('pdfWorkerUrl')?.value?.trim()||localStorage.getItem(KEY);
    if(!url) return msg('pdfSummaryMessage','ກະລຸນາໃສ່ Worker URL ແລະ Save ກ່ອນ','error');
    if(!file) return msg('pdfSummaryMessage','ກະລຸນາເລືອກ PDF','error');
    try{
      localStorage.setItem(KEY,url); $('readPdfBtn').disabled=true; msg('pdfSummaryMessage','AI ກຳລັງອ່ານ PDF... 30–90 ວິນາທີ','warning');
      const fd=new FormData(); fd.append('file',file); fd.append('mode','summary-only');
      const res=await fetch(url,{method:'POST',body:fd}); const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||data.message||'Worker/Gemini error');
      render(data.result); msg('pdfSummaryMessage','AI ອ່ານ PDF ແລ້ວ. ກວດຍອດຫຼັກກ່ອນ Generate Prompt.','success');
    }catch(e){ msg('pdfSummaryMessage',e.message||'ອ່ານ PDF ບໍ່ສຳເລັດ','error'); }
    finally{ if($('readPdfBtn')) $('readPdfBtn').disabled=false; }
  }
  function clearAll(){ currentResult=null; validation=null; if($('pdfStatementFile')) $('pdfStatementFile').value=''; ['pdfStatusPanel','pdfResultPanel','statementResultPanel'].forEach(id=>$(id)?.classList.add('hidden')); if($('statementPrompt')) $('statementPrompt').value=''; msg('pdfSummaryMessage',''); }

  $('savePdfWorkerUrlBtn')?.addEventListener('click', saveUrl);
  $('readPdfBtn')?.addEventListener('click', readPdf);
  $('clearPdfSummaryBtn')?.addEventListener('click', clearAll);
  $('confirmKeyTotals')?.addEventListener('change', e=>{ if($('generateMemoPromptBtn')) $('generateMemoPromptBtn').disabled=!e.target.checked; });
  $('generateMemoPromptBtn')?.addEventListener('click',()=>{ if(!currentResult||!validation) return; $('statementPrompt').value=buildPrompt(currentResult,validation); $('statementResultPanel')?.classList.remove('hidden'); $('statementResultPanel')?.scrollIntoView({behavior:'smooth'}); });
  $('copyStatementPromptBtn')?.addEventListener('click',async()=>{ const t=$('statementPrompt')?.value||''; if(t) { await navigator.clipboard.writeText(t); msg('statementCopyMessage','ຄັດລອກ Prompt ແລ້ວ','success'); }});
  const saved=localStorage.getItem(KEY); if(saved&&$('pdfWorkerUrl')) $('pdfWorkerUrl').value=saved;
})();
