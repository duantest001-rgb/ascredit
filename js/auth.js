const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const authMessage = document.getElementById('authMessage');
const authForm = document.getElementById('authForm');
const togglePassword = document.getElementById('togglePassword');

function setMessage(text, type = '') {
  authMessage.textContent = text;
  authMessage.className = `message ${type}`;
}

function setLoading(isLoading, text = '') {
  loginBtn.disabled = isLoading;
  signupBtn.disabled = isLoading;
  if (text) setMessage(text);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function friendlyAuthError(error) {
  const msg = (error?.message || '').toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ';
  }
  if (msg.includes('email not confirmed') || msg.includes('confirm')) {
    return 'ບັນຊີນີ້ຍັງບໍ່ໄດ້ຢືນຢັນ email. ກະລຸນາໄປກົດ link ໃນ email ກ່ອນ';
  }
  if (msg.includes('already registered') || msg.includes('user already')) {
    return 'ອີເມວນີ້ມີບັນຊີແລ້ວ. ກະລຸນາກົດເຂົ້າລະບົບ';
  }
  if (msg.includes('password') && (msg.includes('short') || msg.includes('weak'))) {
    return 'ລະຫັດຜ່ານສັ້ນ ຫຼື ງ່າຍເກີນໄປ. ໃຫ້ໃສ່ຢ່າງໜ້ອຍ 6 ຕົວ';
  }
  if (msg.includes('invalid email')) {
    return 'ຮູບແບບອີເມວບໍ່ຖືກຕ້ອງ';
  }
  if (msg.includes('rate limit')) {
    return 'ລອງຫຼາຍເກີນໄປ. ກະລຸນາລໍຖ້າຈັກໜ່ອຍແລ້ວລອງໃໝ່';
  }
  return error?.message || 'ມີບັນຫາ ກະລຸນາລອງໃໝ່';
}

function validateInputs() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email) throw new Error('ກະລຸນາໃສ່ອີເມວ');
  if (!isValidEmail(email)) throw new Error('ຮູບແບບອີເມວບໍ່ຖືກຕ້ອງ');
  if (!password) throw new Error('ກະລຸນາໃສ່ລະຫັດຜ່ານ');

  return { email, password };
}

async function checkSession() {
  if (!supabaseClient) {
    setMessage('ກະລຸນາໃສ່ Supabase URL ແລະ Anon Key ໃນ js/config.js', 'warning');
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) window.location.href = 'app.html';
}

async function login() {
  if (!supabaseClient) return setMessage('Supabase ຍັງບໍ່ຖືກ config', 'error');

  try {
    const { email, password } = validateInputs();
    setLoading(true, 'ກຳລັງເຂົ້າລະບົບ...');

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    setMessage('ເຂົ້າລະບົບສຳເລັດ ກຳລັງເປີດໜ້າຫຼັກ...', 'success');
    window.location.href = 'app.html';
  } catch (error) {
    setMessage(friendlyAuthError(error), 'error');
  } finally {
    setLoading(false);
  }
}

async function signup() {
  if (!supabaseClient) return setMessage('Supabase ຍັງບໍ່ຖືກ config', 'error');

  try {
    const { email, password } = validateInputs();
    if (password.length < 6) throw new Error('ລະຫັດຜ່ານຕ້ອງຢ່າງໜ້ອຍ 6 ຕົວ');

    setLoading(true, 'ກຳລັງສ້າງບັນຊີ...');
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;

    setMessage('ສ້າງບັນຊີແລ້ວ. ຖ້າ Supabase ເປີດ email confirmation ໃຫ້ໄປຢືນຢັນ email ກ່ອນ.', 'success');
  } catch (error) {
    setMessage(friendlyAuthError(error), 'error');
  } finally {
    setLoading(false);
  }
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  login();
});

signupBtn.addEventListener('click', signup);

togglePassword.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  togglePassword.textContent = isHidden ? 'ເຊື່ອງ' : 'ສະແດງ';
  togglePassword.setAttribute('aria-label', isHidden ? 'ເຊື່ອງລະຫັດ' : 'ສະແດງລະຫັດ');
});

checkSession();
