/* ============================================
   Stripe webhook handler.

   Stripe calls this URL automatically whenever a checkout
   completes. We verify the request really came from Stripe
   (using STRIPE_WEBHOOK_SECRET), then — on a successful
   subscription checkout — create the same kind of recurring
   Google Calendar event that create-subscription-event.js
   creates, using the same service account credentials.

   Setup required in the Stripe Dashboard:
   1. Go to Developers -> Webhooks -> Add endpoint.
   2. Endpoint URL: https://presscapes.xyz/api/stripe-webhook
   3. Event to send: checkout.session.completed
   4. Copy the "Signing secret" (starts with whsec_...) into
      the STRIPE_WEBHOOK_SECRET environment variable in Vercel.
   ============================================ */
const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const DEFAULT_TIME_ZONE = 'America/New_York';
const DEFAULT_VISIT_START = '09:00';
const DEFAULT_VISIT_DURATION_MINUTES = 60;

let cachedGoogleToken = null;
let cachedGoogleTokenExpiresAt = 0;

module.exports.config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(pair => pair.split('=').map(s => s.trim()))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getGooglePrivateKey() {
  return String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleTokenExpiresAt - 60 > now) return cachedGoogleToken;

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = getGooglePrivateKey();
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

  cachedGoogleToken = data.access_token;
  cachedGoogleTokenExpiresAt = now + Number(data.expires_in || 3600);
  return cachedGoogleToken;
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

function buildRecurrenceRule(frequency) {
  return frequency === 'biweekly'
    ? ['RRULE:FREQ=WEEKLY;INTERVAL=2']
    : ['RRULE:FREQ=WEEKLY;INTERVAL=1'];
}

async function createRecurringCalendarEvent(metadata, subscriptionId) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'contact.presscapes@gmail.com';
  const frequency = metadata.frequency === 'biweekly' ? 'biweekly' : 'weekly';
  const size = metadata.size || '';
  const price = metadata.price || '';
  const customerName = metadata.customerName || 'New Subscriber';
  const address = metadata.address || '';
  const startDate = metadata.startDate || '';

  if (!startDate) throw new Error('Missing startDate in subscription metadata.');

  const start = new Date(`${startDate}T${DEFAULT_VISIT_START}:00`);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid startDate in subscription metadata.');
  const end = addMinutes(start, DEFAULT_VISIT_DURATION_MINUTES);

  const frequencyLabel = frequency === 'biweekly' ? 'Biweekly' : 'Weekly';
  const summary = `${frequencyLabel} Mowing${size ? ' - ' + size : ''} - ${customerName}`;
  const descriptionLines = [
    `Recurring ${frequency} mowing subscription for ${customerName}.`,
    address ? `Address: ${address}` : null,
    price ? `Billed: $${price}/month via Stripe` : null,
    `Stripe Subscription ID: ${subscriptionId}`,
    'To cancel: remove this recurring event and cancel the subscription in the Stripe Dashboard.'
  ].filter(Boolean);

  const token = await getGoogleAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary,
      description: descriptionLines.join('\n'),
      start: { dateTime: `${startDate}T${DEFAULT_VISIT_START}:00`, timeZone: DEFAULT_TIME_ZONE },
      end: { dateTime: localDateTimeValue(end), timeZone: DEFAULT_TIME_ZONE },
      recurrence: buildRecurrenceRule(frequency),
      extendedProperties: {
        private: {
          prestigeEventType: 'subscription',
          prestigeSubscriptionId: subscriptionId,
          prestigeFrequency: frequency
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Could not create the recurring calendar event.');
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    return res.end('Method not allowed.');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable.');
    res.statusCode = 500;
    return res.end('Webhook not configured.');
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    res.statusCode = 400;
    return res.end('Could not read request body.');
  }

  const signatureHeader = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    res.statusCode = 400;
    return res.end('Invalid Stripe signature.');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    res.statusCode = 400;
    return res.end('Invalid JSON payload.');
  }

  // Acknowledge immediately for event types we don't act on.
  if (event.type !== 'checkout.session.completed') {
    res.statusCode = 200;
    return res.end('ok');
  }

  const session = event.data?.object || {};
  if (session.mode !== 'subscription') {
    res.statusCode = 200;
    return res.end('ok');
  }

  try {
    await createRecurringCalendarEvent(session.metadata || {}, session.subscription);
    res.statusCode = 200;
    return res.end('ok');
  } catch (err) {
    // Respond 200 anyway so Stripe doesn't retry indefinitely for a
    // problem that a retry won't fix (e.g. bad metadata). The error
    // is logged for us to see in Vercel's function logs.
    console.error('Calendar sync failed for Stripe subscription:', session.subscription, err.message);
    res.statusCode = 200;
    return res.end('ok, but calendar sync failed - see logs');
  }
};
