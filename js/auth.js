/* ============================================
   KKPL – Auth (Login Page)
   ============================================ */

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
  document.querySelectorAll('.login-form').forEach((form) => form.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

async function login(e, type) {
  e.preventDefault();
  const prefix = type === 'admin' ? 'admin' : 'team';
  const email = document.getElementById(`${prefix}-email`).value.trim();
  const password = document.getElementById(`${prefix}-password`).value;
  const errorEl = document.getElementById(`${prefix}-error`);

  try {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, type })
    });
    setSession(result.user);
    window.location.href = type === 'admin' ? 'admin.html' : 'team.html';
  } catch (error) {
    errorEl.textContent = error.message;
    setTimeout(() => { errorEl.textContent = ''; }, 4000);
  }
}

function adminLogin(e) { return login(e, 'admin'); }
function teamLogin(e) { return login(e, 'team'); }

(async function redirectSignedInUser() {
  try {
    const user = await initData();
    if (user) window.location.href = user.type === 'admin' ? 'admin.html' : 'team.html';
  } catch (error) {
    showRequestError(error);
  }
})();
