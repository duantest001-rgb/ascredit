export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, corsHeaders);

    try {
      if (!env.GEMINI_API_KEY) return json({ ok: false, error: "Missing GEMINI_API_KEY secret." }, 500, corsHeaders);
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file.arrayBuffer !== "function") return json({ ok: false, error: "Missing PDF file." }, 400, corsHeaders);
      if (file.type && file.type !== "application/pdf") return json({ ok: false, error: "Only PDF is supported." }, 400, corsHeaders);
      const maxBytes = Number(env.MAX_PDF_BYTES || 18 * 1024 * 1024);
      if (file.size && file.size > maxBytes) return json({ ok: false, error: `PDF too large. Max ${Math.round(maxBytes/1024/1024)} MB.` }, 400, corsHeaders);

      const pdfBase64 = arrayBufferToBase64(await file.arrayBuffer());
      const model = env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const body = {
        contents: [{ parts: [
          { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
          { text: buildPrompt() }
        ]}],
        generationConfig: {
          temperature: 0,
          response_mime_type: "application/json",
          maxOutputTokens: Number(env.MAX_OUTPUT_TOKENS || 6000)
        }
      };
      const aiRes = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const aiRaw = await aiRes.text();
      let aiData = null;
      try { aiData = JSON.parse(aiRaw); } catch (e) {
        return json({ ok: false, error: "Gemini returned non-JSON error response", raw: aiRaw.slice(0, 1000) }, 502, corsHeaders);
      }
      if (!aiRes.ok) {
        const message = aiData?.error?.message || "Gemini API error";
        return json({ ok: false, error: message, details: aiData, model }, aiRes.status, corsHeaders);
      }
      const text = extractText(aiData);
      const parsed = safeParseJson(text);
      if (!parsed.ok) return json({ ok: false, error: "AI returned invalid JSON. Please retry or review manually.", raw: text }, 502, corsHeaders);
      const result = normalizeResult(parsed.value);
      result.calculation_check = recalcCheck(result);
      return json({ ok: true, result, usage: aiData.usageMetadata || null, model }, 200, corsHeaders);
    } catch (err) {
      return json({ ok: false, error: err?.message || "Unknown worker error" }, 500, corsHeaders);
    }
  }
};

function buildPrompt() {
  return `You are a Credit Statement Extraction Assistant for a Lao credit analysis web app.

Read the uploaded bank statement PDF and return ONLY compact structured JSON for credit analysis.

CRITICAL FINANCIAL SAFETY RULES:
1. Do not make approval or rejection decisions.
2. Do not extract all transaction rows.
3. Do not invent missing values.
4. If a value is unclear, return null and mark uncertainty through low confidence/risk flag.
5. Distinguish observed values from inferred values.
6. Provide confidence score 0-100 for each key value.
7. Always check whether Opening Balance + Total Deposits - Total Withdrawals is close to Closing Balance.
8. If arithmetic does not reconcile, flag it clearly.
9. Return JSON only. No markdown. No text outside JSON.
10. Prefer the official summary totals in the statement if available.
11. Amounts must be numbers without commas.
12. Use Lao language for risk_flags, questions_to_ask_customer, recommended_next_step, cash_withdrawal_behavior, income_stability, and reconciliation_note.

Return exactly this JSON schema:
{
  "statement_info": {
    "bank_name": "",
    "account_name": "",
    "account_number_masked": "",
    "currency": "LAK",
    "period_start": "",
    "period_end": "",
    "page_count": 0,
    "confidence": 0
  },
  "summary_values": {
    "opening_balance": null,
    "total_deposits": null,
    "total_withdrawals": null,
    "closing_balance": null,
    "estimated_transaction_count": null,
    "confidence": {
      "opening_balance": 0,
      "total_deposits": 0,
      "total_withdrawals": 0,
      "closing_balance": 0,
      "estimated_transaction_count": 0
    }
  },
  "calculation_check": {
    "formula": "opening_balance + total_deposits - total_withdrawals",
    "calculated_closing_balance": null,
    "reported_closing_balance": null,
    "difference": null,
    "is_reconciled": false,
    "reconciliation_note": ""
  },
  "behavior_summary": {
    "largest_deposits": [ {"date": "", "amount": null, "description": "", "confidence": 0} ],
    "largest_withdrawals": [ {"date": "", "amount": null, "description": "", "confidence": 0} ],
    "repeated_payment_patterns": [],
    "loan_or_bnpl_keywords_found": [],
    "cash_withdrawal_behavior": "",
    "income_stability": "",
    "unusual_transactions": []
  },
  "risk_flags": [],
  "questions_to_ask_customer": [],
  "overall_confidence": 0,
  "recommended_next_step": ""
}

Risk indicators: loan, repayment, installment, finance, BNPL, interest, ຜ່ອນ, ຊຳລະ, ກູ້, ດອກເບ້ຍ, ຄ່າງວດ, cash withdrawals, repeated transfers, unusual large deposits/withdrawals, unstable income, missing pages, unreadable scans.`;
}

