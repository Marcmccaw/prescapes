/* ============================================
   Public scheduled work calendar
   ============================================ */
const PUBLIC_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PUBLIC_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PUBLIC_DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 21;
const TIMELINE_ROW_HEIGHT = 56;
const GOOGLE_CALENDAR_ID = 'contact.presscapes@gmail.com';
const GOOGLE_CALENDAR_LIVE_KEY = 'AIzaSyCa9lOa_lIGV6HSS3ZKzIfxwz2Te1w9L8g';
const GOOGLE_CALENDAR_DEV_KEY = 'AIzaSyBoqEPFwx5PwX6rgaaePU0xt2IKf-nRNlA';
const JOB_TYPES = [
  { key: 'lawn-care', label: 'Lawn Care', terms: ['lawn care', 'lawn', 'mowing', 'grass'] },
  { key: 'hardscaping', label: 'Hardscaping', terms: ['hardscaping', 'hardscape', 'patio', 'paver', 'stone', 'retaining wall'] },
  { key: 'landscaping', label: 'Landscaping', terms: ['landscaping', 'landscape', 'mulch', 'planting', 'garden'] },
  { key: 'outdoor-lighting', label: 'Outdoor Lighting', terms: ['outdoor lighting', 'lighting', 'lights'] },
  { key: 'seasonal-services', label: 'Seasonal Services', terms: ['seasonal', 'cleanup', 'clean up', 'fall', 'spring', 'snow'] },
  { key: 'other', label: 'Other', terms: [] }
];

const publicCalTitle = document.getElementById('public-cal-title');
const publicCalDays = document.getElementById('public-cal-days');
const publicCalPrev = document.getElementById('public-cal-prev');
const publicCalNext = document.getElementById('public-cal-next');
const publicCalPanel = document.getElementById('public-cal-panel');

const publicToday = new Date();
publicToday.setHours(0, 0, 0, 0);
let publicViewYear = publicToday.getFullYear();
let publicViewMonth = publicToday.getMonth();
let selectedPublicDateKey = publicDateKey(publicToday);
let googleCalendarJobs = [];
let googleCalendarLoaded = false;

function publicDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function escapePublicHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function publicLabelToDateKey(label, year) {
  const match = String(label || '').match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
  if (!match) return '';
  const monthIndex = [...PUBLIC_MONTHS_SHORT, ...PUBLIC_MONTHS].findIndex(name => name.toLowerCase() === match[1].toLowerCase());
  const month = monthIndex > 11 ? monthIndex - 12 : monthIndex;
  if (month < 0) return '';
  return publicDateKey(new Date(year, month, Number(match[2])));
}

function getGoogleCalendarKey() {
  const host = window.location.hostname;
  return ['localhost', '127.0.0.1', ''].includes(host) ? GOOGLE_CALENDAR_DEV_KEY : GOOGLE_CALENDAR_LIVE_KEY;
}

function toLocalDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return publicDateKey(date);
}

function toTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function googleEventToJob(event) {
  const startValue = event.start?.dateTime || event.start?.date || '';
  const endValue = event.end?.dateTime || event.end?.date || '';
  const key = toLocalDateKey(startValue);
  if (!key) return null;
  const jobType = getJobType(event.summary, event.description);
  return {
    key,
    service: jobType.label,
    title: event.summary || jobType.label,
    description: event.description || '',
    timeStart: event.start?.dateTime ? toTimeValue(startValue) : '',
    timeEnd: event.end?.dateTime ? toTimeValue(endValue) : '',
    typeKey: jobType.key,
    source: 'google'
  };
}

function getJobType(title, description = '') {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  return JOB_TYPES.find(type => type.terms.some(term => text.includes(term))) || JOB_TYPES[JOB_TYPES.length - 1];
}

async function loadGoogleCalendarJobs() {
  const timeMin = new Date(publicViewYear, publicViewMonth - 1, 1).toISOString();
  const timeMax = new Date(publicViewYear, publicViewMonth + 2, 0, 23, 59, 59).toISOString();
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`);
  url.search = new URLSearchParams({
    key: getGoogleCalendarKey(),
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    showDeleted: 'false'
  }).toString();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Calendar returned ${response.status}`);
    const data = await response.json();
    googleCalendarJobs = (data.items || []).map(googleEventToJob).filter(Boolean);
    googleCalendarLoaded = true;
  } catch (err) {
    console.warn('Could not load Google Calendar events:', err);
    googleCalendarJobs = [];
    googleCalendarLoaded = true;
  }
}

