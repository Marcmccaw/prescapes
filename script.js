/* ============================================
   Prestige Landscapes — Scripts
   ============================================ */

// ============================================
// LOGIN / SIGNUP MODAL
// ============================================
const authBackdrop = document.getElementById('auth-backdrop');
const authModal = document.getElementById('auth-modal');
const openAuth = document.getElementById('open-auth');
const authClose = document.getElementById('auth-close');
const userDropdown = document.getElementById('user-dropdown');
let isLoggedIn = false;
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');

function openModal(tab = 'login') {
  authBackdrop.hidden = false;
  authModal.hidden = false;
  document.body.style.overflow = 'hidden';
  switchTab(tab);
}

function closeModal() {
  authBackdrop.hidden = true;
  authModal.hidden = true;
  document.body.style.overflow = '';
}

function switchTab(tab) {
  if (tab === 'login') {
    formLogin.hidden = false;
    formSignup.hidden = true;
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
  } else {
    formLogin.hidden = true;
    formSignup.hidden = false;
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
  }
}

const authNoAccount = document.getElementById('auth-no-account');
const authNoAccountMsg = document.getElementById('auth-no-account-msg');
const authChangeEmail = document.getElementById('auth-change-email');
const authGotoSignup = document.getElementById('auth-goto-signup');

// User dropdown
function autofillContactForm() {
  if (!currentUserEmail) return;
  const acc = getAccounts()[currentUserEmail];
  if (!acc) return;
  const parts = (acc.name || '').split(' ');
  const fname = document.getElementById('cf-fname');
  const lname = document.getElementById('cf-lname');
  const email = document.getElementById('cf-email');
  const phone = document.getElementById('cf-phone');
  const street = document.getElementById('cf-street');
  const zip = document.getElementById('cf-zip');
  if (fname) fname.value = parts[0] || '';
  if (lname) lname.value = parts.slice(1).join(' ') || '';
  if (email) email.value = currentUserEmail;
  if (phone) phone.value = acc.phone || '';
  if (street) street.value = acc.street || '';
  if (zip) zip.value = acc.zip || '';
}

function setLoggedInUser(name) {
  const btn = document.getElementById('open-auth');
  if (!btn) return;
  isLoggedIn = true;
  const parts = name.trim().split(' ');
  const firstName = parts[0];
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : '';
  btn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ${firstName}${lastInitial}
  `;
}

function logout() {
  isLoggedIn = false;
  const btn = document.getElementById('open-auth');
  if (!btn) return;
  btn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    Login/Signup
  `;
  if (userDropdown) userDropdown.hidden = true;
}

if (openAuth) {
  openAuth.addEventListener('click', () => {
    if (isLoggedIn) {
      userDropdown.hidden = !userDropdown.hidden;
    } else {
      openModal('login');
    }
  });
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (userDropdown && !userDropdown.hidden) {
    if (!document.querySelector('.auth-btn-wrap').contains(e.target)) {
      userDropdown.hidden = true;
    }
  }
});

// ---- Booked Modal ----
const bookedBackdrop = document.getElementById('booked-backdrop');
const bookedModal = document.getElementById('booked-modal');
const bookedClose = document.getElementById('booked-close');
const bookedList = document.getElementById('booked-list');
const dropdownBooked = document.getElementById('dropdown-booked');

function getBookings() { return JSON.parse(localStorage.getItem(`pl_bookings_${currentUserEmail}`) || '[]'); }
function saveBooking(booking) {
  const bookings = getBookings();
  bookings.unshift(booking);
  localStorage.setItem(`pl_bookings_${currentUserEmail}`, JSON.stringify(bookings));
}

