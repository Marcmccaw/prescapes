const ROLE_LABELS = { dev: 'Dev', manager: 'Manager', staff: 'Staff', client: 'Client' };
const ALLOWED_ROLES = ['dev', 'manager'];
const LEAD_STATUSES = ['Pending', 'Quoting', 'Booked', 'Payment', 'Completed'];

const shell = document.getElementById('panel-shell');
const denied = document.getElementById('panel-denied');
const leadList = document.getElementById('lead-list');
const leadCount = document.getElementById('lead-count');
const leadSearch = document.getElementById('lead-search');
const leadStatusFilters = document.getElementById('lead-status-filters');
const leadSort = document.getElementById('lead-sort');
const includedStatuses = new Set();
const excludedStatuses = new Set();
let statusClickTimer = null;

function getAccounts() {
  return JSON.parse(localStorage.getItem('pl_accounts') || '{}');
}

function getCurrentUserEmail() {
  return localStorage.getItem('pl_current_user') || '';
}

function getCurrentRole() {
  const account = getAccounts()[getCurrentUserEmail()];
  return account?.role || 'client';
}

function ensureInitialDev() {
  const accounts = getAccounts();
  const currentEmail = getCurrentUserEmail();
  const emails = Object.keys(accounts);
  const hasDev = emails.some(email => accounts[email]?.role === 'dev');
  if (!hasDev && emails.length === 1 && accounts[currentEmail]) {
    accounts[currentEmail] = { ...accounts[currentEmail], role: 'dev' };
    localStorage.setItem('pl_accounts', JSON.stringify(accounts));
  }
}

function getSubmissions() {
  const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
  let changed = false;
  const normalized = submissions.map((lead, index) => {
    if (lead.id) return lead;
    changed = true;
    const stamp = lead.submittedAt ? new Date(lead.submittedAt).getTime() : Date.now();
    return { ...lead, id: `lead_${stamp}_${index}` };
  });
  if (changed) saveSubmissions(normalized);
  return normalized;
}

function saveSubmissions(submissions) {
  localStorage.setItem('pl_client_submissions', JSON.stringify(submissions));
}

function getLeadStatus(lead) {
  if (lead.status === 'Approved' || lead.status === 'Quoteing') return 'Quoting';
  return LEAD_STATUSES.includes(lead.status) ? lead.status : 'Pending';
}

function updateLeadStatus(id, status) {
  const submissions = getSubmissions();
  const idx = submissions.findIndex(lead => lead.id === id);
  if (idx < 0) return;
  submissions[idx] = { ...submissions[idx], status: getLeadStatus({ status }) };
  saveSubmissions(submissions);
}

