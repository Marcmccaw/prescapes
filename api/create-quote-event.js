const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const DEFAULT_TIME_ZONE = 'America/New_York';

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const leadId = cleanText(body.leadId, '');
    const visitDate = cleanText(body.visitDate, '');
    const visitTime = cleanText(body.visitTime, '');
    const service = cleanText(body.service, 'Quote');
    const eventId = cleanText(body.eventId, '');
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'contact.presscapes@gmail.com';

    if (!leadId || !visitDate || !visitTime) {
      return json(res, 400, { error: 'A lead id, quote date, and quote time are required.' });
    }

    const start = new Date(`${visitDate}T${visitTime}:00`);
    if (Number.isNaN(start.getTime())) {
      return json(res, 400, { error: 'Invalid quote date or time.' });
    }

    const end = addMinutes(start, 45);
    const token = await getAccessToken();
    const event = {
      summary: `Quote - ${service}`,
      description: 'Quote appointment for Prestige Landscaping. Client details are stored in the Client Panel.',
      start: {
        dateTime: `${visitDate}T${visitTime}:00`,
        timeZone: DEFAULT_TIME_ZONE
      },
      end: {
        dateTime: localDateTimeValue(end),
        timeZone: DEFAULT_TIME_ZONE
      },
      extendedProperties: {
        private: {
          prestigeLeadId: leadId,
          prestigeEventType: 'quote'
        }
      }
    };

    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const url = eventId ? `${baseUrl}/${encodeURIComponent(eventId)}` : baseUrl;
    const response = await fetch(url, {
      method: eventId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    const data = await response.json();
    if (!response.ok) {
      return json(res, response.status, { error: data.error?.message || 'Could not create calendar event.' });
    }

    return json(res, 200, {
      id: data.id,
      htmlLink: data.htmlLink,
      start: data.start,
      end: data.end
    });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Could not create quote event.' });
  }
};