function openBooked() {
  const bookings = getBookings();
  bookedList.innerHTML = '';
  if (bookings.length === 0) {
    bookedList.innerHTML = '<p class="booked-empty">No bookings yet.<br>Submit the Get in Touch form to schedule a visit.</p>';
  } else {
    bookings.forEach((b, i) => {
      const item = document.createElement('div');
      item.className = 'booked-item';
      item.innerHTML = `
        <div class="booked-item-header">
          <span class="booked-item-status">Pending</span>
          <span class="booked-item-date">Submitted ${b.submittedOn}</span>
        </div>
        <div class="booked-item-service">${b.service || 'General Inquiry'}</div>
        <div class="booked-item-slots">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${b.dates || 'No dates selected'}
        </div>
        <div class="booked-item-actions">
          <button class="booked-btn-edit" data-index="${i}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="booked-btn-cancel" data-index="${i}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Cancel
          </button>
        </div>
      `;
      bookedList.appendChild(item);
    });

    // Cancel
    bookedList.querySelectorAll('.booked-btn-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        const bookings = getBookings();
        bookings.splice(idx, 1);
        localStorage.setItem(`pl_bookings_${currentUserEmail}`, JSON.stringify(bookings));
        openBooked();
      });
    });

    // Edit — scroll to form and pre-fill service
    bookedList.querySelectorAll('.booked-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        const b = getBookings()[idx];
        closeBooked();
        const serviceEl = document.getElementById('cf-service');
        if (serviceEl && b.service) {
          Array.from(serviceEl.options).forEach(opt => {
            if (opt.text === b.service) serviceEl.value = opt.value;
          });
        }
        document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }
  bookedBackdrop.hidden = false;
  bookedModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeBooked() {
  bookedBackdrop.hidden = true;
  bookedModal.hidden = true;
  document.body.style.overflow = '';
}

if (bookedClose) bookedClose.addEventListener('click', closeBooked);
if (bookedBackdrop) bookedBackdrop.addEventListener('click', closeBooked);
if (dropdownBooked) dropdownBooked.addEventListener('click', () => { userDropdown.hidden = true; openBooked(); });

const dropdownSettings = document.getElementById('dropdown-settings');
const dropdownLogout = document.getElementById('dropdown-logout');
// ---- Settings Modal ----
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const formSettings = document.getElementById('form-settings');
let currentUserEmail = null;

function openSettings() {
  if (!currentUserEmail) return;
  const accounts = getAccounts();
  const acc = accounts[currentUserEmail];
  if (!acc) return;
  const nameParts = (acc.name || '').split(' ');
  document.getElementById('set-fname').value = nameParts[0] || '';
  document.getElementById('set-lname').value = nameParts.slice(1).join(' ') || '';
  document.getElementById('set-email').value = currentUserEmail;
  document.getElementById('set-phone').value = acc.phone || '';
  document.getElementById('set-street').value = acc.street || '';
  document.getElementById('set-zip').value = acc.zip || '';
  document.getElementById('set-pass').value = '';
  document.getElementById('set-confirm').value = '';
  settingsBackdrop.hidden = false;
  settingsModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  settingsBackdrop.hidden = true;
  settingsModal.hidden = true;
  document.body.style.overflow = '';
}

if (settingsClose) settingsClose.addEventListener('click', closeSettings);
if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);

if (formSettings) formSettings.addEventListener('submit', e => {
  e.preventDefault();
  formSettings.querySelectorAll('.auth-error').forEach(el => el.remove());
  const fname = document.getElementById('set-fname').value.trim();
  const lname = document.getElementById('set-lname').value.trim();
  const email = document.getElementById('set-email').value.trim().toLowerCase();
  const phone = document.getElementById('set-phone').value.trim();
  const street = document.getElementById('set-street').value.trim();
  const zip = document.getElementById('set-zip').value.trim();
  const pass = document.getElementById('set-pass').value;
  const confirm = document.getElementById('set-confirm').value;

  if (pass && pass !== confirm) {
    const err = document.createElement('p');
    err.className = 'auth-error';
    err.textContent = 'Passwords do not match.';
    document.getElementById('set-confirm').after(err);
    return;
  }

  const accounts = getAccounts();
  const acc = accounts[currentUserEmail];
  const newAcc = {
    ...acc,
    name: `${fname} ${lname}`.trim(),
    phone, street, zip,
    password: pass || acc.password
  };

  // Handle email change
  if (email !== currentUserEmail) {
    delete accounts[currentUserEmail];
  }
  accounts[email] = newAcc;
  currentUserEmail = email;
  localStorage.setItem('pl_accounts', JSON.stringify(accounts));
  setLoggedInUser(newAcc.name);
  closeSettings();
  autofillContactForm();
});

if (dropdownSettings) dropdownSettings.addEventListener('click', () => {
  userDropdown.hidden = true;
  openSettings();
});
if (dropdownLogout) dropdownLogout.addEventListener('click', () => {
  userDropdown.hidden = true;
  logout();
});

// Account helpers using localStorage
function getAccounts() { return JSON.parse(localStorage.getItem('pl_accounts') || '{}'); }
function saveAccount(email, data) {
  const accounts = getAccounts();
  accounts[email.toLowerCase()] = data;
  localStorage.setItem('pl_accounts', JSON.stringify(accounts));
}
function accountExists(email) { return !!getAccounts()[email.toLowerCase()]; }

