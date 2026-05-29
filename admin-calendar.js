const ADMIN_ALLOWED_ROLES = ['dev', 'manager'];
const ADMIN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ADMIN_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ADMIN_DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const ADMIN_TIMELINE_START = 6;
const ADMIN_TIMELINE_END = 21;
const ADMIN_TIMELINE_ROW = 56;
const ADMIN_GOOGLE_CALENDAR_ID = 'contact.presscapes@gmail.com';
const ADMIN_GOOGLE_LIVE_KEY = 'AIzaSyCa9lOa_lIGV6HSS3ZKzIfxwz2Te1w9L8g';
const ADMIN_GOOGLE_DEV_KEY = 'AIzaSyBoqEPFwx5PwX6rgaaePU0xt2IKf-nRNlA';

const adminShell = document.getElementById('admin-calendar-shell');
const adminDenied = document.getElementById('admin-calendar-denied');
const adminCalTitle = document.getElementById('admin-cal-title');
const adminCalDays = document.getElementById('admin-cal-days');
const adminCalPrev = document.getElementById('admin-cal-prev');
const adminCalNext = document.getElementById('admin-cal-next');
const adminWeekTitle = document.getElementById('admin-week-title');
const adminWeekSub = document.getElementById('admin-week-sub');
const adminTimeline = document.getElementById('admin-calendar-timeline');
const adminEventBackdrop = document.getElementById('admin-event-backdrop');
const adminEventModal = document.getElementById('admin-event-modal');
const adminEventClose = document.getElementById('admin-event-close');
const adminEventTitle = document.getElementById('admin-event-title');
const adminEventType = document.getElementById('admin-event-type');
const adminEventDetails = document.getElementById('admin-event-details');

const adminToday = new Date();
adminToday.setHours(0, 0, 0, 0);
let adminViewYear = adminToday.getFullYear();
let adminViewMonth = adminToday.getMonth();
let adminSelectedDateKey = adminDateKey(adminToday);
let adminEvents = [];

function getSubmissions() {
  return JSON.parse(localStorage.getItem('pl_client_submissions') || '[]');
}

function getLeadStatus(lead) {
  if (lead?.status === 'Approved' || lead?.status === 'Quoteing') return 'Quoting';
  return ['Pending', 'Quoting', 'Booked', 'Payment', 'Completed'].includes(lead?.status) ? lead.status : 'Pending';
}

function getAccounts() {
  return JSON.parse(localStorage.getItem('pl_accounts') || '{}');
}

function getCurrentUserEmail() {
  return localStorage.getItem('pl_current_user') || '';
}

function getCurrentRole() {
  const account = getAccounts()[getCurrentUserEmail()];
  return String(account?.role || 'client').toLowerCase();
}

function adminDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function escapeAdminHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function adminCalendarKey() {
  return ['localhost', '127.0.0.1', ''].includes(window.location.hostname) ? ADMIN_GOOGLE_DEV_KEY : ADMIN_GOOGLE_LIVE_KEY;
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return adminDateKey(date);
}

function toTimeValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getEventKind(event) {
  const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
  if (text.includes('quote')) return 'quote';
  if (text.includes('booked')) return 'booked';
  return 'event';
}

function getJobType(event) {
  const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
  if (text.includes('lawn')) return 'lawn-care';
  if (text.includes('hardscap') || text.includes('paver') || text.includes('patio')) return 'hardscaping';
  if (text.includes('light')) return 'outdoor-lighting';
  if (text.includes('seasonal') || text.includes('cleanup')) return 'seasonal-services';
  if (text.includes('landscap') || text.includes('mulch') || text.includes('plant')) return 'landscaping';
  return 'other';
}

function googleEventToAdminEvent(event) {
  const startValue = event.start?.dateTime || event.start?.date || '';
  const endValue = event.end?.dateTime || event.end?.date || '';
  const key = toDateKey(startValue);
  if (!key) return null;
  return {
    id: event.id,
    key,
    title: event.summary || 'Untitled Event',
    description: event.description || '',
    location: event.location || '',
    timeStart: event.start?.dateTime ? toTimeValue(startValue) : '',
    timeEnd: event.end?.dateTime ? toTimeValue(endValue) : '',
    htmlLink: event.htmlLink || '',
    leadId: event.extendedProperties?.private?.prestigeLeadId || '',
    typeKey: getJobType(event),
    kind: getEventKind(event)
  };
}

