/**
 * SKYSERVE - AUTHENTICATION GUARD & ADMIN CONTROL PANEL
 * Handles session validation, profile dropdown, user administration,
 * password rotation modals, and audit logging.
 */

(function () {
  'use strict';

  const SkyserveAdmin = {
    currentUser: null,
    usersCache: [],
    auditCache: [],

    // -------------------------------------------------------------------------
    // 1. INITIALIZATION & SESSION GUARD
    // -------------------------------------------------------------------------
    init: async function () {
      // Global 401 interceptor for expired sessions
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (response.status === 401 && !String(args[0]).includes('/api/auth/login') && !String(args[0]).includes('/api/auth/me')) {
          alert('Session expired. Redirecting to mission login...');
          window.location.replace('/login.html');
        }
        return response;
      };

      const splash = document.getElementById('mc-auth-splash');
      const shield = document.getElementById('auth-shield');
      const appRoot = document.getElementById('app-root');

      try {
        const res = await originalFetch('/api/auth/me');
        if (!res.ok) {
          window.location.replace('/login.html');
          return;
        }

        const user = await res.json();
        this.currentUser = user;

        // Sync with legacy SkyserveState
        if (window.SkyserveState) {
          window.SkyserveState.currentUser.name = user.name;
          window.SkyserveState.currentUser.role = user.role;
          window.SkyserveState.currentUser.username = user.username;
          window.SkyserveState.currentUser.id = user.id;
        }

        // Render profile in header
        this.renderHeaderProfile(user);

        // Configure RBAC visibility
        this.configureRbac(user.role);

        // Reveal the application
        if (shield) shield.remove();
        if (appRoot) {
          appRoot.style.opacity = '1';
          appRoot.style.pointerEvents = 'auto';
        }
        if (splash) {
          splash.style.transition = 'opacity 0.25s ease';
          splash.style.opacity = '0';
          setTimeout(() => splash.remove(), 260);
        }

        // Setup event handlers for dropdown and modals
        this.setupEventListeners();

        // Check if user is forced to change password
        if (user.mustChangePassword) {
          this.openChangePasswordModal(true);
        }

        // If admin and in admin view, load data
        if (user.role === 'ADMIN') {
          this.loadAdminData();
        }
      } catch (err) {
        console.error('[SKYSERVE-AUTH] Session verification error:', err);
        window.location.replace('/login.html');
      }
    },

    // -------------------------------------------------------------------------
    // 2. HEADER PROFILE & RBAC DISPLAY
    // -------------------------------------------------------------------------
    renderHeaderProfile: function (user) {
      const nameEl = document.getElementById('header-user-name');
      const roleEl = document.getElementById('header-user-role');
      const avatarEl = document.getElementById('header-user-avatar');

      const dropNameEl = document.getElementById('dropdown-user-fullname');
      const dropHandleEl = document.getElementById('dropdown-user-handle');
      const dropRoleEl = document.getElementById('dropdown-user-role-badge');

      // Compute Initials
      const parts = (user.name || user.username).trim().split(/\s+/);
      let initials = parts[0] ? parts[0][0].toUpperCase() : 'U';
      if (parts.length > 1) {
        initials += parts[parts.length - 1][0].toUpperCase();
      }

      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl) nameEl.textContent = user.name;
      if (roleEl) roleEl.textContent = user.role;

      if (dropNameEl) dropNameEl.textContent = user.name;
      if (dropHandleEl) dropHandleEl.textContent = `@${user.username}`;
      if (dropRoleEl) {
        dropRoleEl.textContent = user.role;
        dropRoleEl.className = user.role === 'ADMIN' ? 'badge-role-admin' : 'badge-role-user';
      }
    },

    configureRbac: function (role) {
      const isAdmin = role === 'ADMIN';

      // Sidebar Admin Link
      const sidebarAdmin = document.getElementById('sidebar-item-admin');
      if (sidebarAdmin) {
        sidebarAdmin.style.display = isAdmin ? 'block' : 'none';
      }

      // Dropdown Admin Link
      const dropdownAdmin = document.getElementById('dropdown-item-admin');
      if (dropdownAdmin) {
        dropdownAdmin.style.display = isAdmin ? 'block' : 'none';
      }

      // Hide or disable mock role cards if they exist
      const mockRoleCards = document.querySelectorAll('.auth-role-card');
      mockRoleCards.forEach(c => {
        c.style.pointerEvents = 'none';
        c.style.cursor = 'default';
      });

      // Hook into view switching to protect admin view from non-admins
      if (window.SkyserveApp) {
        const originalSwitch = window.SkyserveApp.switchView.bind(window.SkyserveApp);
        window.SkyserveApp.switchView = (viewName) => {
          if (viewName === 'admin' && this.currentUser && this.currentUser.role !== 'ADMIN') {
            alert('Access Denied: Administrative privileges required.');
            return;
          }
          originalSwitch(viewName);
          if (viewName === 'admin') {
            this.loadAdminData();
          }
        };
      }
    },

    // -------------------------------------------------------------------------
    // 3. UI EVENT LISTENERS
    // -------------------------------------------------------------------------
    setupEventListeners: function () {
      const pill = document.getElementById('role-profile-pill');
      const dropdown = document.getElementById('user-profile-dropdown');
      const btnLogout = document.getElementById('btn-header-logout');
      const btnChangePwd = document.getElementById('btn-open-change-pwd');
      const btnAdminNav = document.getElementById('dropdown-btn-admin');

      // Toggle dropdown
      if (pill && dropdown) {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const isShown = dropdown.style.display === 'block';
          dropdown.style.display = isShown ? 'none' : 'block';
        });

        document.addEventListener('click', (e) => {
          if (!dropdown.contains(e.target) && !pill.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        });
      }

      // Dropdown Admin Button
      if (btnAdminNav) {
        btnAdminNav.addEventListener('click', () => {
          if (dropdown) dropdown.style.display = 'none';
          if (window.SkyserveApp) window.SkyserveApp.switchView('admin');
        });
      }

      // Logout Button
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
          } finally {
            window.location.replace('/login.html');
          }
        });
      }

      // Open Change Password Modal (Voluntary)
      if (btnChangePwd) {
        btnChangePwd.addEventListener('click', () => {
          if (dropdown) dropdown.style.display = 'none';
          this.openChangePasswordModal(false);
        });
      }

      // Modal close buttons
      document.querySelectorAll('.modal-close-btn, .btn-modal-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const overlay = e.target.closest('.mc-modal-overlay');
          if (overlay && !overlay.classList.contains('modal-mandatory')) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
            overlay.classList.remove('modal-active');
          }
        });
      });

      // Admin Action: Open Create User Modal
      const btnOpenCreate = document.getElementById('btn-admin-open-create');
      if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', () => {
          this.openCreateUserModal();
        });
      }

      // Admin Action: Refresh Data
      const btnRefresh = document.getElementById('btn-admin-refresh');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
          this.loadAdminData();
        });
      }

      // Create User Form
      const formCreate = document.getElementById('form-admin-create-user');
      if (formCreate) {
        formCreate.addEventListener('submit', (e) => this.handleCreateUser(e));
      }

      // App Change Password Form
      const formChangePwd = document.getElementById('form-modal-change-password');
      if (formChangePwd) {
        const newPwdInput = document.getElementById('modal-cp-new-password');
        if (newPwdInput) {
          newPwdInput.addEventListener('input', () => {
            this.validateModalPolicy(newPwdInput.value);
          });
        }
        formChangePwd.addEventListener('submit', (e) => this.handleChangePassword(e));
      }

      // Copy Credentials Button
      const btnCopyCreds = document.getElementById('btn-copy-temp-creds');
      if (btnCopyCreds) {
        btnCopyCreds.addEventListener('click', () => {
          const valEl = document.getElementById('temp-cred-pass-val');
          if (valEl) {
            navigator.clipboard.writeText(valEl.textContent.trim()).then(() => {
              btnCopyCreds.textContent = 'COPIED TO CLIPBOARD';
              setTimeout(() => { btnCopyCreds.textContent = 'COPY PASSPHRASE'; }, 2000);
            });
          }
        });
      }
    },

    // -------------------------------------------------------------------------
    // 4. ADMIN DATA FETCH & RENDERING
    // -------------------------------------------------------------------------
    loadAdminData: async function () {
      if (!this.currentUser || this.currentUser.role !== 'ADMIN') return;

      try {
        const [usersRes, auditRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/audit')
        ]);

        if (usersRes.status === 401 || auditRes.status === 401) {
          window.location.replace('/login.html');
          return;
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          this.usersCache = data.users || [];
          this.renderUsersTable(this.usersCache);
          this.updateStats(this.usersCache, this.auditCache);
        }

        if (auditRes.ok) {
          const data = await auditRes.json();
          this.auditCache = data.audit || [];
          this.renderAuditTable(this.auditCache);
          this.updateStats(this.usersCache, this.auditCache);
        }
      } catch (err) {
        console.error('[SKYSERVE-ADMIN] Failed loading administrative records:', err);
      }
    },

    updateStats: function (users, audit) {
      const totalUsersEl = document.getElementById('stat-total-users');
      const totalAdminsEl = document.getElementById('stat-total-admins');
      const totalStandardEl = document.getElementById('stat-total-standard');
      const totalAuditEl = document.getElementById('stat-total-audit');

      if (totalUsersEl) totalUsersEl.textContent = users.length;
      if (totalAdminsEl) totalAdminsEl.textContent = users.filter(u => u.role === 'ADMIN').length;
      if (totalStandardEl) totalStandardEl.textContent = users.filter(u => u.role === 'USER').length;
      if (totalAuditEl) totalAuditEl.textContent = audit.length;
    },

    renderUsersTable: function (users) {
      const tbody = document.getElementById('admin-users-tbody');
      if (!tbody) return;

      const activeAdminsCount = users.filter(u => u.role === 'ADMIN' && !u.disabled).length;
      const myId = this.currentUser ? this.currentUser.id : null;

      tbody.innerHTML = users.map(user => {
        const isSelf = user.id === myId;
        const isLastAdmin = user.role === 'ADMIN' && activeAdminsCount <= 1;

        const roleBadge = user.role === 'ADMIN'
          ? '<span class="badge-role-admin">ADMIN</span>'
          : '<span class="badge-role-user">USER</span>';

        const statusBadge = user.disabled
          ? '<span class="badge-status-disabled"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> SUSPENDED</span>'
          : '<span class="badge-status-active"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> ACTIVE</span>';

        const credsBadge = user.mustChangePassword
          ? '<span class="badge-pill-cyan" style="color:var(--amber-warning); border-color:rgba(255,179,0,0.4);">ROTATION REQUIRED</span>'
          : '<span style="color:var(--text-muted); font-size:11px;">Validated</span>';

        const lastLoginStr = user.lastLogin
          ? new Date(user.lastLogin).toLocaleString()
          : '<span style="color:var(--text-dim);">Never</span>';

        // Action Buttons
        const disableBtnTitle = isSelf ? 'Cannot disable self' : (isLastAdmin && !user.disabled ? 'Cannot disable last active admin' : '');
        const disableDisabled = (isSelf || (isLastAdmin && !user.disabled)) ? 'disabled' : '';

        const deleteBtnTitle = isSelf ? 'Cannot delete self' : (isLastAdmin ? 'Cannot delete last admin' : '');
        const deleteDisabled = (isSelf || isLastAdmin) ? 'disabled' : '';

        return `
          <tr>
            <td>
              <div style="font-weight: 600; color: #fff;">${this.escapeHtml(user.name)} ${isSelf ? '<span style="color:var(--cyan-primary); font-size:10px;">(YOU)</span>' : ''}</div>
              <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">@${this.escapeHtml(user.username)}</div>
            </td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${credsBadge}</td>
            <td style="font-family: var(--font-mono); font-size: 11px;">${lastLoginStr}</td>
            <td>
              <div class="admin-action-row">
                <button 
                  class="btn btn-secondary btn-sm" 
                  onclick="window.SkyserveAdmin.promptResetPassword('${user.id}', '${this.escapeHtml(user.username)}')"
                  title="Generate new temporary passphrase"
                >
                  Reset Pwd
                </button>
                <button 
                  class="btn btn-secondary btn-sm" 
                  ${disableDisabled}
                  title="${disableBtnTitle || (user.disabled ? 'Re-activate account' : 'Suspend account')}"
                  onclick="window.SkyserveAdmin.toggleUserDisabled('${user.id}', ${!user.disabled})"
                >
                  ${user.disabled ? 'Enable' : 'Disable'}
                </button>
                <button 
                  class="btn btn-danger btn-sm" 
                  ${deleteDisabled}
                  title="${deleteBtnTitle || 'Permanently delete account'}"
                  onclick="window.SkyserveAdmin.promptDeleteUser('${user.id}', '${this.escapeHtml(user.username)}')"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    },

    renderAuditTable: function (audit) {
      const tbody = document.getElementById('admin-audit-tbody');
      if (!tbody) return;

      tbody.innerHTML = audit.slice(0, 100).map(item => {
        const isSuccess = item.outcome === 'SUCCESS';
        const outcomeBadge = isSuccess
          ? '<span style="color: var(--green-ready); font-family: var(--font-mono); font-size: 10px;">SUCCESS</span>'
          : '<span style="color: var(--red-critical); font-family: var(--font-mono); font-size: 10px;">FAIL</span>';

        let eventColor = 'var(--cyan-primary)';
        if (item.event.includes('FAIL') || item.event.includes('DELETED') || item.event.includes('BLOCKED')) {
          eventColor = 'var(--red-critical)';
        } else if (item.event.includes('RESET') || item.event.includes('DISABLED')) {
          eventColor = 'var(--amber-warning)';
        }

        const dateStr = new Date(item.timestamp).toLocaleString();

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 11px; white-space: nowrap;">${dateStr}</td>
            <td>
              <span style="font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; color: ${eventColor};">
                ${this.escapeHtml(item.event)}
              </span>
            </td>
            <td style="font-family: var(--font-mono); font-size: 11px; color: #fff;">@${this.escapeHtml(item.username)}</td>
            <td style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">${this.escapeHtml(item.actor)}</td>
            <td style="font-family: var(--font-mono); font-size: 11px;">${this.escapeHtml(item.ip)}</td>
            <td>${outcomeBadge}</td>
            <td style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(item.details)}</td>
          </tr>
        `;
      }).join('');
    },

    // -------------------------------------------------------------------------
    // 5. USER CREATION & CREDENTIAL REVEAL
    // -------------------------------------------------------------------------
    openCreateUserModal: function () {
      const modal = document.getElementById('modal-create-user');
      const errBox = document.getElementById('modal-create-alert');
      const form = document.getElementById('form-admin-create-user');
      if (errBox) errBox.style.display = 'none';
      if (form) form.reset();
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        modal.classList.add('modal-active');
      }
    },

    handleCreateUser: async function (e) {
      e.preventDefault();
      const errBox = document.getElementById('modal-create-alert');
      const errText = document.getElementById('modal-create-alert-text');
      const btnSubmit = document.getElementById('btn-submit-create-user');

      const name = document.getElementById('create-user-name').value.trim();
      const username = document.getElementById('create-user-username').value.trim();
      const email = document.getElementById('create-user-email').value.trim();
      const role = document.getElementById('create-user-role').value;

      if (!name || !username) {
        if (errBox && errText) {
          errText.textContent = 'Name and username are required.';
          errBox.style.display = 'flex';
        }
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="btn-spinner"></span> GENERATING CREDENTIALS...';

      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, username, email, role })
        });

        const data = await res.json();

        if (!res.ok) {
          if (errBox && errText) {
            errText.textContent = data.error || 'Failed to create user account.';
            errBox.style.display = 'flex';
          }
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'GENERATE ACCOUNT & PASSPHRASE';
          return;
        }

        // Close create modal
        const createModal = document.getElementById('modal-create-user');
        if (createModal) {
          createModal.style.display = 'none';
          createModal.classList.remove('active');
          createModal.classList.remove('modal-active');
        }
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'GENERATE ACCOUNT & PASSPHRASE';

        // Refresh admin data
        this.loadAdminData();

        // Reveal Temporary Passphrase
        this.showTemporaryCredentials(data.user.username, data.temporaryPassword, 'NEW ACCOUNT ISSUED');
      } catch (err) {
        if (errBox && errText) {
          errText.textContent = 'Network communication failure.';
          errBox.style.display = 'flex';
        }
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'GENERATE ACCOUNT & PASSPHRASE';
      }
    },

    showTemporaryCredentials: function (username, temporaryPassword, heading = 'TEMPORARY CREDENTIALS') {
      const modal = document.getElementById('modal-temp-credentials');
      const userEl = document.getElementById('temp-cred-user-val');
      const passEl = document.getElementById('temp-cred-pass-val');
      const titleEl = document.getElementById('temp-cred-title');

      if (titleEl) titleEl.textContent = heading;
      if (userEl) userEl.textContent = username;
      if (passEl) passEl.textContent = temporaryPassword;

      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        modal.classList.add('modal-active');
      }
    },

    // -------------------------------------------------------------------------
    // 6. ADMIN USER ACTIONS (RESET, DISABLE, DELETE)
    // -------------------------------------------------------------------------
    promptResetPassword: function (userId, username) {
      this.openConfirmModal({
        title: 'RESET USER PASSPHRASE',
        message: `Generate a new temporary passphrase for personnel @${username}? Any current session will be terminated and user will be required to change password at next login.`,
        confirmBtnText: 'RESET PASSPHRASE',
        confirmBtnClass: 'btn-primary',
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/admin/users/${userId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resetPassword: true })
            });
            const data = await res.json();
            if (res.ok) {
              this.loadAdminData();
              this.showTemporaryCredentials(username, data.temporaryPassword, 'PASSPHRASE RESET ISSUED');
            } else {
              alert(data.error || 'Failed to reset password.');
            }
          } catch (e) {
            alert('Network error while resetting password.');
          }
        }
      });
    },

    toggleUserDisabled: async function (userId, shouldDisable) {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabled: shouldDisable })
        });
        const data = await res.json();
        if (res.ok) {
          this.loadAdminData();
        } else {
          alert(data.error || 'Operation failed.');
        }
      } catch (e) {
        alert('Network error while updating user status.');
      }
    },

    promptDeleteUser: function (userId, username) {
      this.openConfirmModal({
        title: 'DELETE PERSONNEL ACCOUNT',
        message: `Are you sure you want to permanently delete account @${username}? This action is irreversible and recorded in the audit trail.`,
        confirmBtnText: 'PERMANENTLY DELETE',
        confirmBtnClass: 'btn-danger',
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/admin/users/${userId}`, {
              method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
              this.loadAdminData();
            } else {
              alert(data.error || 'Failed to delete user account.');
            }
          } catch (e) {
            alert('Network error while deleting account.');
          }
        }
      });
    },

    // -------------------------------------------------------------------------
    // 7. CONFIRMATION DIALOG HELPER
    // -------------------------------------------------------------------------
    openConfirmModal: function ({ title, message, confirmBtnText, confirmBtnClass, onConfirm }) {
      const modal = document.getElementById('modal-confirm-action');
      const titleEl = document.getElementById('modal-confirm-title');
      const msgEl = document.getElementById('modal-confirm-message');
      const btnConfirm = document.getElementById('btn-confirm-action-submit');

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (btnConfirm) {
        btnConfirm.textContent = confirmBtnText || 'CONFIRM';
        btnConfirm.className = `btn ${confirmBtnClass || 'btn-primary'}`;
        btnConfirm.onclick = () => {
          modal.style.display = 'none';
          modal.classList.remove('active');
          modal.classList.remove('modal-active');
          if (onConfirm) onConfirm();
        };
      }

      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        modal.classList.add('modal-active');
      }
    },

    // -------------------------------------------------------------------------
    // 8. CHANGE PASSWORD MODAL (MANDATORY & VOLUNTARY)
    // -------------------------------------------------------------------------
    openChangePasswordModal: function (isMandatory = false) {
      const modal = document.getElementById('modal-change-password-app');
      const errBox = document.getElementById('modal-cp-alert');
      const form = document.getElementById('form-modal-change-password');
      const cancelBtn = document.getElementById('btn-modal-cp-cancel');
      const closeBtn = modal ? modal.querySelector('.modal-close-btn') : null;

      if (form) form.reset();
      if (errBox) errBox.style.display = 'none';

      if (isMandatory) {
        if (modal) modal.classList.add('modal-mandatory');
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (closeBtn) closeBtn.style.display = 'none';
        const alertBox = document.getElementById('modal-cp-alert');
        const alertText = document.getElementById('modal-cp-alert-text');
        if (alertBox && alertText) {
          alertBox.className = 'auth-alert-box auth-alert-info';
          alertText.textContent = 'Mandatory passphrase rotation required before accessing Mission Control.';
          alertBox.style.display = 'flex';
        }
      } else {
        if (modal) modal.classList.remove('modal-mandatory');
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        if (closeBtn) closeBtn.style.display = 'block';
      }

      this.validateModalPolicy('');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        modal.classList.add('modal-active');
      }
    },

    validateModalPolicy: function (val) {
      const checks = {
        length: val.length >= 10,
        upper: /[A-Z]/.test(val),
        lower: /[a-z]/.test(val),
        number: /[0-9]/.test(val),
        symbol: /[^A-Za-z0-9]/.test(val)
      };

      this.updateRule('modal-rule-length', checks.length);
      this.updateRule('modal-rule-upper', checks.upper);
      this.updateRule('modal-rule-lower', checks.lower);
      this.updateRule('modal-rule-number', checks.number);
      this.updateRule('modal-rule-symbol', checks.symbol);

      return Object.values(checks).every(Boolean);
    },

    updateRule: function (id, isValid) {
      const el = document.getElementById(id);
      if (!el) return;
      if (isValid) {
        el.classList.add('valid');
        el.querySelector('svg').innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
      } else {
        el.classList.remove('valid');
        el.querySelector('svg').innerHTML = '<circle cx="12" cy="12" r="10"></circle>';
      }
    },

    handleChangePassword: async function (e) {
      e.preventDefault();
      const errBox = document.getElementById('modal-cp-alert');
      const errText = document.getElementById('modal-cp-alert-text');
      const btnSubmit = document.getElementById('btn-submit-modal-cp');

      const currentPassword = document.getElementById('modal-cp-current-password').value;
      const newPassword = document.getElementById('modal-cp-new-password').value;
      const confirmPassword = document.getElementById('modal-cp-confirm-password').value;

      if (!currentPassword || !newPassword) {
        if (errBox && errText) {
          errBox.className = 'auth-alert-box auth-alert-error';
          errText.textContent = 'Current password and new password are required.';
          errBox.style.display = 'flex';
        }
        return;
      }

      if (!this.validateModalPolicy(newPassword)) {
        if (errBox && errText) {
          errBox.className = 'auth-alert-box auth-alert-error';
          errText.textContent = 'New passphrase does not satisfy all complexity requirements.';
          errBox.style.display = 'flex';
        }
        return;
      }

      if (newPassword !== confirmPassword) {
        if (errBox && errText) {
          errBox.className = 'auth-alert-box auth-alert-error';
          errText.textContent = 'New passphrase confirmation does not match.';
          errBox.style.display = 'flex';
        }
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="btn-spinner"></span> ROTATING PASSPHRASE...';

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();

        if (!res.ok) {
          if (errBox && errText) {
            errBox.className = 'auth-alert-box auth-alert-error';
            errText.textContent = data.error || 'Password update failed.';
            errBox.style.display = 'flex';
          }
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'CONFIRM PASSPHRASE UPDATE';
          return;
        }

        if (errBox && errText) {
          errBox.className = 'auth-alert-box auth-alert-success';
          errText.textContent = 'Passphrase successfully updated!';
          errBox.style.display = 'flex';
        }

        setTimeout(() => {
          const modal = document.getElementById('modal-change-password-app');
          if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('modal-mandatory');
            modal.classList.remove('active');
            modal.classList.remove('modal-active');
          }
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'CONFIRM PASSPHRASE UPDATE';
          if (this.currentUser) this.currentUser.mustChangePassword = false;
          if (window.SkyserveState && window.SkyserveState.currentUser) {
            window.SkyserveState.currentUser.mustChangePassword = false;
          }
        }, 1000);
      } catch (err) {
        if (errBox && errText) {
          errBox.className = 'auth-alert-box auth-alert-error';
          errText.textContent = 'Network communication failure.';
          errBox.style.display = 'flex';
        }
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'CONFIRM PASSPHRASE UPDATE';
      }
    },

    escapeHtml: function (str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  window.SkyserveAdmin = SkyserveAdmin;

  // Initialize immediately on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SkyserveAdmin.init());
  } else {
    SkyserveAdmin.init();
  }
})();