function showNoAccount(msg) {
  authNoAccount.hidden = false;
  formLogin.hidden = true;
  formSignup.hidden = true;
  authNoAccountMsg.textContent = msg;
}

function hideNoAccount() {
  authNoAccount.hidden = true;
}

if (authClose) authClose.addEventListener('click', closeModal);
if (authBackdrop) authBackdrop.addEventListener('click', closeModal);

if (tabLogin) tabLogin.addEventListener('click', () => { hideNoAccount(); switchTab('login'); });
if (tabSignup) tabSignup.addEventListener('click', () => { hideNoAccount(); switchTab('signup'); });

document.querySelectorAll('.auth-switch-btn').forEach(btn => {
  btn.addEventListener('click', () => { hideNoAccount(); switchTab(btn.dataset.switch); });
});

// No account dialog buttons
if (authChangeEmail) authChangeEmail.addEventListener('click', () => { hideNoAccount(); switchTab('login'); });
if (authGotoSignup) authGotoSignup.addEventListener('click', () => { hideNoAccount(); switchTab('signup'); });

// Login submit
if (formLogin) formLogin.addEventListener('submit', e => {
  e.preventDefault();
  const email = formLogin.querySelector('input[type="email"]').value.trim();
  const pass = formLogin.querySelector('input[type="password"]').value;
  const accounts = getAccounts();
  const account = accounts[email.toLowerCase()];

  // Remove any old error
  formLogin.querySelectorAll('.auth-error').forEach(el => el.remove());

  if (!account) {
    showNoAccount("We don't have an account under that email address.");
    return;
  }
  if (account.password !== pass) {
    const err = document.createElement('p');
    err.className = 'auth-error';
    err.textContent = 'Incorrect password. Please try again.';
    formLogin.querySelector('.auth-submit').before(err);
    return;
  }
  // Success
  currentUserEmail = email.toLowerCase();
  closeModal();
  setLoggedInUser(account.name);
  autofillContactForm();
});

// Signup submit
if (formSignup) formSignup.addEventListener('submit', e => {
  e.preventDefault();
  const inputs = formSignup.querySelectorAll('input');
  const firstName = inputs[0].value.trim();
  const lastName = inputs[1].value.trim();
  const name = `${firstName} ${lastName}`;
  const email = inputs[2].value.trim();
  const phone = inputs[3].value.trim();
  const pass = inputs[4].value;
  const confirm = inputs[5].value;

  formSignup.querySelectorAll('.auth-error').forEach(el => el.remove());

  if (accountExists(email)) {
    const err = document.createElement('p');
    err.className = 'auth-error';
    err.textContent = 'An account with this email already exists.';
    inputs[2].after(err);
    return;
  }
  if (pass !== confirm) {
    const err = document.createElement('p');
    err.className = 'auth-error';
    err.textContent = 'Passwords do not match.';
    inputs[5].after(err);
    return;
  }
  saveAccount(email, { name, phone, password: pass });
  currentUserEmail = email.toLowerCase();
  closeModal();
  setLoggedInUser(name);
  autofillContactForm();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !authModal.hidden) closeModal();
});

// ---- Navbar scroll shadow ----
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ---- Home link always active, scrolls to top ----
const homeLink = document.getElementById('home-link');
if (homeLink) {
  homeLink.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ---- Mobile hamburger ----
const hamburger = document.getElementById('hamburger');
const navLinksEl = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
  const isOpen = navLinksEl.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
});

navLinksEl.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinksEl.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