function findLeadForEvent(event) {
  const submissions = getSubmissions();
  if (event.leadId) {
    const lead = submissions.find(item => item.id === event.leadId);
    if (lead) return lead;
  }
  return submissions.find(lead => {
    const quote = lead.quoting || {};
    if (quote.googleEventId && quote.googleEventId === event.id) return true;
    const bookedEvents = quote.googleBookedEvents || {};
    return Object.values(bookedEvents).some(item => item?.id === event.id);
  }) || null;
}

function formatAdminDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAdminDateList(values) {
  const dates = Array.isArray(values) ? values.filter(Boolean) : [];
  return dates.length ? dates.map(formatAdminDate).join(', ') : 'Not provided';
}

function formatAdminPrice(value) {
  const number = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isNaN(number) ? 'Not provided' : `$${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatAdminSubmitted(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function modalField(label, value, wide = false) {
  return `
    <div class="${wide ? 'admin-event-detail-wide' : ''}">
      <span>${escapeAdminHtml(label)}</span>
      <strong>${escapeAdminHtml(value || 'Not provided')}</strong>
    </div>
  `;
}

function modalParagraph(label, value) {
  return value ? `
    <div class="admin-event-detail-wide">
      <span>${escapeAdminHtml(label)}</span>
      <p>${escapeAdminHtml(value)}</p>
    </div>
  ` : '';
}

function buildLeadDetails(event, lead) {
  if (!lead) {
    return `
      ${modalField('Date', formatAdminDate(event.key))}
      ${modalField('Time', formatAdminTime(event.timeStart, event.timeEnd))}
      ${event.location ? modalField('Location', event.location, true) : ''}
      ${modalParagraph('Calendar Description', event.description)}
      <div class="admin-event-detail-wide admin-event-missing-lead">
        <span>Client Panel Match</span>
        <p>No matching saved submission was found for this Google Calendar event.</p>
      </div>
    `;
  }

  const quote = lead.quoting || {};
  const payment = lead.payment || {};
  const status = getLeadStatus(lead);
  const serviceTypes = Array.isArray(quote.types) && quote.types.length ? quote.types.join(', ') : (lead.service || 'Not provided');
  const isBooked = status === 'Booked' || event.kind === 'booked';

  const scheduleFields = isBooked ? `
    ${modalField('Job Dates', formatAdminDateList(quote.jobDateValues), true)}
    ${modalField('Start Time', formatAdminTime(quote.timeStart, ''))}
    ${modalField('End Time', formatAdminTime(quote.timeEnd, ''))}
    ${modalField('Quoted Price', formatAdminPrice(quote.price))}
    ${modalParagraph('Job Description', quote.job)}
    ${modalParagraph('Extras', quote.extras)}
  ` : `
    ${modalField('Quote Date', formatAdminDate(quote.visitDate || event.key))}
    ${modalField('Quote Time', formatAdminTime(quote.visitTime || event.timeStart, ''))}
    ${modalField('Quote Type', serviceTypes, true)}
    ${modalField('Quoted Price', formatAdminPrice(quote.price))}
    ${modalParagraph('Job Description', quote.job)}
    ${modalParagraph('Quote Notes', quote.notes)}
  `;

  const paymentFields = ['Payment', 'Completed'].includes(status) ? `
    <div class="admin-event-section-title">Payment Information</div>
    ${modalField('Quoted Amount', formatAdminPrice(payment.quoted || quote.price))}
    ${modalField('Amount Due', formatAdminPrice(payment.due))}
    ${modalParagraph('Payment Job Notes', payment.job)}
    ${modalParagraph('Payment Notes', payment.extras)}
  ` : '';

  return `
    <div class="admin-event-section-title">Client Information</div>
    ${modalField('Status', status)}
    ${modalField('Service', lead.service || serviceTypes)}
    ${modalField('Name', lead.name)}
    ${modalField('Email', lead.email)}
    ${modalField('Phone', lead.phone)}
    ${modalField('Address', [lead.street, lead.zip].filter(Boolean).join(', '), true)}
    ${modalField('Preferred Dates', lead.dates, true)}
    ${modalField('Submitted', formatAdminSubmitted(lead.submittedAt))}
    ${modalField('Source', lead.source)}
    ${lead.accountEmail && lead.accountEmail !== lead.email ? modalField('Account Email', lead.accountEmail) : ''}
    ${modalParagraph('Request Message', lead.message)}
    <div class="admin-event-section-title">${isBooked ? 'Booking Information' : 'Quoting Information'}</div>
    ${scheduleFields}
    <div class="admin-event-section-title">Calendar Information</div>
    ${modalField('Calendar Title', event.title, true)}
    ${modalField('Calendar Date', formatAdminDate(event.key))}
    ${modalField('Calendar Time', formatAdminTime(event.timeStart, event.timeEnd))}
    ${modalParagraph('Calendar Description', event.description)}
    ${paymentFields}
  `;
}

async function loadAdminEvents() {
  const timeMin = new Date(adminViewYear, adminViewMonth - 1, 1).toISOString();
  const timeMax = new Date(adminViewYear, adminViewMonth + 2, 0, 23, 59, 59).toISOString();
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ADMIN_GOOGLE_CALENDAR_ID)}/events`);
  url.search = new URLSearchParams({
    key: adminCalendarKey(),
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    showDeleted: 'false'
  }).toString();

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Calendar returned ${response.status}`);
  const data = await response.json();
  adminEvents = (data.items || []).map(googleEventToAdminEvent).filter(Boolean);
}

function getWeekDates(date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatAdminTime(start, end) {
  const format = value => {
    if (!value) return '';
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours)) return value;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, '0')} ${suffix}`;
  };
  const startText = format(start);
  const endText = format(end);
  return startText && endText ? `${startText} - ${endText}` : startText || endText || 'All day';
}