function getPublicJobs() {
  if (googleCalendarLoaded) return googleCalendarJobs;
  const publicJobs = JSON.parse(localStorage.getItem('pl_public_jobs') || '[]');
  return publicJobs.flatMap(job => {
    const dateValues = Array.isArray(job.jobDateValues) ? job.jobDateValues : [];
    const dateLabels = Array.isArray(job.jobDates) ? job.jobDates : [];
    const keys = dateValues.length
      ? dateValues
      : dateLabels.map(label => publicLabelToDateKey(label, publicViewYear)).filter(Boolean);
    return keys.map((key, index) => ({
      key,
      service: job.service || 'Scheduled Work',
      title: job.title || job.service || 'Scheduled Work',
      description: job.description || '',
      timeStart: job.timeStart || '',
      timeEnd: job.timeEnd || '',
      typeKey: getJobType(job.service, job.description).key,
      label: dateLabels[index] || key
    }));
  });
}

function formatPublicTime(start, end) {
  const format = value => {
    if (!value) return '';
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours)) return value;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour = hours % 12 || 12;
    return `${hour}:${String(minutes || 0).padStart(2, '0')} ${suffix}`;
  };
  const startText = format(start);
  const endText = format(end);
  if (startText && endText) return `${startText} - ${endText}`;
  return startText || endText || 'Time TBD';
}

function googleCalendarUrl(job) {
  const title = `Prestige Landscaping - ${job.service}`;
  const details = job.description || '';
  const start = job.timeStart ? job.timeStart.replace(':', '') : '0800';
  const end = job.timeEnd ? job.timeEnd.replace(':', '') : '1700';
  const cleanStart = `${job.key.replace(/-/g, '')}T${start.padEnd(4, '0')}00`;
  const cleanEnd = `${job.key.replace(/-/g, '')}T${end.padEnd(4, '0')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${cleanStart}/${cleanEnd}`,
    details
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function minutesFromTime(value, fallbackHour) {
  if (!value) return fallbackHour * 60;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours)) return fallbackHour * 60;
  return hours * 60 + (Number.isNaN(minutes) ? 0 : minutes);
}

function timelineBlockStyle(job) {
  const start = Math.max(minutesFromTime(job.timeStart, TIMELINE_START_HOUR), TIMELINE_START_HOUR * 60);
  const end = Math.min(minutesFromTime(job.timeEnd, TIMELINE_START_HOUR + 1), TIMELINE_END_HOUR * 60);
  const duration = Math.max(end - start, 45);
  const top = ((start - TIMELINE_START_HOUR * 60) / 60) * TIMELINE_ROW_HEIGHT;
  const height = (duration / 60) * TIMELINE_ROW_HEIGHT;
  const left = `calc(${job.weekDay * (100 / 7)}% + .45rem)`;
  const width = `calc(${100 / 7}% - .9rem)`;
  return `left:${left};width:${width};top:${top}px;height:${height}px;`;
}