document.addEventListener('click', e => {
  if (!navbar.contains(e.target)) {
    navLinksEl.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

// ============================================
// GALLERY LIGHTBOX
// ============================================
const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxBackdrop = document.getElementById('lightbox-backdrop');

let currentIndex = 0;

function openLightbox(index) {
  currentIndex = index;
  const item = galleryItems[index];
  const img = item.querySelector('img');
  const label = item.querySelector('.gallery-overlay span').textContent;
  lightboxImg.src = img.src;
  lightboxImg.alt = img.alt;
  lightboxCaption.textContent = label;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  lightboxClose.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
  galleryItems[currentIndex].focus();
}

function showPrev() {
  currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
  openLightbox(currentIndex);
}

function showNext() {
  currentIndex = (currentIndex + 1) % galleryItems.length;
  openLightbox(currentIndex);
}

galleryItems.forEach((item, i) => item.addEventListener('click', () => openLightbox(i)));
lightboxClose.addEventListener('click', closeLightbox);
lightboxBackdrop.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', showPrev);
lightboxNext.addEventListener('click', showNext);

document.addEventListener('keydown', e => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') showPrev();
  if (e.key === 'ArrowRight') showNext();
});

// ============================================
// SHARED CONSTANTS
// ============================================
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TIME_SLOTS = ['8am – 12pm', '12pm – 4pm', '4pm – 8pm'];
const MIN_DATES = 2;
const MAX_DATES = 3;

const preferredDateInput = document.getElementById('cf-date');
const dateTimePicker = document.getElementById('date-time-picker');
const calSelectedLabel = document.getElementById('cal-selected-label');

// calendar tracks selected dates; selectedTimes maps dateKey -> [slots]
let selectedDates = [];
let selectedTimes = {};

// ============================================
// FORM DATE+TIME PICKER
// ============================================
function buildFormPicker() {
  if (!dateTimePicker) return;
  dateTimePicker.innerHTML = '';

  if (selectedDates.length === 0) {
    dateTimePicker.innerHTML = '<p class="dt-empty">Select dates from the calendar →</p>';
    if (preferredDateInput) preferredDateInput.value = '';
    return;
  }

  [...selectedDates].sort((a, b) => a - b).forEach(date => {
    const key = date.toDateString();
    const dayLabel = `${DAYS[date.getDay()]} ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;

    const row = document.createElement('div');
    row.className = 'dt-row';

    const dateCol = document.createElement('div');
    dateCol.className = 'dt-date';
    dateCol.textContent = dayLabel;

    const slotsCol = document.createElement('div');
    slotsCol.className = 'dt-slots';

    TIME_SLOTS.forEach(slot => {
      const isSelected = selectedTimes[key] && selectedTimes[key].includes(slot);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dt-slot' + (isSelected ? ' dt-slot-selected' : '');
      btn.textContent = slot;
      btn.addEventListener('click', () => {
        if (!selectedTimes[key]) selectedTimes[key] = [];
        const idx = selectedTimes[key].indexOf(slot);
        if (idx >= 0) selectedTimes[key].splice(idx, 1);
        else selectedTimes[key].push(slot);
        buildFormPicker();
        updateFormValue();
      });
      slotsCol.appendChild(btn);
    });

    row.appendChild(dateCol);
    row.appendChild(slotsCol);
    dateTimePicker.appendChild(row);
  });

  updateFormValue();
}

function updateFormValue() {
  const parts = [...selectedDates].sort((a, b) => a - b).map(date => {
    const key = date.toDateString();
    const dayLabel = `${DAYS[date.getDay()]} ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
    const times = (selectedTimes[key] || []).join(', ');
    return times ? `${dayLabel}: ${times}` : dayLabel;
  });
  if (preferredDateInput) preferredDateInput.value = parts.join(' | ');
}

buildFormPicker();

// ============================================
// CALENDAR (right panel — picks dates)
// ============================================
const calTitle = document.getElementById('cal-title');
const calDays = document.getElementById('cal-days');
const calPrev = document.getElementById('cal-prev');
const calNext = document.getElementById('cal-next');

const today = new Date();
today.setHours(0, 0, 0, 0);
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();

function renderCalendar() {
  if (!calTitle) return;
  calTitle.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
  calDays.innerHTML = '';

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day cal-day-empty';
    empty.setAttribute('aria-hidden', 'true');
    calDays.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSelected = selectedDates.some(s => s.toDateString() === date.toDateString());

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = d;
    btn.setAttribute('aria-label', `${MONTHS[viewMonth]} ${d}`);

    if (isPast) {
      btn.classList.add('cal-day-past');
      btn.disabled = true;
    } else if (isSelected) {
      btn.classList.add('cal-day-selected');
    } else if (isToday) {
      btn.classList.add('cal-day-today');
    }

    if (!isPast) {
      btn.addEventListener('click', () => {
        const key = date.toDateString();
        const idx = selectedDates.findIndex(s => s.toDateString() === key);
        if (idx >= 0) {
          selectedDates.splice(idx, 1);
          delete selectedTimes[key];
        } else if (selectedDates.length < MAX_DATES) {
          selectedDates.push(date);
          selectedTimes[key] = [];
        }
        const count = selectedDates.length;
        if (calSelectedLabel) {
          calSelectedLabel.textContent = count === 0
            ? 'Click dates to select (2–3)'
            : `${count} date${count > 1 ? 's' : ''} selected — pick times in the form`;
        }
        renderCalendar();
        buildFormPicker();
      });
    }

    calDays.appendChild(btn);
  }
}

if (calPrev) calPrev.addEventListener('click', () => {
  viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderCalendar();
});
if (calNext) calNext.addEventListener('click', () => {
  viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCalendar();
});

renderCalendar();

// ============================================
// CONTACT FORM VALIDATION
// ============================================
const contactForm = document.getElementById('contact-form');
const sendBtn = document.getElementById('send-btn');
const sendText = sendBtn.querySelector('.send-text');
const sendSpinner = sendBtn.querySelector('.send-spinner');

const validators = {
  'cf-fname':   v => v.trim() ? '' : 'First name is required.',
  'cf-lname':   v => v.trim() ? '' : 'Last name is required.',
  'cf-email':   v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Valid email required.',
  'cf-phone':   v => v.trim() ? '' : 'Phone number is required.',
  'cf-service': v => v ? '' : 'Please select a service.',
  'cf-date':    () => {
    if (selectedDates.length < MIN_DATES) return 'Please select 2–3 dates from the calendar.';
    const missingTimes = selectedDates.some(d => !selectedTimes[d.toDateString()] || selectedTimes[d.toDateString()].length === 0);
    if (missingTimes) return 'Please select at least one time slot for each date.';
    return '';
  },
};

function showFieldError(id, msg) {
  const input = document.getElementById(id);
  const errEl = document.getElementById(`${id}-error`);
  if (input) input.classList.toggle('error', !!msg);
  if (errEl) errEl.textContent = msg || '';
}

function validateField(id) {
  const input = document.getElementById(id);
  if (!input || !validators[id]) return true;
  const error = validators[id](input.value);
  showFieldError(id, error);
  return !error;
}

// ---- Phone auto-format (XXX-XXX-XXXX) with cursor preservation ----
function applyPhoneFormat(input) {
  input.addEventListener('input', e => {
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

const phoneInput = document.getElementById('cf-phone');
if (phoneInput) applyPhoneFormat(phoneInput);
const authPhone = document.getElementById('auth-phone');
if (authPhone) applyPhoneFormat(authPhone);
const setPhone = document.getElementById('set-phone');
if (setPhone) applyPhoneFormat(setPhone);

if (phoneInput) {
  phoneInput.addEventListener('input', e => {
    const input = e.target;
    const cursorPos = input.selectionStart;

    // Count how many digits were before the cursor before formatting
    const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/\D/g, '').length;

    // Format
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) formatted = digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
    else if (digits.length > 3) formatted = digits.slice(0,3) + '-' + digits.slice(3);
    input.value = formatted;

    // Restore cursor: walk formatted string counting digits until we hit digitsBeforeCursor
    let digitCount = 0;
    let newPos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) digitCount++;
      if (digitCount === digitsBeforeCursor) { newPos = i + 1; break; }
    }
    if (digitsBeforeCursor === 0) newPos = 0;
    // If cursor lands right before a dash, nudge it past
    while (newPos < formatted.length && formatted[newPos] === '-') newPos++;
    input.setSelectionRange(newPos, newPos);
  });
}

