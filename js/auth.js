const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const authMessage = document.getElementById('authMessage');

function setMessage(text, type = '') {
  authMessage.textContent = text;
  authMessage.className = `message ${type}`;
}

async function checkSession() {
  if (!supabaseClient) {
    setMessage('ກະລຸນາໃສ່ Supabase URL ແລະ Anon Key ໃນ js/config.js', 'warning');
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) window.location.href = 'app.html';
}

loginBtn.addEventListener('click', async () => {
  if (!supabaseClient) return setMessage('Supabase ຍັງບໍ່ຖືກ config', 'error');
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return setMessage('ກະລຸນາໃສ່ email ແລະ password', 'error');

  setMessage('ກຳລັງເຂົ້າລະບົບ...');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return setMessage(error.message, 'error');
  window.location.href = 'app.html';
});

signupBtn.addEventListener('click', async () => {
  if (!supabaseClient) return setMessage('Supabase ຍັງບໍ່ຖືກ config', 'error');
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return setMessage('ກະລຸນາໃສ່ email ແລະ password', 'error');
  if (password.length < 6) return setMessage('Password ຕ້ອງຢ່າງໜ້ອຍ 6 ຕົວ', 'error');

  setMessage('ກຳລັງສ້າງບັນຊີ...');
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return setMessage(error.message, 'error');
  setMessage('ສ້າງບັນຊີແລ້ວ. ຖ້າ Supabase ເປີດ email confirmation ໃຫ້ໄປຢືນຢັນ email ກ່ອນ.', 'success');
});

checkSession();
