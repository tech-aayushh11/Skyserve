/**
 * SKYSERVE - MISSION CONTROL AUTHENTICATION CLIENT
 */

(function () {
  'use strict';

  // DOM Elements - Login View
  const panelLogin = document.getElementById('panel-login');
  const formLogin = document.getElementById('form-login');
  const inputUsername = document.getElementById('login-username');
  const inputPassword = document.getElementById('login-password');
  const btnTogglePwd = document.getElementById('btn-toggle-pwd');
  const btnLoginSubmit = document.getElementById('btn-login-submit');
  const loginBtnContent = document.getElementById('login-btn-content');
  const loginAlert = document.getElementById('login-alert');
  const loginAlertText = document.getElementById('login-alert-text');

  // DOM Elements - Change Password View
  const panelChange = document.getElementById('panel-change-password');
  const formChange = document.getElementById('form-change-password');
  const inputCpCurrent = document.getElementById('cp-current-password');
  const inputCpNew = document.getElementById('cp-new-password');
  const inputCpConfirm = document.getElementById('cp-confirm-password');
  const btnToggleNewPwd = document.getElementById('btn-toggle-new-pwd');
  const btnChangeSubmit = document.getElementById('btn-change-submit');
  const changeBtnContent = document.getElementById('change-btn-content');
  const changeAlert = document.getElementById('change-alert');
  const changeAlertText = document.getElementById('change-alert-text');

  // Password Policy Rules
  const ruleLength = document.getElementById('rule-length');
  const ruleUpper = document.getElementById('rule-upper');
  const ruleLower = document.getElementById('rule-lower');
  const ruleNumber = document.getElementById('rule-number');
  const ruleSymbol = document.getElementById('rule-symbol');

  // Check if session already exists
  async function checkExistingSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          if (data.mustChangePassword) {
            showChangePasswordPanel('');
          } else {
            window.location.replace('/');
          }
        }
      }
    } catch (e) {
      // Not authenticated or network error; proceed with login view
    }
  }
  checkExistingSession();

  // Helper: Show Alert
  function showLoginAlert(msg, type = 'error') {
    loginAlert.className = `auth-alert-box auth-alert-${type}`;
    loginAlertText.textContent = msg;
    loginAlert.style.display = 'flex';
  }

  function hideLoginAlert() {
    loginAlert.style.display = 'none';
  }

  function showChangeAlert(msg, type = 'error') {
    changeAlert.className = `auth-alert-box auth-alert-${type}`;
    changeAlertText.textContent = msg;
    changeAlert.style.display = 'flex';
  }

  function hideChangeAlert() {
    changeAlert.style.display = 'none';
  }

  // Toggle Password Visibility
  function setupPasswordToggle(button, input) {
    if (!button || !input) return;
    button.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const eyeOpen = button.querySelector('.eye-open');
      const eyeClosed = button.querySelector('.eye-closed');
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isPassword ? 'none' : 'block';
        eyeClosed.style.display = isPassword ? 'block' : 'none';
      }
    });
  }

  setupPasswordToggle(btnTogglePwd, inputPassword);
  setupPasswordToggle(btnToggleNewPwd, inputCpNew);

  // Switch to Change Password Panel
  function showChangePasswordPanel(prefillPassword) {
    panelLogin.style.display = 'none';
    panelChange.style.display = 'block';
    if (prefillPassword) {
      inputCpCurrent.value = prefillPassword;
    }
    inputCpNew.focus();
    showChangeAlert('Credential rotation required before accessing Mission Control.', 'info');
  }

  // Real-Time Password Policy Feedback
  function validatePolicy(val) {
    const checks = {
      length: val.length >= 10,
      upper: /[A-Z]/.test(val),
      lower: /[a-z]/.test(val),
      number: /[0-9]/.test(val),
      symbol: /[^A-Za-z0-9]/.test(val)
    };

    updateRuleItem(ruleLength, checks.length);
    updateRuleItem(ruleUpper, checks.upper);
    updateRuleItem(ruleLower, checks.lower);
    updateRuleItem(ruleNumber, checks.number);
    updateRuleItem(ruleSymbol, checks.symbol);

    return Object.values(checks).every(Boolean);
  }

  function updateRuleItem(el, isValid) {
    if (!el) return;
    if (isValid) {
      el.classList.add('valid');
      el.querySelector('svg').innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    } else {
      el.classList.remove('valid');
      el.querySelector('svg').innerHTML = '<circle cx="12" cy="12" r="10"></circle>';
    }
  }

  inputCpNew.addEventListener('input', () => {
    validatePolicy(inputCpNew.value);
  });

  // Handle Login Form Submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideLoginAlert();

    const username = inputUsername.value.trim();
    const password = inputPassword.value;

    if (!username || !password) {
      showLoginAlert('Please enter both username and password.');
      return;
    }

    // Set Loading State
    btnLoginSubmit.disabled = true;
    loginBtnContent.innerHTML = '<span class="btn-spinner"></span> VERIFYING CREDENTIALS...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showLoginAlert(data.error || 'Authentication rejected by security perimeter.');
        btnLoginSubmit.disabled = false;
        loginBtnContent.textContent = 'AUTHENTICATE MISSION CONTROL';
        inputPassword.value = '';
        inputPassword.focus();
        return;
      }

      // Check if user must rotate temporary password
      if (data.user && data.user.mustChangePassword) {
        showChangePasswordPanel(password);
      } else {
        loginBtnContent.textContent = 'AUTHENTICATED. ACCESSING...';
        window.location.replace('/');
      }
    } catch (err) {
      showLoginAlert('Security network error. Please verify server connection.');
      btnLoginSubmit.disabled = false;
      loginBtnContent.textContent = 'AUTHENTICATE MISSION CONTROL';
    }
  });

  // Handle Change Password Form Submit
  formChange.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideChangeAlert();

    const currentPassword = inputCpCurrent.value;
    const newPassword = inputCpNew.value;
    const confirmPassword = inputCpConfirm.value;

    if (!currentPassword) {
      showChangeAlert('Please enter your current/temporary password.');
      return;
    }

    if (!validatePolicy(newPassword)) {
      showChangeAlert('New passphrase does not satisfy all security criteria.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showChangeAlert('Passphrase confirmation does not match.');
      return;
    }

    if (newPassword === currentPassword) {
      showChangeAlert('New passphrase cannot be identical to the temporary password.');
      return;
    }

    btnChangeSubmit.disabled = true;
    changeBtnContent.innerHTML = '<span class="btn-spinner"></span> UPDATING CREDENTIALS...';

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        showChangeAlert(data.error || 'Passphrase update failed.');
        btnChangeSubmit.disabled = false;
        changeBtnContent.textContent = 'ROTATE PASSPHRASE & ENTER MISSION CONTROL';
        return;
      }

      showChangeAlert('Passphrase updated successfully. Initializing Mission Control...', 'success');
      setTimeout(() => {
        window.location.replace('/');
      }, 750);
    } catch (err) {
      showChangeAlert('Network error while updating credentials.');
      btnChangeSubmit.disabled = false;
      changeBtnContent.textContent = 'ROTATE PASSPHRASE & ENTER MISSION CONTROL';
    }
  });
})();
