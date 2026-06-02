const $ = (id) => document.getElementById(id);

const form = $('leadForm');
const leadTable = $('leadTable');
const saveMessage = $('saveMessage');
let lastAnalysis = null;

function money(value) {
  return Number(value || 0).toLocaleString('en-US') + ' LAK';
}

function numberValue(id) {
  return Number($(id).value || 0);
}

function calculateMonthlyPayment(principal, annualRate, months) {
  if (!principal || !months) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

function scoreCase(input) {
  let score = 0;
  const notes = [];

  if (input.monthlyIncome > 0) score += 20; else notes.push('ບໍ່ມີຫຼັກຖານລາຍຮັບ');

  const expenseRatio = input.monthlyIncome ? input.monthlyExpense / input.monthlyIncome : 1;
  if (expenseRatio <= 0.5) score += 15;
  else if (expenseRatio <= 0.7) score += 8;
  else notes.push('ລາຍຈ່າຍສູງທຽບກັບລາຍຮັບ');

  const oldDebtRatio = input.monthlyIncome ? input.existingDebtPayment / input.monthlyIncome : 1;
  if (oldDebtRatio <= 0.2) score += 15;
  else if (oldDebtRatio <= 0.35) score += 8;
  else notes.push('ພາລະໜີ້ເກົ່າສູງ');

  if (['Working Capital', 'Business Expansion', 'Home Repair', 'Vehicle'].includes(input.loanPurpose)) score += 15;
  else if (input.loanPurpose === 'Emergency') score += 8;
  else if (input.loanPurpose === 'Debt Refinance') notes.push('ກູ້ເພື່ອ refinance ຫຼື ປິດໜີ້ ຕ້ອງກວດເລິກ');

  if (input.documents === 'Complete') score += 15;
  else if (input.documents === 'Partial') score += 8;
  else notes.push('ເອກະສານຍັງບໍ່ຄົບ');

  if (input.creditHistory === 'Good') score += 10;
  else if (input.creditHistory === 'Unknown') score += 5;
  else notes.push('ປະຫວັດຈ່າຍຊ້າ ຫຼື ບໍ່ດີ');

  if (input.collateral === 'Yes') score += 10;
  else notes.push('ບໍ່ມີຫຼັກຊັບ/ຜູ້ຄ້ຳ');

  return { score, notes };
}

function riskFromScore(score, debtRatio) {
  if (score >= 80 && debtRatio <= 0.5) return { level: 'Low Risk', recommendation: 'ຜ່ານ pre-screen ໄດ້. ສາມາດສົ່ງຕໍ່ກວດເອກະສານ/ພິຈາລະນາ.' };
  if (score >= 60 && debtRatio <= 0.65) return { level: 'Medium Risk', recommendation: 'ພໍໄດ້ ແຕ່ຄວນຂໍເອກະສານ ແລະ ກວດ cash flow ເພີ່ມ.' };
  if (score >= 40) return { level: 'High Risk', recommendation: 'ສ່ຽງ. ຢ່າຟ້າວດັນ case ຈົນກວ່າຈະກວດລາຍຮັບ, ໜີ້ເກົ່າ ແລະ ຈຸດປະສົງກູ້ໃຫ້ຊັດ.' };
  return { level: 'Very High Risk', recommendation: 'ບໍ່ຄວນດັນໃນຂັ້ນນີ້. ຂໍຂໍ້ມູນໃໝ່ ຫຼື ປະຕິເສດແບບສຸພາບ.' };
}

function buildAiPrompt(input, analysis) {
  return `ເຈົ້າແມ່ນ Credit Analysis Assistant. ກະລຸນາວິເຄາະ case ນີ້ເປັນພາສາລາວແບບມືອາຊີບ ໂດຍບໍ່ຕັດສິນອະນຸມັດແທນຄົນ.

ຂໍ້ມູນລູກຄ້າ:
- ຊື່: ${input.customerName}
- ອາຊີບ: ${input.occupation}
- ຈຸດປະສົງກູ້: ${input.loanPurpose}
- ລາຍຮັບ/ເດືອນ: ${money(input.monthlyIncome)}
- ລາຍຈ່າຍ/ເດືອນ: ${money(input.monthlyExpense)}
- ໜີ້ເກົ່າ/ເດືອນ: ${money(input.existingDebtPayment)}
- ວົງເງິນຂໍກູ້: ${money(input.loanAmount)}
- ຄ່າງວດປະມານ: ${money(analysis.monthlyPayment)}
- Debt Burden: ${(analysis.debtRatio * 100).toFixed(1)}%
- Score: ${analysis.score}/100
- Risk Level: ${analysis.riskLevel}
- ເອກະສານ: ${input.documents}
- ຫຼັກຊັບ/ຜູ້ຄ້ຳ: ${input.collateral}
- ປະຫວັດກູ້ເກົ່າ: ${input.creditHistory}

ຂໍໃຫ້ສະຫຼຸບ 5 ສ່ວນ:
1) ພາບລວມ case
2) ຈຸດແຂງ
3) ຈຸດສ່ຽງ
4) ເອກະສານ/ຄຳຖາມທີ່ຄວນຂໍເພີ່ມ
5) ຄຳແນະນຳຕໍ່ໄປສຳລັບພະນັກງານສິນເຊື່ອ`;
}

function collectInput() {
  return {
    customerName: $('customerName').value.trim(),
    phone: $('phone').value.trim(),
    occupation: $('occupation').value,
    loanPurpose: $('loanPurpose').value,
    monthlyIncome: numberValue('monthlyIncome'),
    monthlyExpense: numberValue('monthlyExpense'),
    existingDebtPayment: numberValue('existingDebtPayment'),
    loanAmount: numberValue('loanAmount'),
    annualRate: numberValue('annualRate'),
    termMonths: numberValue('termMonths'),
    collateral: $('collateral').value,
    creditHistory: $('creditHistory').value,
    documents: $('documents').value,
    status: $('status').value,
    note: $('note').value.trim(),
  };
}

function analyze(input) {
  const monthlyPayment = calculateMonthlyPayment(input.loanAmount, input.annualRate, input.termMonths);
  const cashAvailable = input.monthlyIncome - input.monthlyExpense - input.existingDebtPayment;
  const debtRatio = input.monthlyIncome ? (input.existingDebtPayment + monthlyPayment) / input.monthlyIncome : 1;
  const { score, notes } = scoreCase(input);
  const risk = riskFromScore(score, debtRatio);
  return { monthlyPayment, cashAvailable, debtRatio, score, riskLevel: risk.level, recommendation: risk.recommendation, notes };
}

function renderAnalysis(input, analysis) {
  $('monthlyPayment').textContent = money(analysis.monthlyPayment.toFixed(0));
  $('cashAvailable').textContent = money(analysis.cashAvailable.toFixed(0));
  $('debtRatio').textContent = `${(analysis.debtRatio * 100).toFixed(1)}%`;
  $('score').textContent = `${analysis.score}/100`;
  $('riskBox').textContent = analysis.riskLevel;
  $('riskBox').className = `risk-box ${analysis.riskLevel.toLowerCase().replaceAll(' ', '-')}`;
  $('recommendation').textContent = analysis.recommendation + (analysis.notes.length ? ' ຈຸດລະວັງ: ' + analysis.notes.join(', ') : '');
  $('aiPrompt').value = buildAiPrompt(input, analysis);
}

async function requireSession() {
  if (!supabaseClient) {
    alert('ກະລຸນາໃສ່ Supabase URL ແລະ Anon Key ໃນ js/config.js');
    window.location.href = 'index.html';
    return null;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) window.location.href = 'index.html';
  return data.session;
}

async function saveLead(input, analysis) {
  const row = {
    customer_name: input.customerName,
    phone: input.phone,
    occupation: input.occupation,
    loan_purpose: input.loanPurpose,
    monthly_income: input.monthlyIncome,
    monthly_expense: input.monthlyExpense,
    existing_debt_payment: input.existingDebtPayment,
    loan_amount: input.loanAmount,
    annual_rate: input.annualRate,
    term_months: input.termMonths,
    collateral: input.collateral,
    credit_history: input.creditHistory,
    documents: input.documents,
    status: input.status,
    note: input.note,
    monthly_payment: Math.round(analysis.monthlyPayment),
    cash_available: Math.round(analysis.cashAvailable),
    debt_ratio: analysis.debtRatio,
    score: analysis.score,
    risk_level: analysis.riskLevel,
    recommendation: analysis.recommendation,
    ai_prompt: buildAiPrompt(input, analysis)
  };

  const { error } = await supabaseClient.from('credit_leads').insert(row);
  if (error) throw error;
}

async function loadLeads() {
  const { data, error } = await supabaseClient
    .from('credit_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  leadTable.innerHTML = data.map(row => `
    <tr>
      <td>${new Date(row.created_at).toLocaleDateString()}</td>
      <td>${row.customer_name || ''}</td>
      <td>${row.phone || ''}</td>
      <td>${row.occupation || ''}</td>
      <td>${money(row.loan_amount)}</td>
      <td>${row.score || 0}</td>
      <td>${row.risk_level || ''}</td>
      <td>${row.status || ''}</td>
    </tr>
  `).join('');

  $('totalLeads').textContent = data.length;
  $('passedLeads').textContent = data.filter(x => x.risk_level === 'Low Risk' || x.status === 'Pre-screen Passed').length;
  $('highRiskLeads').textContent = data.filter(x => x.risk_level === 'High Risk' || x.risk_level === 'Very High Risk').length;
  const avg = data.length ? data.reduce((s, x) => s + Number(x.score || 0), 0) / data.length : 0;
  $('avgScore').textContent = avg.toFixed(0);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveMessage.textContent = '';
  const input = collectInput();
  if (!input.customerName) return saveMessage.textContent = 'ກະລຸນາໃສ່ຊື່ລູກຄ້າ';
  const analysis = analyze(input);
  lastAnalysis = analysis;
  renderAnalysis(input, analysis);

  try {
    await saveLead(input, analysis);
    saveMessage.textContent = 'ບັນທຶກສຳເລັດ';
    saveMessage.className = 'message success';
    await loadLeads();
  } catch (err) {
    saveMessage.textContent = err.message;
    saveMessage.className = 'message error';
  }
});

['monthlyIncome','monthlyExpense','existingDebtPayment','loanAmount','annualRate','termMonths','loanPurpose','documents','creditHistory','collateral'].forEach(id => {
  $(id).addEventListener('input', () => {
    const input = collectInput();
    if (input.monthlyIncome && input.loanAmount) {
      const analysis = analyze(input);
      lastAnalysis = analysis;
      renderAnalysis(input, analysis);
    }
  });
});

$('resetBtn').addEventListener('click', () => { form.reset(); $('annualRate').value = 18; $('termMonths').value = 24; });
$('copyPromptBtn').addEventListener('click', async () => { await navigator.clipboard.writeText($('aiPrompt').value); });
$('refreshBtn').addEventListener('click', loadLeads);
$('logoutBtn').addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; });

requireSession().then((session) => { if (session) loadLeads(); });
