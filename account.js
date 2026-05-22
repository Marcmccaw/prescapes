/* ============================================
   account.js — Shared account modals for all pages
   ============================================ */
(function () {
try {
  // ---- Helpers ----
  function getAccounts() { return JSON.parse(localStorage.getItem('pl_accounts') || '{}'); }
  function getBookings(email) { return JSON.parse(localStorage.getItem(`pl_bookings_${email}`) || '[]'); }
  function saveAccount(email, data) {
    const a = getAccounts(); a[email] = data;
    localStorage.setItem('pl_accounts', JSON.stringify(a));
  }
  function formatPrice(v) {
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const ROLE_LABELS = { dev: 'Dev', manager: 'Manager', staff: 'Staff', client: 'Client' };
  const ASSIGNABLE = { dev: ['manager','staff','client'], manager: ['staff','client'] };

  let currentEmail = localStorage.getItem('pl_current_user') || '';
  let isLoggedIn = false;

  // ---- Inject modal HTML ----
  const container = document.createElement('div');
  container.innerHTML = `
    <!-- Backdrop -->
    <div id="ac-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(5px);z-index:800;"></div>

    <!-- BOOKED MODAL -->
    <div id="ac-booked" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:801;background:var(--navy-dark,#001a37);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:2.5rem 2rem;width:100%;max-width:420px;max-height:85vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.4);">
      <button id="ac-booked-close" style="position:absolute;top:1rem;right:1rem;background:transparent;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:1.3rem;">✕</button>
      <h2 style="font-family:Montserrat,sans-serif;font-size:1.2rem;font-weight:700;color:#fff;text-align:center;margin-bottom:1.25rem;">My Bookings</h2>
      <div id="ac-booked-list"></div>
    </div>

    <!-- SETTINGS MODAL -->
    <div id="ac-settings" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:801;background:var(--navy-dark,#001a37);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:2rem;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.4);">
      <button id="ac-settings-close" style="position:absolute;top:1rem;right:1rem;background:transparent;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:1.3rem;">✕</button>
      <h2 style="font-family:Montserrat,sans-serif;font-size:1.2rem;font-weight:700;color:#fff;text-align:center;margin-bottom:1.25rem;">Account Settings</h2>
      <form id="ac-settings-form" style="display:flex;flex-direction:column;gap:.7rem;">
        <p style="font-size:.75rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1E5CBF;margin-top:.25rem;">Personal Info</p>
        <div style="display:flex;gap:.5rem;"><input id="ac-s-fname" placeholder="First Name" style="flex:1;" /><input id="ac-s-lname" placeholder="Last Name" style="flex:1;" /></div>
        <input id="ac-s-email" type="email" placeholder="Email" />
        <input id="ac-s-phone" type="tel" placeholder="Phone" />
        <p style="font-size:.75rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1E5CBF;margin-top:.25rem;">Address</p>
        <div style="display:flex;gap:.5rem;"><input id="ac-s-street" placeholder="Street" style="flex:2;" /><input id="ac-s-zip" placeholder="Postal Code" style="flex:1;" /></div>
        <p style="font-size:.75rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1E5CBF;margin-top:.25rem;">Change Password <span style="font-weight:400;opacity:.5;">(leave blank to keep)</span></p>
        <input id="ac-s-pass" type="password" placeholder="New Password" />
        <input id="ac-s-confirm" type="password" placeholder="Confirm Password" />
        <button type="submit" style="padding:.8rem;background:#1E5CBF;border:none;border-radius:6px;color:#fff;font-family:Montserrat,sans-serif;font-weight:700;font-size:.85rem;cursor:pointer;">Save Changes</button>
        <p id="ac-s-err" style="color:#FC8181;font-size:.8rem;text-align:center;display:none;"></p>
        <div style="border-top:1px solid rgba(252,129,129,.2);padding-top:.75rem;">
          <button type="button" id="ac-delete-btn" style="width:100%;padding:.65rem;background:transparent;border:1px solid rgba(252,129,129,.4);border-radius:6px;color:#FC8181;font-family:Montserrat,sans-serif;font-weight:700;font-size:.82rem;cursor:pointer;">Delete My Account</button>
        </div>
      </form>
    </div>

    <!-- USER MANAGEMENT MODAL -->
    <div id="ac-users" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:801;background:var(--navy-dark,#001a37);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:2rem;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.4);">
      <button id="ac-users-close" style="position:absolute;top:1rem;right:1rem;background:transparent;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:1.3rem;">✕</button>
      <h2 style="font-family:Montserrat,sans-serif;font-size:1.2rem;font-weight:700;color:#fff;text-align:center;margin-bottom:.5rem;">User Management</h2>
      <p id="ac-users-help" style="color:#8A9BB0;font-size:.82rem;text-align:center;margin-bottom:1rem;"></p>
      <input id="ac-users-search" placeholder="Search users…" style="width:100%;margin-bottom:1rem;" />
      <div id="ac-users-list"></div>
    </div>

    <!-- CONFIRM DELETE -->
    <div id="ac-confirm" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:802;background:var(--navy-dark,#001a37);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:2.5rem 2rem;width:100%;max-width:340px;text-align:center;box-shadow:0 12px 48px rgba(0,0,0,.4);">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FC8181" stroke-width="2" stroke-linecap="round" style="margin-bottom:.75rem;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h3 id="ac-confirm-title" style="font-family:Montserrat,sans-serif;font-weight:700;color:#fff;margin-bottom:.5rem;">Are you sure?</h3>
      <p id="ac-confirm-msg" style="color:#8A9BB0;font-size:.88rem;line-height:1.6;margin-bottom:1.5rem;"></p>
      <div style="display:flex;gap:.75rem;">
        <button id="ac-confirm-cancel" style="flex:1;padding:.7rem;border:1px solid rgba(255,255,255,.2);border-radius:6px;background:transparent;color:rgba(255,255,255,.8);font-family:Montserrat,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;">Cancel</button>
        <button id="ac-confirm-ok" style="flex:1;padding:.7rem;border:none;border-radius:6px;background:#DC2626;color:#fff;font-family:Montserrat,sans-serif;font-weight:700;font-size:.82rem;cursor:pointer;">Yes, Delete It</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Style inputs inside modals
  const style = document.createElement('style');
  style.textContent = `
    #ac-settings input, #ac-settings-form input, #ac-users-search {
      padding:.6rem .8rem;border:1px solid rgba(255,255,255,.15);border-radius:6px;
      background:rgba(255,255,255,.06);color:#fff;font-family:inherit;font-size:.88rem;width:100%;
    }
    #ac-settings input:focus, #ac-users-search:focus { outline:none;border-color:#1E5CBF; }
    #ac-settings input::placeholder, #ac-users-search::placeholder { color:#8A9BB0; }
    .ac-user-row { display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.75rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:.5rem; }
    .ac-user-info { flex:1; }
    .ac-user-name { color:#fff;font-weight:600;font-size:.88rem; }
    .ac-user-email { color:#8A9BB0;font-size:.78rem; }
    .ac-user-role-badge { font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1E5CBF;margin-top:.15rem; }
    .ac-user-actions { display:flex;align-items:center;gap:.4rem; }
    .ac-role-select { padding:.4rem .5rem;border:1px solid rgba(255,255,255,.15);border-radius:4px;background:rgba(255,255,255,.06);color:#fff;font-size:.78rem;font-weight:700; }
    .ac-del-btn { width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(252,129,129,.3);border-radius:4px;background:transparent;color:#FC8181;cursor:pointer; }
    .ac-del-btn:hover { background:rgba(252,129,129,.1); }
    .ac-booked-item { background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:.9rem;margin-bottom:.6rem; }
    .ac-booked-status { font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#F59E0B;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:999px;padding:.15rem .75rem;display:inline-block;margin-bottom:.4rem; }
    .ac-booked-service { color:#fff;font-weight:700;font-size:.92rem;margin-bottom:.25rem; }
    .ac-booked-dates { color:#8A9BB0;font-size:.8rem; }
  `;
  document.head.appendChild(style);

  // ---- Modal open/close helpers ----
  const backdrop = document.getElementById('ac-backdrop');
  let activeModal = null;

  function openModal(id) {
    if (activeModal) activeModal.style.display = 'none';
    activeModal = document.getElementById(id);
    if (activeModal) activeModal.style.display = 'block';
    backdrop.style.display = 'block';
  }
  function closeModal() {
    if (activeModal) activeModal.style.display = 'none';
    backdrop.style.display = 'none';
    activeModal = null;
  }

  backdrop.addEventListener('click', closeModal);
  ['ac-booked-close','ac-settings-close','ac-users-close'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', closeModal);
  });

  // ---- BOOKED ----
  function openBooked() {
    const list = document.getElementById('ac-booked-list');
    const bookings = getBookings(currentEmail);
    list.innerHTML = '';
    if (!bookings.length) {
      list.innerHTML = '<p style="color:#8A9BB0;text-align:center;font-size:.88rem;padding:1rem 0;">No bookings yet.</p>';
    } else {
      bookings.forEach(b => {
        list.innerHTML += `<div class="ac-booked-item">
          <span class="ac-booked-status">Pending</span>
          <div class="ac-booked-service">${b.service || 'General Inquiry'}</div>
          <div class="ac-booked-dates">${b.dates || 'No dates selected'}</div>
        </div>`;
      });
    }
    openModal('ac-booked');
  }

  // ---- SETTINGS ----
  function openSettings() {
    const acc = getAccounts()[currentEmail] || {};
    const parts = (acc.name || '').split(' ');
    document.getElementById('ac-s-fname').value = parts[0] || '';
    document.getElementById('ac-s-lname').value = parts.slice(1).join(' ') || '';
    document.getElementById('ac-s-email').value = currentEmail;
    document.getElementById('ac-s-phone').value = acc.phone || '';
    document.getElementById('ac-s-street').value = acc.street || '';
    document.getElementById('ac-s-zip').value = acc.zip || '';
    document.getElementById('ac-s-pass').value = '';
    document.getElementById('ac-s-confirm').value = '';
    document.getElementById('ac-s-err').style.display = 'none';
    openModal('ac-settings');
  }

  document.getElementById('ac-settings-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const fname = document.getElementById('ac-s-fname').value.trim();
    const lname = document.getElementById('ac-s-lname').value.trim();
    const email = document.getElementById('ac-s-email').value.trim().toLowerCase();
    const phone = document.getElementById('ac-s-phone').value.trim();
    const street = document.getElementById('ac-s-street').value.trim();
    const zip = document.getElementById('ac-s-zip').value.trim();
    const pass = document.getElementById('ac-s-pass').value;
    const confirm = document.getElementById('ac-s-confirm').value;
    const errEl = document.getElementById('ac-s-err');

    if (pass && pass !== confirm) {
      errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return;
    }
    const accounts = getAccounts();
    const acc = accounts[currentEmail] || {};
    const updated = { ...acc, name: `${fname} ${lname}`.trim(), phone, street, zip, password: pass || acc.password };
    if (email !== currentEmail) { delete accounts[currentEmail]; }
    accounts[email] = updated;
    localStorage.setItem('pl_accounts', JSON.stringify(accounts));
    currentEmail = email;
    localStorage.setItem('pl_current_user', email);
    updateNavBtn(updated.name);
    closeModal();
  });

  // Delete account
  document.getElementById('ac-delete-btn')?.addEventListener('click', () => {
    showConfirmModal('Delete your account? This cannot be undone.', () => {
      const accounts = getAccounts();
      const deletingEmail = currentEmail;
      delete accounts[currentEmail];
      localStorage.setItem('pl_accounts', JSON.stringify(accounts));
      localStorage.removeItem(`pl_bookings_${currentEmail}`);
      if (window.PrestigeFirebase) {
        window.PrestigeFirebase.deleteAccount(deletingEmail).catch(err => console.warn('Could not delete Firebase account:', err));
      }
      localStorage.removeItem('pl_current_user');
      closeModal();
      resetNavBtn();
    });
  });

  // ---- USER MANAGEMENT ----
  function openUsers() {
    renderUsers();
    openModal('ac-users');
  }

  function renderUsers() {
    const accounts = getAccounts();
    const myRole = (accounts[currentEmail]?.role || '').toLowerCase();
    const assignable = ASSIGNABLE[myRole] || [];
    const list = document.getElementById('ac-users-list');
    const query = (document.getElementById('ac-users-search')?.value || '').toLowerCase();
    const helpEl = document.getElementById('ac-users-help');
    if (helpEl) helpEl.textContent = myRole === 'dev' ? 'Devs can assign Manager, Staff, or Client roles.' : 'Managers can assign Staff or Client roles.';
    list.innerHTML = '';

    Object.entries(accounts)
      .filter(([em, acc]) => !query || [acc.name, em, acc.phone].some(v => (v||'').toLowerCase().includes(query)))
      .sort((a,b) => (a[1].name||a[0]).localeCompare(b[1].name||b[0]))
      .forEach(([em, acc]) => {
        const role = (acc.role || 'client').toLowerCase();
        const canEdit = assignable.includes(role) && em !== currentEmail;
        const row = document.createElement('div');
        row.className = 'ac-user-row';
        row.innerHTML = `
          <div class="ac-user-info">
            <div class="ac-user-name">${acc.name || 'Unnamed'}</div>
            <div class="ac-user-email">${em}</div>
            <div class="ac-user-role-badge">${ROLE_LABELS[role] || role}</div>
          </div>
          <div class="ac-user-actions">
            ${canEdit ? `<select class="ac-role-select" data-email="${em}">
              ${assignable.map(r => `<option value="${r}" ${r===role?'selected':''}>${ROLE_LABELS[r]}</option>`).join('')}
            </select>
            <button class="ac-del-btn" data-email="${em}" title="Delete account">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>` : `<span style="font-size:.78rem;color:#8A9BB0;font-weight:600;">${em === currentEmail ? 'You' : ROLE_LABELS[role]||role}</span>`}
          </div>
        `;
        list.appendChild(row);
      });

    // Role change
    list.querySelectorAll('.ac-role-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const a = getAccounts();
        if (a[sel.dataset.email]) { a[sel.dataset.email].role = sel.value; localStorage.setItem('pl_accounts', JSON.stringify(a)); renderUsers(); }
      });
    });

    // Delete
    list.querySelectorAll('.ac-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const em = btn.dataset.email;
        const name = getAccounts()[em]?.name || em;
        showConfirmModal(`Delete account for ${name}? This cannot be undone.`, () => {
          const a = getAccounts(); delete a[em]; localStorage.setItem('pl_accounts', JSON.stringify(a));
          localStorage.removeItem(`pl_bookings_${em}`);
          if (window.PrestigeFirebase) {
            window.PrestigeFirebase.deleteAccount(em).catch(err => console.warn('Could not delete Firebase account:', err));
          }
          renderUsers();
        });
      });
    });
  }

  document.getElementById('ac-users-search')?.addEventListener('input', renderUsers);

  // ---- CONFIRM MODAL ----
  let confirmCb = null;
  function showConfirmModal(msg, cb) {
    document.getElementById('ac-confirm-msg').textContent = msg;
    confirmCb = cb;
    document.getElementById('ac-confirm').style.display = 'block';
    backdrop.style.display = 'block';
  }
  document.getElementById('ac-confirm-cancel')?.addEventListener('click', () => {
    document.getElementById('ac-confirm').style.display = 'none';
    confirmCb = null;
    if (activeModal) activeModal.style.display = 'block'; else backdrop.style.display = 'none';
  });
  document.getElementById('ac-confirm-ok')?.addEventListener('click', () => {
    document.getElementById('ac-confirm').style.display = 'none';
    if (confirmCb) { confirmCb(); confirmCb = null; }
  });

  // ---- NAV BUTTON ----
  function updateNavBtn(name) {
    const btn = document.getElementById('nav-auth-btn');
    if (!btn) return;
    const parts = (name || '').trim().split(' ');
    const first = parts[0];
    const last = parts.length > 1 ? ' ' + parts[parts.length-1][0].toUpperCase() + '.' : '';
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${first}${last}`;
    btn.href = '#';
    btn.onclick = e => { e.preventDefault(); };
  }

  function resetNavBtn() {
    const btn = document.getElementById('nav-auth-btn');
    if (btn) { btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Login/Signup`; btn.href = 'index.html'; btn.onclick = null; }
    const dropdown = document.getElementById('nav-user-dropdown');
    if (dropdown) dropdown.hidden = true;
    isLoggedIn = false;
  }

  // ---- DROPDOWN WIRING ----
  if (currentEmail) {
    const accounts = getAccounts();
    const acc = accounts[currentEmail];
    if (acc) {
      isLoggedIn = true;
      updateNavBtn(acc.name);

      // Show dropdown on click (prevent default link)
      const btn = document.getElementById('nav-auth-btn');
      const dropdown = document.getElementById('nav-user-dropdown');
      if (btn && dropdown) {
        btn.href = '#';
        btn.addEventListener('click', e => { e.preventDefault(); dropdown.hidden = !dropdown.hidden; });
        document.addEventListener('click', e => {
          if (!btn.closest('.auth-btn-wrap')?.contains(e.target)) dropdown.hidden = true;
        });
      }

      // Show admin links
      const role = (acc.role || '').toLowerCase();
      if (role === 'dev' || role === 'manager') {
        document.getElementById('nav-client-panel-link')?.removeAttribute('hidden');
        document.getElementById('nav-users-link')?.removeAttribute('hidden');
      }

      // Dropdown actions
      document.getElementById('nav-booked-link')?.addEventListener('click', e => { e.preventDefault(); dropdown.hidden = true; openBooked(); });
      document.getElementById('nav-settings-link')?.addEventListener('click', e => { e.preventDefault(); dropdown.hidden = true; openSettings(); });
      document.getElementById('nav-users-link')?.addEventListener('click', e => { e.preventDefault(); dropdown.hidden = true; openUsers(); });
      document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('pl_current_user');
        resetNavBtn();
      });
    }
  }
} catch(e) { console.error('account.js error:', e); }
})();