// Map validator IDs to their error span IDs
const errorIds = {
  'cf-fname': 'cf-name-error',
  'cf-lname': 'cf-name-error',
};

// Clear error on input after failed submit
Object.keys(validators).forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      if (el.classList.contains('error')) validateField(id);
    });
    el.addEventListener('change', () => {
      if (el.classList.contains('error')) validateField(id);
    });
  }
});

contactForm.addEventListener('submit', async e => {
  e.preventDefault();
  const fields = Object.keys(validators);
  const valid = fields.map(id => validateField(id)).every(Boolean);
  if (!valid) {
    const firstErr = fields.find(id => !validateField(id));
    if (firstErr) document.getElementById(firstErr)?.focus();
    return;
  }

  sendBtn.disabled = true;
  sendText.hidden = true;
  sendSpinner.hidden = false;

  await new Promise(r => setTimeout(r, 1200));

  // Reset button back to normal
  sendBtn.disabled = false;
  sendText.hidden = false;
  sendSpinner.hidden = true;

  // Save booking if logged in
  if (currentUserEmail) {
    const serviceEl = document.getElementById('cf-service');
    const serviceText = serviceEl ? serviceEl.options[serviceEl.selectedIndex]?.text : '';
    saveBooking({
      submittedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      service: serviceText || 'General Inquiry',
      dates: preferredDateInput ? preferredDateInput.value : ''
    });
  }

  // Reset form
  contactForm.reset();
  selectedSlots = [];
  calSelectedLabel.textContent = 'No slots selected';
  buildPicker();
});
