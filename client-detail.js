const ALLOWED_ROLES = ['dev', 'manager'];
const LEAD_STATUSES = ['Pending', 'Quoting', 'Booked', 'Payment', 'Completed'];
const detailRoot = document.getElementById('client-detail');

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

function getSubmissions() {
  const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
  let changed = false;
  const normalized = submissions.map((lead, index) => {
    if (lead.id) return lead;
    changed = true;
    const stamp = lead.submittedAt ? new Date(lead.submittedAt).getTime() : Date.now();
    return { ...lead, id: `lead_${stamp}_${index}` };
  });
  if (changed) localStorage.setItem('pl_client_submissions', JSON.stringify(normalized));
  return normalized;
}

function getLeadStatus(lead) {
  if (lead.status === 'Approved' || lead.status === 'Quoteing') return 'Quoting';
  return LEAD_STATUSES.includes(lead.status) ? lead.status : 'Pending';
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

function rowStatus(lead) {
  const item = document.createElement('div');
  item.className = 'blank-detail-row';
  const key = document.createElement('span');
  key.textContent = 'Status';
  const select = document.createElement('select');
  const currentStatus = getLeadStatus(lead);
  select.className = `lead-status lead-status-${currentStatus.toLowerCase()}`;
  LEAD_STATUSES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    opt.selected = s === currentStatus;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    const val = select.value;

    // Update dropdown color
    select.className = `lead-status lead-status-${val.toLowerCase()}`;

    // Save status
    const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
    const idx = submissions.findIndex(s => s.id === lead.id);
    if (idx >= 0) { submissions[idx].status = val; localStorage.setItem('pl_client_submissions', JSON.stringify(submissions)); }

    // Quoting/Booked section
    const qs = document.getElementById('quoting-section');
    if (qs) {
      qs.hidden = !['Quoting','Booked'].includes(val);
      const qt = document.getElementById('quoting-title');
      if (qt) qt.textContent = val === 'Booked' ? 'Booking Details' : 'Quote Details';
      const qSave = document.getElementById('q-save');
      if (qSave) qSave.textContent = val === 'Booked' ? 'Save Booking Details' : 'Save Quote Details';
      document.querySelectorAll('.q-only').forEach(el => el.hidden = val !== 'Quoting');
      document.querySelectorAll('.b-only').forEach(el => el.hidden = val !== 'Booked');
      if (val === 'Booked') renderDateTags();
    }

    // Payment/Completed section
    const ps = document.getElementById('payment-section');
    if (ps) {
      const showPayment = ['Payment','Completed'].includes(val);
      ps.classList.toggle('hidden', !showPayment);
      if (showPayment) buildPaymentSection();
    }

    // Preferred Dates row — hide for Booked/Payment/Completed
    const prefRow = document.getElementById('pref-dates-row');
    if (prefRow) prefRow.hidden = ['Booked','Payment','Completed'].includes(val);
  });
  item.append(key, select);
  return item;
}

function editableRow(label, value, field) {
  const item = document.createElement('div');
  item.className = 'blank-detail-row';

  const key = document.createElement('span');
  key.textContent = label;

  const val = document.createElement('strong');
  val.textContent = value || 'Not provided';

  const editBtn = document.createElement('button');
  editBtn.className = 'detail-edit-btn';
  editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editBtn.setAttribute('aria-label', `Edit ${label}`);

  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = field === 'email' ? 'email' : 'text';
    input.value = value || '';
    input.className = 'detail-edit-input';
    input.style.cssText = 'flex:1;padding:.25rem .5rem;border:1px solid var(--blue-accent);border-radius:4px;font-size:.9rem;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'detail-edit-save';
    saveBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    saveBtn.setAttribute('aria-label', 'Save');

    val.replaceWith(input);
    editBtn.replaceWith(saveBtn);

    saveBtn.addEventListener('click', () => {
      const newVal = input.value.trim();
      const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
      const idx = submissions.findIndex(s => s.id === lead.id);
      if (idx >= 0) {
        submissions[idx][field] = newVal;
        localStorage.setItem('pl_client_submissions', JSON.stringify(submissions));
        value = newVal;
      }
      const newStrong = document.createElement('strong');
      newStrong.textContent = newVal || 'Not provided';
      input.replaceWith(newStrong);
      saveBtn.replaceWith(editBtn);
    });

    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
    input.focus();
  });

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;align-items:center;gap:.5rem;flex:1;';
  actions.append(val, editBtn);

  item.append(key, actions);
  return item;
}