function currentTimeLine(date) {
  const now = new Date();
  const weekKeys = getWeekDates(date).map(publicDateKey);
  const todayIndex = weekKeys.indexOf(publicDateKey(publicToday));
  if (todayIndex < 0) return '';
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = TIMELINE_START_HOUR * 60;
  const end = TIMELINE_END_HOUR * 60;
  if (minutes < start || minutes > end) return '';
  const top = ((minutes - start) / 60) * TIMELINE_ROW_HEIGHT;
  const left = `calc(${todayIndex * (100 / 7)}% + .25rem)`;
  const width = `calc(${100 / 7}% - .5rem)`;
  return `<div class="public-current-time" style="left:${left};width:${width};top:${top}px;"></div>`;
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

function renderTimeline(date, jobs) {
  const weekDates = getWeekDates(date);
  const weekKeys = weekDates.map(publicDateKey);
  const weekJobs = jobs
    .filter(job => weekKeys.includes(job.key))
    .map(job => ({ ...job, weekDay: weekKeys.indexOf(job.key) }));
  const hours = [];
  for (let hour = TIMELINE_START_HOUR; hour <= TIMELINE_END_HOUR; hour++) {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const display = hour % 12 || 12;
    hours.push(`<div class="public-timeline-hour"><span>${display} ${suffix}</span></div>`);
  }
  const weekLabel = `${PUBLIC_MONTHS_SHORT[weekDates[0].getMonth()]} ${weekDates[0].getDate()} - ${PUBLIC_MONTHS_SHORT[weekDates[6].getMonth()]} ${weekDates[6].getDate()}`;

  return `
    <div class="public-timeline" style="--timeline-height:${(TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1) * TIMELINE_ROW_HEIGHT}px;">
      <div class="public-week-header" style="grid-column:2;">
        ${weekDates.map(day => `
          <div class="${publicDateKey(day) === selectedPublicDateKey ? 'public-week-day active' : 'public-week-day'}">
            <span>${PUBLIC_DAYS_SHORT[day.getDay()]}</span>
            <strong>${PUBLIC_MONTHS_SHORT[day.getMonth()]} ${day.getDate()}</strong>
          </div>
        `).join('')}
      </div>
      <div class="public-timeline-hours">
        ${hours.join('')}
      </div>
      <div class="public-timeline-events">
        ${currentTimeLine(date)}
        ${weekJobs.map(job => `
          <article class="public-timeline-event public-job-${escapePublicHtml(job.typeKey || 'other')}" style="${timelineBlockStyle(job)}">
            <div class="public-job-meta">${escapePublicHtml(formatPublicTime(job.timeStart, job.timeEnd))}</div>
            <strong>${escapePublicHtml(job.title || job.service || 'Scheduled Work')}</strong>
            ${job.description ? `<p>${escapePublicHtml(job.description)}</p>` : ''}
          </article>
        `).join('')}
      </div>
    </div>
    <p class="public-week-note">${escapePublicHtml(weekLabel)}${weekJobs.length ? ` - ${weekJobs.length} scheduled job${weekJobs.length > 1 ? 's' : ''}` : ' - no scheduled jobs posted'}</p>
  `;
}

function renderPublicPanel(date) {
  if (!publicCalPanel) return;
  const weekDates = getWeekDates(date);
  const label = `${PUBLIC_MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} - ${PUBLIC_MONTHS[weekDates[6].getMonth()]} ${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`;
  publicCalPanel.innerHTML = `
    <h3>${label}</h3>
    <p>Weekly timeline</p>
    ${renderTimeline(date, getPublicJobs())}
  `;
}

function renderPublicCalendar() {
  if (!publicCalTitle || !publicCalDays) return;
  publicCalTitle.textContent = `${PUBLIC_MONTHS[publicViewMonth]} ${publicViewYear}`;
  publicCalDays.innerHTML = '';
  const jobs = getPublicJobs();
  const jobsByDate = jobs.reduce((map, job) => {
    if (!map.has(job.key)) map.set(job.key, []);
    map.get(job.key).push(job);
    return map;
  }, new Map());
  const firstDay = new Date(publicViewYear, publicViewMonth, 1).getDay();
  const daysInMonth = new Date(publicViewYear, publicViewMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day cal-day-empty';
    empty.setAttribute('aria-hidden', 'true');
    publicCalDays.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(publicViewYear, publicViewMonth, d);
    const key = publicDateKey(date);
    const dayJobs = jobsByDate.get(key) || [];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = d;
    btn.setAttribute('aria-label', `${PUBLIC_MONTHS[publicViewMonth]} ${d}`);
    if (date.getTime() === publicToday.getTime()) btn.classList.add('cal-day-today');
    if (dayJobs.length > 0) btn.classList.add('cal-day-has-job');
    if (key === selectedPublicDateKey) btn.classList.add('cal-day-selected');
    btn.addEventListener('click', () => {
      selectedPublicDateKey = key;
      renderPublicCalendar();
      renderPublicPanel(date);
    });
    publicCalDays.appendChild(btn);
  }
}

if (publicCalPrev) publicCalPrev.addEventListener('click', () => {
  publicViewMonth--;
  if (publicViewMonth < 0) { publicViewMonth = 11; publicViewYear--; }
  renderPublicCalendar();
  loadGoogleCalendarJobs().then(() => {
    renderPublicCalendar();
    renderPublicPanel(new Date(`${selectedPublicDateKey}T00:00:00`));
  });
});
if (publicCalNext) publicCalNext.addEventListener('click', () => {
  publicViewMonth++;
  if (publicViewMonth > 11) { publicViewMonth = 0; publicViewYear++; }
  renderPublicCalendar();
  loadGoogleCalendarJobs().then(() => {
    renderPublicCalendar();
    renderPublicPanel(new Date(`${selectedPublicDateKey}T00:00:00`));
  });
});

renderPublicCalendar();
renderPublicPanel(publicToday);
loadGoogleCalendarJobs().then(() => {
  renderPublicCalendar();
  renderPublicPanel(publicToday);
});
if (window.PrestigeFirebase) {
  window.PrestigeFirebase.ready.then(() => {
    renderPublicCalendar();
    renderPublicPanel(new Date(`${selectedPublicDateKey}T00:00:00`));
  }).catch(() => {});
}
