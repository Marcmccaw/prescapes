/* ============================================
   Creates a RECURRING Google Calendar event for a new mowing
   subscription (weekly or biweekly), using the same Google
   service account already configured for create-quote-event.js.

   Because admin-calendar.js and public-calendar.js both read
   directly from this same Google Calendar, any event created
   here automatically shows up on both the admin calendar and
   the customer-facing calendar — no extra syncing needed.
   ============================================ */
const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const DEFAULT_TIME_ZONE = 'America/New_York';
const DEFAULT_VISIT_START = '09:00';
const DEFAULT_VISIT_DURATION_MINUTES = 60;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getPrivateKey() {
  return String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiresAt - 60 > now) return cachedToken;

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google Calendar service account environment variables.');
  }

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Could not authorize Google Calendar.');
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + Number(data.expires_in || 3600);
  return cachedToken;
}

function cleanText(value, fallback) {
  return String(value || '').trim() || fallback;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function localDateTimeValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-') + 'T' + [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    '00'
  ].join(':');
}

async function createCalendarEvent({ token, calendarId, event }) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Could not create the recurring calendar event.');
  }
  return data;
}

function buildRecurrenceRule(frequency) {
  // frequency is either "weekly" or "biweekly"
  return frequency === 'biweekly'
    ? ['RRULE:FREQ=WEEKLY;INTERVAL=2']
    : ['RRULE:FREQ=WEEKLY;INTERVAL=1'];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const subscriptionId = cleanText(body.subscriptionId, '');
    const frequency = body.frequency === 'biweekly' ? 'biweekly' : 'weekly';
    const size = cleanText(body.size, '');
    const price = cleanText(body.price, '');
    const customerName = cleanText(body.customerName, 'New Subscriber');
    const address = cleanText(body.address, '');
    const startDate = cleanText(body.startDate, '');
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'contact.presscapes@gmail.com';

    if (!subscriptionId) return json(res, 400, { error: 'A subscription id is required.' });
    if (!startDate) return json(res, 400, { error: 'A first visit date is required.' });

    const start = new Date(`${startDate}T${DEFAULT_VISIT_START}:00`);
    if (Number.isNaN(start.getTime())) {
      return json(res, 400, { error: 'Invalid first visit date.' });
    }
    const end = addMinutes(start, DEFAULT_VISIT_DURATION_MINUTES);

    const frequencyLabel = frequency === 'biweekly' ? 'Biweekly' : 'Weekly';
    const summary = `${frequencyLabel} Mowing${size ? ' - ' + size : ''} - ${customerName}`;
    const descriptionLines = [
      `Recurring ${frequency} mowing subscription for ${customerName}.`,
      address ? `Address: ${address}` : null,
      price ? `Billed: $${price}/month via PayPal` : null,
      `PayPal Subscription ID: ${subscriptionId}`,
      'To cancel: remove this recurring event and cancel the subscription in PayPal.'
    ].filter(Boolean);

    const token = await getAccessToken();

    const event = {
      summary,
      description: descriptionLines.join('\n'),
      start: {
        dateTime: `${startDate}T${DEFAULT_VISIT_START}:00`,
        timeZone: DEFAULT_TIME_ZONE
      },
      end: {
        dateTime: localDateTimeValue(end),
        timeZone: DEFAULT_TIME_ZONE
      },
      recurrence: buildRecurrenceRule(frequency),
      extendedProperties: {
        private: {
          prestigeEventType: 'subscription',
          prestigeSubscriptionId: subscriptionId,
          prestigeFrequency: frequency
        }
      }
    };

    const data = await createCalendarEvent({ token, calendarId, event });

    return json(res, 200, {
      id: data.id,
      htmlLink: data.htmlLink,
      start: data.start,
      end: data.end,
      recurrence: data.recurrence
    });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Could not create the recurring calendar event.' });
  }
};