function rowLink(label, value, href, id) {
  const item = document.createElement('div');
  item.className = 'blank-detail-row';
  if (id) item.id = id;
  const key = document.createElement('span');
  key.textContent = label;
  const val = document.createElement('strong');
  if (value) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = value;
    link.style.cssText = 'color:var(--blue-accent);text-decoration:underline;';
    val.appendChild(link);
  } else {
    val.textContent = 'Not provided';
  }
  item.append(key, val);
  return item;
}

function formatTimeDisplay(val) {
  if (!val) return '';
  const [h, m] = val.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}

function formatPrice(val) {
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setAddressLink(el, address) {
  if (!el || address === 'Not provided') { if (el) el.textContent = address; return; }
  const link = document.createElement('a');
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = address;
  link.style.cssText = 'color:var(--blue-accent);text-decoration:underline;';
  el.textContent = '';
  el.appendChild(link);
}

function row(label, value, id) {
  const item = document.createElement('div');
  item.className = 'blank-detail-row';
  if (id) item.id = id;
  const key = document.createElement('span');
  key.textContent = label;
  const val = document.createElement('strong');
  val.textContent = value || 'Not provided';
  item.append(key, val);
  return item;
}

function renderDenied() {
  detailRoot.innerHTML = '';
}

function renderMissing() {
  detailRoot.innerHTML = '';
  const title = document.createElement('h1');
  title.textContent = 'Submission not found';
  detailRoot.appendChild(title);
}

function renderLead(lead) {
  detailRoot.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.className = 'detail-back-btn';
  backBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/></svg> Back`;
  backBtn.addEventListener('click', () => { window.location.href = 'client-panel.html'; });
  detailRoot.appendChild(backBtn);

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:.75rem;margin-bottom:.25rem;';
  const title = document.createElement('h1');
  title.textContent = lead.name || 'Client Information';
  title.style.margin = '0';
  const editContactBtn = document.createElement('button');
  editContactBtn.className = 'detail-edit-btn';
  editContactBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editContactBtn.setAttribute('aria-label', 'Edit contact info');
  titleRow.append(title, editContactBtn);
  const meta = document.createElement('p');
  meta.className = 'blank-detail-meta';
  meta.textContent = `${lead.service || 'General Inquiry'} - ${formatDate(lead.submittedAt)}`;
  const currentSt = getLeadStatus(lead);
  const grid = document.createElement('section');
  grid.className = 'blank-detail-grid';
  grid.append(
    rowStatus(lead),
    rowLink('Email', lead.email, `mailto:${lead.email}?subject=Re: Your Prestige Landscapes Request`, 'detail-email-row'),
    rowLink('Phone', lead.phone, `tel:${lead.phone}`, 'detail-phone-row'),
    row('Address', '⏳ Looking up…', 'address-row')
  );
  const prefDatesRow = row('Preferred Dates', lead.dates, 'pref-dates-row');
  if (!['Booked','Payment','Completed'].includes(currentSt)) grid.appendChild(prefDatesRow);
  const message = document.createElement('section');
  message.className = 'blank-detail-message';
  const messageLabel = document.createElement('span');
  messageLabel.textContent = 'Message';
  const messageText = document.createElement('p');
  messageText.textContent = lead.message || 'No message provided.';
  message.append(messageLabel, messageText);
  // Quoting section
  const quotingSection = document.createElement('section');
  quotingSection.className = 'quoting-section';
  quotingSection.id = 'quoting-section';
  quotingSection.hidden = !['Quoting','Booked'].includes(currentSt);

  // Payment section
  const paymentSection = document.createElement('section');
  paymentSection.className = 'quoting-section';
  paymentSection.id = 'payment-section';
  const showPaymentInit = ['Payment','Completed'].includes(currentSt);
  paymentSection.classList.toggle('hidden', !showPaymentInit);
  function buildPaymentSection() {
    const freshLead = getSubmissions().find(s => s.id === lead.id) || lead;
    const statusNow = getLeadStatus(freshLead);
    const titleEl = document.getElementById('payment-title');
    if (titleEl) titleEl.textContent = statusNow === 'Completed' ? 'Completed Details' : 'Payment Details';
    const p = freshLead.payment || {};
    const q = freshLead.quoting || {};
    document.getElementById('p-quoted').value = p.quoted ? formatPrice(p.quoted) : (q.price ? formatPrice(q.price) : '');
    document.getElementById('p-due').value = p.due ? formatPrice(p.due) : '';
    document.getElementById('p-job').value = p.job || q.job || '';
    document.getElementById('p-extras').value = p.extras || '';
    const isCompleted = statusNow === 'Completed';
    ['p-due','p-extras'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.readOnly = isCompleted; el.style.opacity = isCompleted ? '.75' : '1'; el.style.cursor = isCompleted ? 'default' : ''; }
    });
  }

  const p = lead.payment || {};
  const qCarry = lead.quoting || {};
  paymentSection.innerHTML = `
    <h3 class="quoting-title" id="payment-title">Payment Details</h3>
    <div class="quoting-grid">
      <div class="quoting-field">
        <label>Quoted Price</label>
        <div class="quoting-price-wrap"><span>$</span><input type="text" id="p-quoted" placeholder="N/A" value="${p.quoted ? formatPrice(p.quoted) : (qCarry.price ? formatPrice(qCarry.price) : '')}" autocomplete="off" readonly style="cursor:default;opacity:.75;" /></div>
      </div>
      <div class="quoting-field">
        <label>Amount Due</label>
        <div class="quoting-price-wrap"><span>$</span><input type="text" id="p-due" placeholder="N/A" value="${p.due ? formatPrice(p.due) : ''}" autocomplete="off" /></div>
      </div>
      <div class="quoting-field" style="grid-column:1/-1;">
        <label>Job Description</label>
        <textarea id="p-job" rows="3" placeholder="Describe the work completed…" readonly style="cursor:default;opacity:.75;">${p.job || qCarry.job || ''}</textarea>
      </div>
      <div class="quoting-field" style="grid-column:1/-1;">
        <label>Extras</label>
        <textarea id="p-extras" rows="3" placeholder="Any extra details, add-ons, or notes…">${p.extras || ''}</textarea>
      </div>
    </div>
    <button class="quoting-save-btn" id="p-save">Save Payment Details</button>
    <p class="quoting-saved" id="p-saved" hidden>✓ Saved</p>
  `;
  const q = lead.quoting || {};
  quotingSection.innerHTML = `
    <h3 class="quoting-title" id="quoting-title">${currentSt === 'Booked' ? 'Booking Details' : 'Quote Details'}</h3>
    <div class="quoting-grid">
      <div class="quoting-field q-only" ${currentSt !== 'Quoting' ? 'hidden' : ''}>
        <label>Job Type</label>
        <div class="quoting-checkboxes" id="q-type">
          ${['Hardscaping','Lawn Care','Landscape Design','Outdoor Lighting','Seasonal Services'].map(t => `
            <label class="quoting-checkbox-label">
              <input type="checkbox" value="${t}" ${(q.types || []).includes(t) ? 'checked' : ''} />
              ${t}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="quoting-field">
        <label>Job Description</label>
        <textarea id="q-job" rows="3" placeholder="Describe the scope of work…">${q.job || ''}</textarea>
      </div>
      <div class="quoting-field b-only" ${currentSt !== 'Booked' ? 'hidden' : ''}>
        <label>Quote Price</label>
        <div class="quoting-price-wrap"><span>$</span><input type="text" id="q-price" placeholder="N/A" value="${q.price ? formatPrice(q.price) : ''}" autocomplete="off" readonly style="cursor:default;opacity:.75;" /></div>
      </div>
      <!-- Quoting fields -->
      <div class="quoting-field q-only" ${currentSt !== 'Quoting' ? 'hidden' : ''}>
        <label>Quote Date</label>
        <input type="date" id="q-date-single" value="${q.visitDate || ''}" />
      </div>
      <div class="quoting-field q-only" ${currentSt !== 'Quoting' ? 'hidden' : ''}>
        <label>Quote Time</label>
        <input type="time" id="q-time-single" value="${q.visitTime || ''}" />
      </div>
      <!-- Booked fields -->
      <div class="quoting-field b-only" style="grid-column:1/-1;" ${currentSt !== 'Booked' ? 'hidden' : ''}>
        <label>Job Dates</label>
        <div class="quoting-date-tags" id="q-date-tags"></div>
        <div class="quoting-date-add">
          <input type="date" id="q-date-picker" />
          <button type="button" class="quoting-add-date-btn" id="q-add-date">+ Add Date</button>
        </div>
      </div>
      <div class="quoting-field b-only" ${currentSt !== 'Booked' ? 'hidden' : ''}>
        <label>Start Time</label>
        <input type="time" id="q-time-start" value="${q.timeStart || ''}" />
      </div>
      <div class="quoting-field b-only" ${currentSt !== 'Booked' ? 'hidden' : ''}>
        <label>End Time</label>
        <input type="time" id="q-time-end" value="${q.timeEnd || ''}" />
      </div>
      <div class="quoting-field b-only" style="grid-column:1/-1;" ${currentSt !== 'Booked' ? 'hidden' : ''}>
        <label>Extras</label>
        <textarea id="q-extras" rows="3" placeholder="Any extra details, add-ons, or notes…">${q.extras || ''}</textarea>
      </div>
    </div>
    <button class="quoting-save-btn" id="q-save">${currentSt === 'Booked' ? 'Save Booking Details' : 'Save Quote Details'}</button>
    <p class="quoting-saved" id="q-saved" hidden>✓ Saved</p>
  `;

  detailRoot.append(titleRow, meta, grid, message, quotingSection, paymentSection);

  // Edit contact info button
  editContactBtn.addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.className = 'contact-edit-modal';
    modal.innerHTML = `
      <div class="contact-edit-box">
        <h3>Edit Contact Info</h3>
        <label>Name</label><input id="ce-name" type="text" value="${lead.name || ''}" />
        <label>Email</label><input id="ce-email" type="email" value="${lead.email || ''}" />
        <label>Phone</label><input id="ce-phone" type="tel" value="${lead.phone || ''}" />
        <label>Street</label><input id="ce-street" type="text" value="${lead.street || ''}" />
        <label>Postal Code</label><input id="ce-zip" type="text" value="${lead.zip || ''}" />
        <label>Message</label><textarea id="ce-message" rows="3" style="padding:.6rem .8rem;border:1px solid #e2e8f0;border-radius:4px;font-size:.9rem;font-family:inherit;resize:vertical;">${lead.message || ''}</textarea>
        <div class="contact-edit-actions">
          <button class="contact-edit-cancel">Cancel</button>
          <button class="contact-edit-save">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.contact-edit-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('.contact-edit-save').addEventListener('click', () => {
      const newName = modal.querySelector('#ce-name').value.trim();
      const newEmail = modal.querySelector('#ce-email').value.trim();
      const newPhone = modal.querySelector('#ce-phone').value.trim();
      const newStreet = modal.querySelector('#ce-street').value.trim();
      const newZip = modal.querySelector('#ce-zip').value.trim();
      const newMessage = modal.querySelector('#ce-message').value.trim();

      const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
      const idx = submissions.findIndex(s => s.id === lead.id);
      if (idx >= 0) {
        submissions[idx] = { ...submissions[idx], name: newName, email: newEmail, phone: newPhone, street: newStreet, zip: newZip, message: newMessage };
        localStorage.setItem('pl_client_submissions', JSON.stringify(submissions));
        lead.name = newName; lead.email = newEmail; lead.phone = newPhone; lead.street = newStreet; lead.zip = newZip; lead.message = newMessage;
      }
      document.querySelector('.blank-detail-message p')?.replaceWith(Object.assign(document.createElement('p'), {textContent: newMessage || 'No message provided.'}));
      title.textContent = newName || 'Client Information';
      // Update email link
      const emailStrong = document.querySelector('#detail-email-row strong');
      if (emailStrong) { const a = document.createElement('a'); a.href = `mailto:${newEmail}`; a.textContent = newEmail || 'Not provided'; a.style.cssText = 'color:var(--blue-accent);text-decoration:underline;'; emailStrong.innerHTML = ''; emailStrong.appendChild(a); }
      // Update phone link
      const phoneStrong = document.querySelector('#detail-phone-row strong');
      if (phoneStrong) { const a = document.createElement('a'); a.href = `tel:${newPhone}`; a.textContent = newPhone || 'Not provided'; a.style.cssText = 'color:var(--blue-accent);text-decoration:underline;'; phoneStrong.innerHTML = ''; phoneStrong.appendChild(a); }
      modal.remove();
    });
  });

  // Apply readonly states on initial load
  if (['Payment','Completed'].includes(currentSt)) buildPaymentSection();

  // Auto-format price input
  const qPriceInput = document.getElementById('q-price');
  if (qPriceInput) {
    qPriceInput.addEventListener('focus', () => {
      // Strip formatting so user can type raw number
      qPriceInput.value = qPriceInput.value.replace(/[^0-9.]/g, '');
    });
    qPriceInput.addEventListener('blur', () => {
      const formatted = formatPrice(qPriceInput.value);
      if (formatted) qPriceInput.value = formatted;
    });
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let jobDates = [...(q.jobDates || [])];

  // Sync job type checkboxes → service field on ticket
  document.querySelectorAll('#q-type input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...document.querySelectorAll('#q-type input:checked')].map(c => c.value);
      const serviceVal = checked.length > 0 ? checked.join(', ') : 'N/A';
      const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
      const idx = submissions.findIndex(s => s.id === lead.id);
      if (idx >= 0) {
        submissions[idx].service = serviceVal;
        localStorage.setItem('pl_client_submissions', JSON.stringify(submissions));
        lead.service = serviceVal;
      }
      // Update the meta line on page
      if (meta) meta.textContent = `${serviceVal} - ${formatDate(lead.submittedAt)}`;
    });
  });

  // Multi-date picker (Booked only)

  function renderDateTags() {
    const container = document.getElementById('q-date-tags');
    if (!container) return;
    container.innerHTML = '';
    if (jobDates.length === 0) {
      container.innerHTML = '<span class="quoting-no-dates">No dates added yet</span>';
      return;
    }
    jobDates.forEach((d, i) => {
      const tag = document.createElement('span');
      tag.className = 'quoting-date-tag';
      tag.innerHTML = `${d} <button type="button" data-i="${i}" aria-label="Remove ${d}">×</button>`;
      tag.querySelector('button').addEventListener('click', e => {
        jobDates.splice(parseInt(e.target.dataset.i), 1);
        renderDateTags();
      });
      container.appendChild(tag);
    });
  }

  renderDateTags();

  document.getElementById('q-add-date')?.addEventListener('click', () => {
    const picker = document.getElementById('q-date-picker');
    if (!picker?.value) return;
    const [year, month, day] = picker.value.split('-').map(Number);
    const label = `${MONTH_NAMES[month-1]} ${day}`;
    if (!jobDates.includes(label)) { jobDates.push(label); renderDateTags(); }
    picker.value = '';
  });

  // Save quoting details
  document.getElementById('q-save')?.addEventListener('click', () => {
    const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
    const idx = submissions.findIndex(s => s.id === lead.id);
    if (idx >= 0) {
      submissions[idx].quoting = {
        types: [...document.querySelectorAll('#q-type input:checked')].map(cb => cb.value),
        job: document.getElementById('q-job')?.value || '',
        price: document.getElementById('q-price')?.value.replace(/[^0-9.]/g, '') || '',
        // Quoting fields
        visitDate: document.getElementById('q-date-single')?.value || '',
        visitTime: document.getElementById('q-time-single')?.value || '',
        // Booked fields
        jobDates,
        timeStart: document.getElementById('q-time-start')?.value || '',
        timeEnd: document.getElementById('q-time-end')?.value || '',
        extras: document.getElementById('q-extras')?.value || ''
      };
      localStorage.setItem('pl_client_submissions', JSON.stringify(submissions));
      const saved = document.getElementById('q-saved');
      if (saved) { saved.hidden = false; setTimeout(() => saved.hidden = true, 2000); }
    }
  });

  // Payment save
  document.getElementById('p-save')?.addEventListener('click', () => {
    const submissions = JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
    const idx = submissions.findIndex(s => s.id === lead.id);
    if (idx >= 0) {
      submissions[idx].payment = {
        quoted: document.getElementById('p-quoted')?.value.replace(/[^0-9.]/g, '') || '',
        due: document.getElementById('p-due')?.value.replace(/[^0-9.]/g, '') || '',
        job: document.getElementById('p-job')?.value || '',
        extras: document.getElementById('p-extras')?.value || ''
      };
      localStorage.setItem('pl_client_submissions', JSON.stringify(submissions));
      const saved = document.getElementById('p-saved');
      if (saved) { saved.hidden = false; setTimeout(() => saved.hidden = true, 2000); }
    }
  });

  // Auto-format payment price fields
  ['p-quoted','p-due'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', () => { el.value = el.value.replace(/[^0-9.]/g, ''); });
      el.addEventListener('blur', () => { const f = formatPrice(el.value); if (f) el.value = f; });
    }
  });

  // Look up full address from street + zip
  if (lead.street || lead.zip) {
    const addrRow = document.getElementById('address-row');
    const addrVal = addrRow ? addrRow.querySelector('strong') : null;

    if (lead.zip && lead.zip.trim()) {
      fetch(`https://api.zippopotam.us/us/${lead.zip.trim()}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (addrVal) {
            let fullAddress;
            if (data && data.places && data.places[0]) {
              const city = data.places[0]['place name'];
              const state = data.places[0]['state abbreviation'];
              const street = lead.street ? `${lead.street}, ` : '';
              fullAddress = `${street}${city}, ${state} ${lead.zip}`;
            } else {
              fullAddress = [lead.street, lead.zip].filter(Boolean).join(', ') || 'Not provided';
            }
            setAddressLink(addrVal, fullAddress);
          }
        })
        .catch(() => {
          if (addrVal) setAddressLink(addrVal, [lead.street, lead.zip].filter(Boolean).join(', ') || 'Not provided');
        });
    } else {
      if (addrVal) setAddressLink(addrVal, lead.street || 'Not provided');
    }
  }
}

function getSelectedLeadFallback(id) {
  try {
    const lead = JSON.parse(sessionStorage.getItem('pl_selected_lead') || 'null');
    if (!lead) return null;
    if (!id || lead.id === id) return lead;
    return null;
  } catch {
    return null;
  }
}

function init() {
  if (!ALLOWED_ROLES.includes(getCurrentRole())) {
    renderDenied();
    return;
  }
  const id = new URLSearchParams(window.location.search).get('id');
  const lead = getSubmissions().find(item => item.id === id) || getSelectedLeadFallback(id);
  if (!lead) {
    renderMissing();
    return;
  }
  renderLead(lead);
}

init();
