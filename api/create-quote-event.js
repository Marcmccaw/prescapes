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

async function saveCalendarEvent({ token, calendarId, eventId, event }) {
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
    throw new Error(data.error?.message || 'Could not create calendar event.');
  }
  return data;
}

async function deleteCalendarEvent({ token, calendarId, eventId }) {
  if (!eventId) return;
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Could not delete old calendar event.');
  }
}

function buildCalendarEvent({ leadId, service, description, date, startTime, endTime, eventType }) {
  const start = new Date(`${date}T${startTime}:00`);
  const end = endTime
    ? new Date(`${date}T${endTime}:00`)
    : addMinutes(start, 45);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error('Invalid event date or time.');
  }

  const typeLabel = eventType === 'booked' ? 'Booked Job' : 'Quote';
  return {
    summary: `${typeLabel} - ${service}`,
    description: description || `${typeLabel} for Prestige Landscaping. Client details are stored in the Client Panel.`,
    start: {
      dateTime: `${date}T${startTime}:00`,
      timeZone: DEFAULT_TIME_ZONE
    },
    end: {
      dateTime: localDateTimeValue(end),
      timeZone: DEFAULT_TIME_ZONE
    },
    extendedProperties: {
      private: {
        prestigeLeadId: leadId,
        prestigeEventType: eventType
      }
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const leadId = cleanText(body.leadId, '');
    const service = cleanText(body.service, 'Quote');
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'contact.presscapes@gmail.com';

    if (!leadId) return json(res, 400, { error: 'A lead id is required.' });
    const token = await getAccessToken();

    const deleteEventIds = Array.isArray(body.deleteEventIds) ? body.deleteEventIds.filter(Boolean) : [];
    for (const eventId of deleteEventIds) {
      await deleteCalendarEvent({ token, calendarId, eventId });
    }

    const items = Array.isArray(body.events) && body.events.length
      ? body.events
      : [{
        date: body.visitDate,
        startTime: body.visitTime,
        endTime: '',
        eventId: body.eventId,
        eventType: 'quote',
        description: 'Quote appointment for Prestige Landscaping. Client details are stored in the Client Panel.'
      }];

    if (!items.length) {
      return json(res, 400, { error: 'At least one calendar event is required.' });
    }

    const savedEvents = [];
    for (const item of items) {
      const date = cleanText(item.date, '');
      const startTime = cleanText(item.startTime, '');
      const endTime = cleanText(item.endTime, '');
      const eventType = cleanText(item.eventType, 'quote');
      const event = buildCalendarEvent({
        leadId,
        service: cleanText(item.service, service),
        description: cleanText(item.description, ''),
        date,
        startTime,
        endTime,
        eventType
      });
      const data = await saveCalendarEvent({
        token,
        calendarId,
        eventId: cleanText(item.eventId, ''),
        event
      });
      savedEvents.push({
        date,
        id: data.id,
        htmlLink: data.htmlLink,
        start: data.start,
        end: data.end
      });
    }

    return json(res, 200, { events: savedEvents, ...savedEvents[0] });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Could not create calendar event.' });
  }
};