function minutesFromTime(value, fallbackHour) {
  if (!value) return fallbackHour * 60;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours)) return fallbackHour * 60;
  return hours * 60 + (Number.isNaN(minutes) ? 0 : minutes);
}

function timelineBlockStyle(event) {
  const start = Math.max(minutesFromTime(event.timeStart, ADMIN_TIMELINE_START), ADMIN_TIMELINE_START * 60);
  const end = Math.min(minutesFromTime(event.timeEnd, ADMIN_TIMELINE_START + 1), ADMIN_TIMELINE_END * 60);
  const duration = Math.max(end - start, 45);
  const top = ((start - ADMIN_TIMELINE_START * 60) / 60) * ADMIN_TIMELINE_ROW;
  const height = (duration / 60) * ADMIN_TIMELINE_ROW;
  const left = `calc(${event.weekDay * (100 / 7)}% + .45rem)`;
  const width = `calc(${100 / 7}% - .9rem)`;
  return `left:${left};width:${width};top:${top}px;height:${height}px;`;
}

function renderAdminMonth() {
  adminCalTitle.textContent = `${ADMIN_MONTHS[adminViewMonth]} ${adminViewYear}`;
  adminCalDays.innerHTML = '';
  const eventsByDate = adminEvents.reduce((map, event) => {
    if (!map.has(event.key)) map.set(event.key, []);
    map.get(event.key).push(event);
    return map;
  }, new Map());
  const firstDay = new Date(adminViewYear, adminViewMonth, 1).getDay();
  const daysInMonth = new Date(adminViewYear, adminViewMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day cal-day-empty';
    empty.setAttribute('aria-hidden', 'true');
    adminCalDays.appendChild(empty);
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const date = new Date(adminViewYear, adminViewMonth, dayNumber);
    const key = adminDateKey(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cal-day';
    button.textContent = dayNumber;
    button.setAttribute('aria-label', `${ADMIN_MONTHS[adminViewMonth]} ${dayNumber}`);
    if (date.getTime() === adminToday.getTime()) button.classList.add('cal-day-today');
    if (eventsByDate.has(key)) button.classList.add('cal-day-has-job');
    if (key === adminSelectedDateKey) button.classList.add('cal-day-selected');
    button.addEventListener('click', () => {
      adminSelectedDateKey = key;
      renderAdminMonth();
      renderAdminWeek(date);
    });
    adminCalDays.appendChild(button);
  }
}

function renderAdminWeek(date) {
  const weekDates = getWeekDates(date);
  const weekKeys = weekDates.map(adminDateKey);
  const weekEvents = adminEvents
    .filter(event => weekKeys.includes(event.key))
    .map(event => ({ ...event, weekDay: weekKeys.indexOf(event.key) }));
  const weekLabel = `${ADMIN_MONTHS_SHORT[weekDates[0].getMonth()]} ${weekDates[0].getDate()} - ${ADMIN_MONTHS_SHORT[weekDates[6].getMonth()]} ${weekDates[6].getDate()}`;
  adminWeekTitle.textContent = weekLabel;
  adminWeekSub.textContent = `${weekEvents.length} event${weekEvents.length === 1 ? '' : 's'} this week`;

  const hours = [];
  for (let hour = ADMIN_TIMELINE_START; hour <= ADMIN_TIMELINE_END; hour++) {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hours.push(`<div class="admin-timeline-hour"><span>${hour % 12 || 12} ${suffix}</span></div>`);
  }

  adminTimeline.innerHTML = `
    <div class="admin-timeline" style="--timeline-height:${(ADMIN_TIMELINE_END - ADMIN_TIMELINE_START + 1) * ADMIN_TIMELINE_ROW}px;">
      <div class="admin-week-header" style="grid-column:2;">
        ${weekDates.map(day => `
          <div class="${adminDateKey(day) === adminSelectedDateKey ? 'admin-week-day active' : 'admin-week-day'}">
            <span>${ADMIN_DAYS_SHORT[day.getDay()]}</span>
            <strong>${ADMIN_MONTHS_SHORT[day.getMonth()]} ${day.getDate()}</strong>
          </div>
        `).join('')}
      </div>
      <div class="admin-timeline-hours">${hours.join('')}</div>
      <div class="admin-timeline-events">
        ${weekEvents.map(event => `
          <button class="admin-timeline-event admin-job-${escapeAdminHtml(event.typeKey)}" type="button" data-event-id="${escapeAdminHtml(event.id)}" style="${timelineBlockStyle(event)}">
            <span>${escapeAdminHtml(formatAdminTime(event.timeStart, event.timeEnd))}</span>
            <strong>${escapeAdminHtml(event.title)}</strong>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  adminTimeline.querySelectorAll('.admin-timeline-event').forEach(button => {
    button.addEventListener('click', () => {
      const event = adminEvents.find(item => item.id === button.dataset.eventId);
      if (event) openEventModal(event);
    });
  });
}

function openEventModal(event) {
  const lead = findLeadForEvent(event);
  adminEventType.textContent = event.kind === 'booked' ? 'Booked Job' : event.kind === 'quote' ? 'Quote Appointment' : 'Calendar Event';
  adminEventTitle.textContent = lead?.name || event.title;
  adminEventDetails.innerHTML = buildLeadDetails(event, lead);
  adminEventBackdrop.hidden = false;
  adminEventModal.hidden = false;
}

function closeEventModal() {
  adminEventBackdrop.hidden = true;
  adminEventModal.hidden = true;
}

async function initAdminCalendar() {
  if (window.PrestigeFirebase) {
    try { await window.PrestigeFirebase.ready; } catch {}
  }
  if (!ADMIN_ALLOWED_ROLES.includes(getCurrentRole())) {
    adminDenied.innerHTML = `
      <h1>Admin Cal</h1>
      <p>This page is only available to Dev and Manager accounts.</p>
      <a href="index.html" class="btn-solid-blue">Back Home</a>
    `;
    adminDenied.hidden = false;
    return;
  }
  adminShell.hidden = false;
  renderAdminMonth();
  renderAdminWeek(adminToday);
  try {
    await loadAdminEvents();
    renderAdminMonth();
    renderAdminWeek(new Date(`${adminSelectedDateKey}T00:00:00`));
  } catch (err) {
    adminWeekSub.textContent = 'Could not load Google Calendar events.';
    console.warn('Could not load admin calendar:', err);
  }
}

adminCalPrev?.addEventListener('click', async () => {
  adminViewMonth--;
  if (adminViewMonth < 0) { adminViewMonth = 11; adminViewYear--; }
  adminSelectedDateKey = adminDateKey(new Date(adminViewYear, adminViewMonth, 1));
  await loadAdminEvents().catch(err => console.warn('Could not load admin calendar:', err));
  renderAdminMonth();
  renderAdminWeek(new Date(`${adminSelectedDateKey}T00:00:00`));
});

adminCalNext?.addEventListener('click', async () => {
  adminViewMonth++;
  if (adminViewMonth > 11) { adminViewMonth = 0; adminViewYear++; }
  adminSelectedDateKey = adminDateKey(new Date(adminViewYear, adminViewMonth, 1));
  await loadAdminEvents().catch(err => console.warn('Could not load admin calendar:', err));
  renderAdminMonth();
  renderAdminWeek(new Date(`${adminSelectedDateKey}T00:00:00`));
});

adminEventClose?.addEventListener('click', closeEventModal);
adminEventBackdrop?.addEventListener('click', closeEventModal);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !adminEventModal.hidden) closeEventModal();
});

initAdminCalendar();