function deleteLead(id) {
  const all = getSubmissions();
  const lead = all.find(s => s.id === id);

  // Remove from submissions
  saveSubmissions(all.filter(s => s.id !== id));

  // Scan ALL booking keys in localStorage and remove this ticket id
  Object.keys(localStorage)
    .filter(k => k.startsWith('pl_bookings_'))
    .forEach(key => {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter(b => b.id !== id && b.leadId !== id);
      if (filtered.length !== existing.length) {
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    });
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function searchableText(lead) {
  return [
    lead.name,
    lead.email,
    lead.phone,
    lead.service,
    lead.street,
    lead.zip,
    lead.dates,
    lead.message,
    lead.source,
    getLeadStatus(lead)
  ].join(' ').toLowerCase();
}

function getFilteredLeads() {
  const query = leadSearch.value.trim().toLowerCase();
  const sortMode = leadSort.value;
  const leads = getSubmissions()
    .filter(lead => {
      const status = getLeadStatus(lead);
      if (excludedStatuses.has(status)) return false;
      return includedStatuses.size === 0 || includedStatuses.has(status);
    })
    .filter(lead => !query || searchableText(lead).includes(query));

  leads.sort((a, b) => {
    if (sortMode === 'oldest') return new Date(a.submittedAt) - new Date(b.submittedAt);
    if (sortMode === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortMode === 'service') return (a.service || '').localeCompare(b.service || '');
    if (sortMode === 'email') return (a.email || '').localeCompare(b.email || '');
    if (sortMode === 'status') return LEAD_STATUSES.indexOf(getLeadStatus(a)) - LEAD_STATUSES.indexOf(getLeadStatus(b));
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  });

  return leads;
}

function updateStatusFilterChips() {
  leadStatusFilters.querySelectorAll('.status-filter-chip').forEach(chip => {
    const status = chip.dataset.status;
    const isAll = status === 'all';
    const isDefaultAll = isAll && includedStatuses.size === 0 && excludedStatuses.size === 0;
    chip.classList.toggle('active', isDefaultAll || includedStatuses.has(status));
    chip.classList.toggle('excluded', excludedStatuses.has(status));
    if (isAll) {
      chip.textContent = 'All';
    } else {
      chip.textContent = status;
    }
  });
}

function renderLeads() {
  const leads = getFilteredLeads();
  // leadCount is now the Create button — don't overwrite it
  leadList.innerHTML = '';

  if (leads.length === 0) {
    leadList.innerHTML = '<p class="client-panel-empty">No submissions match your filters.</p>';
    return;
  }

  leads.forEach(lead => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'client-lead-row';
    const contact = document.createElement('span');
    const contactName = document.createElement('strong');
    contactName.textContent = lead.name || 'Unnamed Client';
    const contactInfo = document.createElement('small');
    contactInfo.textContent = `${lead.email || 'No email'}${lead.phone ? ` - ${lead.phone}` : ''}`;
    contact.append(contactName, contactInfo);
    const service = document.createElement('span');
    service.textContent = lead.service || 'General Inquiry';
    const submitted = document.createElement('span');
    submitted.textContent = formatDate(lead.submittedAt);
    const statusSelect = createStatusSelect(lead);
    statusSelect.addEventListener('click', e => e.stopPropagation());
    statusSelect.addEventListener('change', e => {
      e.stopPropagation();
      updateLeadStatus(lead.id, statusSelect.value);
      renderLeads();
    });
    const actions = document.createElement('span');
    actions.className = 'lead-row-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'lead-delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${lead.name || lead.email || 'submission'}`);
    deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      showConfirm('This will permanently delete this ticket. This cannot be undone.', () => {
        deleteLead(lead.id);
        renderLeads();
      }, 'Delete Ticket?');
    });
    actions.append(statusSelect, deleteBtn);
    button.append(contact, service, submitted, actions);
    button.addEventListener('click', () => {
      sessionStorage.setItem('pl_selected_lead', JSON.stringify(lead));
      window.location.href = `client-detail.html?id=${encodeURIComponent(lead.id)}`;
    });
    leadList.appendChild(button);
  });
}

function createStatusSelect(lead) {
  const select = document.createElement('select');
  select.className = `lead-status lead-status-${getLeadStatus(lead).toLowerCase()}`;
  select.setAttribute('aria-label', `Status for ${lead.name || lead.email || 'submission'}`);
  LEAD_STATUSES.forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    option.selected = status === getLeadStatus(lead);
    select.appendChild(option);
  });
  return select;
}

function initPanel() {
  ensureInitialDev();
  const role = getCurrentRole();
  if (!ALLOWED_ROLES.includes(role)) {
    denied.hidden = false;
    return;
  }
  shell.hidden = false;
  renderLeads();
}

leadSearch.addEventListener('input', renderLeads);
leadSort.addEventListener('change', renderLeads);
leadStatusFilters.addEventListener('click', e => {
  const chip = e.target.closest('.status-filter-chip');
  if (!chip) return;
  clearTimeout(statusClickTimer);
  statusClickTimer = setTimeout(() => {
    const status = chip.dataset.status;
    if (status === 'all') {
      includedStatuses.clear();
      excludedStatuses.clear();
    } else {
      excludedStatuses.delete(status);
      if (includedStatuses.has(status)) includedStatuses.delete(status);
      else includedStatuses.add(status);
    }
    updateStatusFilterChips();
    renderLeads();
  }, 220);
});
leadStatusFilters.addEventListener('dblclick', e => {
  const chip = e.target.closest('.status-filter-chip');
  if (!chip) return;
  clearTimeout(statusClickTimer);
  const status = chip.dataset.status;
  if (status === 'all') {
    includedStatuses.clear();
    excludedStatuses.clear();
  } else {
    includedStatuses.delete(status);
    if (excludedStatuses.has(status)) excludedStatuses.delete(status);
    else excludedStatuses.add(status);
  }
  updateStatusFilterChips();
  renderLeads();
});

const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
hamburger.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
});

// Custom confirm panel
const cpBackdrop = document.getElementById('cp-confirm-backdrop');
const cpModal = document.getElementById('cp-confirm-modal');
const cpMsg = document.getElementById('cp-confirm-msg');
let cpCallback = null;

function showConfirm(message, onConfirm, title = 'Are you sure?') {
  cpMsg.textContent = message;
  const titleEl = document.getElementById('cp-confirm-title');
  if (titleEl) titleEl.textContent = title;
  cpCallback = onConfirm;
  cpBackdrop.hidden = false;
  cpModal.hidden = false;
}
function hideConfirm() {
  cpBackdrop.hidden = true;
  cpModal.hidden = true;
  cpCallback = null;
}

document.getElementById('cp-confirm-cancel')?.addEventListener('click', hideConfirm);
cpBackdrop?.addEventListener('click', hideConfirm);
document.getElementById('cp-confirm-ok')?.addEventListener('click', () => {
  if (cpCallback) cpCallback();
  hideConfirm();
});

initPanel();

// ============================================
// CREATE TICKET
// ============================================
const createBackdrop = document.getElementById('create-backdrop');
const createModal = document.getElementById('create-modal');
const createClose = document.getElementById('create-close');
const createCancel = document.getElementById('create-cancel');
const createForm = document.getElementById('create-form');
const createMatchNotice = document.getElementById('create-match-notice');
const ctPhone = document.getElementById('ct-phone');

function openCreateModal() {
  createBackdrop.hidden = false;
  createModal.hidden = false;
  document.body.style.overflow = 'hidden';
  createForm.reset();
  createMatchNotice.hidden = true;
}
function closeCreateModal() {
  createBackdrop.hidden = true;
  createModal.hidden = true;
  document.body.style.overflow = '';
}

document.getElementById('lead-count')?.addEventListener('click', openCreateModal);
createClose?.addEventListener('click', closeCreateModal);
createCancel?.addEventListener('click', closeCreateModal);
createBackdrop?.addEventListener('click', closeCreateModal);

// Phone auto-format
if (ctPhone) {
  ctPhone.addEventListener('input', e => {
    const cursorPos = e.target.selectionStart;
    const digitsBeforeCursor = e.target.value.slice(0, cursorPos).replace(/\D/g, '').length;
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) formatted = digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
    else if (digits.length > 3) formatted = digits.slice(0,3) + '-' + digits.slice(3);
    e.target.value = formatted;
    let digitCount = 0, newPos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) digitCount++;
      if (digitCount === digitsBeforeCursor) { newPos = i + 1; break; }
    }
    if (digitsBeforeCursor === 0) newPos = 0;
    while (newPos < formatted.length && formatted[newPos] === '-') newPos++;
    e.target.setSelectionRange(newPos, newPos);
  });
}

// Check for matching account as they type email/phone
['ct-email','ct-phone'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', checkAccountMatch);
});

function checkAccountMatch() {
  const email = document.getElementById('ct-email')?.value.trim().toLowerCase();
  const phone = document.getElementById('ct-phone')?.value.trim();
  const accounts = JSON.parse(localStorage.getItem('pl_accounts') || '{}');
  const match = Object.entries(accounts).find(([key, acc]) =>
    (email && key === email) || (phone && acc.phone === phone)
  );
  if (match) {
    const [, acc] = match;
    createMatchNotice.hidden = false;
    createMatchNotice.textContent = `✓ Account found: ${acc.name} — filling in known info.`;

    // Auto-fill known fields
    const parts = (acc.name || '').trim().split(' ');
    const fname = document.getElementById('ct-fname');
    const lname = document.getElementById('ct-lname');
    const ctEmail = document.getElementById('ct-email');
    const ctPhoneEl = document.getElementById('ct-phone');
    const ctStreet = document.getElementById('ct-street');
    const ctZip = document.getElementById('ct-zip');

    if (fname && !fname.value) fname.value = parts[0] || '';
    if (lname && !lname.value) lname.value = parts.slice(1).join(' ') || '';
    if (ctEmail && !ctEmail.value) ctEmail.value = match[0];
    if (ctPhoneEl && !ctPhoneEl.value) ctPhoneEl.value = acc.phone || '';
    if (ctStreet && !ctStreet.value) ctStreet.value = acc.street || '';
    if (ctZip && !ctZip.value) ctZip.value = acc.zip || '';
  } else {
    createMatchNotice.hidden = true;
  }
}

createForm?.addEventListener('submit', e => {
  e.preventDefault();
  const fname = document.getElementById('ct-fname').value.trim();
  const lname = document.getElementById('ct-lname').value.trim();
  if (!fname) { document.getElementById('ct-fname').focus(); return; }

  const email = document.getElementById('ct-email').value.trim();
  const phone = document.getElementById('ct-phone').value.trim();
  const street = document.getElementById('ct-street').value.trim();
  const zip = document.getElementById('ct-zip').value.trim();
  const service = document.getElementById('ct-service').value;
  const status = document.getElementById('ct-status').value;
  const message = document.getElementById('ct-message').value.trim();

  const id = `lead_${Date.now()}_manual`;
  const newTicket = {
    id, name: `${fname} ${lname}`.trim(),
    email, phone, street, zip, service, status, message,
    submittedAt: new Date().toISOString(),
    source: 'Manual (Dev/Manager)'
  };

  // Save to client submissions
  const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
  submissions.unshift(newTicket);
  localStorage.setItem('pl_client_submissions', JSON.stringify(submissions));

  // If account match found, also add to their booked tab
  const accounts = JSON.parse(localStorage.getItem('pl_accounts') || '{}');
  const matchKey = Object.keys(accounts).find(key =>
    (email && key === email.toLowerCase()) ||
    (phone && accounts[key].phone === phone)
  );
  if (matchKey) {
    const bookings = JSON.parse(localStorage.getItem(`pl_bookings_${matchKey}`) || '[]');
    bookings.unshift({
      submittedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      service: service || 'General Inquiry',
      dates: '',
      leadId: id
    });
    localStorage.setItem(`pl_bookings_${matchKey}`, JSON.stringify(bookings));
  }

  closeCreateModal();
  renderLeads();
});