function normalizeResult(r) {
  const out = {
    statement_info: {
      bank_name: str(r?.statement_info?.bank_name),
      account_name: str(r?.statement_info?.account_name),
      account_number_masked: maskAccount(str(r?.statement_info?.account_number_masked)),
      currency: str(r?.statement_info?.currency) || "LAK",
      period_start: str(r?.statement_info?.period_start),
      period_end: str(r?.statement_info?.period_end),
      page_count: number(r?.statement_info?.page_count),
      confidence: score(r?.statement_info?.confidence)
    },
    summary_values: {
      opening_balance: numberOrNull(r?.summary_values?.opening_balance),
      total_deposits: numberOrNull(r?.summary_values?.total_deposits),
      total_withdrawals: numberOrNull(r?.summary_values?.total_withdrawals),
      closing_balance: numberOrNull(r?.summary_values?.closing_balance),
      estimated_transaction_count: numberOrNull(r?.summary_values?.estimated_transaction_count),
      confidence: {
        opening_balance: score(r?.summary_values?.confidence?.opening_balance),
        total_deposits: score(r?.summary_values?.confidence?.total_deposits),
        total_withdrawals: score(r?.summary_values?.confidence?.total_withdrawals),
        closing_balance: score(r?.summary_values?.confidence?.closing_balance),
        estimated_transaction_count: score(r?.summary_values?.confidence?.estimated_transaction_count)
      }
    },
    calculation_check: {},
    behavior_summary: {
      largest_deposits: txList(r?.behavior_summary?.largest_deposits),
      largest_withdrawals: txList(r?.behavior_summary?.largest_withdrawals),
      repeated_payment_patterns: arr(r?.behavior_summary?.repeated_payment_patterns),
      loan_or_bnpl_keywords_found: arr(r?.behavior_summary?.loan_or_bnpl_keywords_found),
      cash_withdrawal_behavior: str(r?.behavior_summary?.cash_withdrawal_behavior),
      income_stability: str(r?.behavior_summary?.income_stability),
      unusual_transactions: arr(r?.behavior_summary?.unusual_transactions)
    },
    risk_flags: arr(r?.risk_flags),
    questions_to_ask_customer: arr(r?.questions_to_ask_customer),
    overall_confidence: score(r?.overall_confidence),
    recommended_next_step: str(r?.recommended_next_step)
  };
  if (!out.overall_confidence) {
    const vals = [out.statement_info.confidence, out.summary_values.confidence.opening_balance, out.summary_values.confidence.total_deposits, out.summary_values.confidence.total_withdrawals, out.summary_values.confidence.closing_balance].filter(Boolean);
    out.overall_confidence = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  }
  return out;
}

function recalcCheck(result) {
  const s = result.summary_values || {};
  const vals = [s.opening_balance, s.total_deposits, s.total_withdrawals, s.closing_balance];
  if (!vals.every(v => typeof v === "number" && Number.isFinite(v))) return { formula: "opening_balance + total_deposits - total_withdrawals", calculated_closing_balance: null, reported_closing_balance: s.closing_balance ?? null, difference: null, is_reconciled: false, reconciliation_note: "ບໍ່ສາມາດກວດສູດໄດ້ ເພາະຂາດຄ່າຫຼັກ" };
  const calculated = s.opening_balance + s.total_deposits - s.total_withdrawals;
  const diff = calculated - s.closing_balance;
  return { formula: "opening_balance + total_deposits - total_withdrawals", calculated_closing_balance: round2(calculated), reported_closing_balance: round2(s.closing_balance), difference: round2(diff), is_reconciled: Math.abs(diff) <= 1, reconciliation_note: Math.abs(diff) <= 1 ? "ຍອດສົມດຸນກັນຕາມສູດ" : "ຍອດບໍ່ສົມດຸນ ຄວນກວດ statement ແລະຜົນ AI ອີກຄັ້ງ" };
}

function extractText(d){ return (d?.candidates?.[0]?.content?.parts || []).map(p=>p.text||"").join("").trim(); }
function safeParseJson(text){ try { return {ok:true,value:JSON.parse(text)}; } catch(e){ const m=String(text||"").match(/\{[\s\S]*\}/); if(m){ try{return {ok:true,value:JSON.parse(m[0])};}catch(_){}} return {ok:false}; } }
function json(data,status=200,corsHeaders={}){ return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...corsHeaders}}); }
function arrayBufferToBase64(buffer){ let binary=""; const bytes=new Uint8Array(buffer); for(let i=0;i<bytes.length;i+=0x8000){ binary += String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000)); } return btoa(binary); }
function str(v){ return v == null ? "" : String(v).trim(); }
function number(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function numberOrNull(v){ if(v==null||v==="") return null; if(typeof v==="string") v=v.replace(/,/g,"").trim(); const n=Number(v); return Number.isFinite(n)?n:null; }
function arr(v){ if(Array.isArray(v)) return v; if(v==null||v==="") return []; return [String(v)]; }
function score(v){ const n=Number(v); return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):0; }
function round2(v){ return Math.round(Number(v)*100)/100; }
function maskAccount(s){ if(!s) return ""; const x=s.replace(/\s+/g,""); if(x.includes("*")||x.length<=6) return s; return x.slice(0,3)+"****"+x.slice(-3); }
function txList(v){ if(!Array.isArray(v)) return []; return v.slice(0,10).map(x=>({date:str(x?.date),amount:numberOrNull(x?.amount),description:str(x?.description),confidence:score(x?.confidence)})); }
