/* ============================================
   Looks up a Stripe customer by the email they used at
   checkout, then creates a Billing Portal session so they can
   view/cancel their own subscription securely on Stripe's site.

   Requires the Customer Portal to be turned on once in the
   Stripe Dashboard: Settings -> Billing -> Customer portal ->
   Activate. Takes about 30 seconds, no code involved.
   ============================================ */

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function toFormBody(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) usp.append(k, String(v));
  });
  return usp.toString();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('Missing STRIPE_SECRET_KEY environment variable.');

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim();
    const siteUrl = String(body.siteUrl || 'https://presscapes.xyz').trim();

    if (!email) return json(res, 400, { error: 'Please enter the email you used to subscribe.' });

    const authHeader = { Authorization: `Bearer ${secretKey}` };

    // 1. Find the Stripe customer created for this email at checkout.
    const lookupUrl = `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`;
    const lookupRes = await fetch(lookupUrl, { headers: authHeader });
    const lookupData = await lookupRes.json();
    if (!lookupRes.ok) throw new Error(lookupData.error?.message || 'Could not look up that email.');

    const customer = lookupData.data && lookupData.data[0];
    if (!customer) {
      return json(res, 404, { error: 'We couldn\'t find a subscription under that email. Double check it\'s the same email you used at checkout.' });
    }

    // 2. Create a portal session for that customer.
    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody({
        customer: customer.id,
        return_url: `${siteUrl}/services.html`
      })
    });
    const portalData = await portalRes.json();
    if (!portalRes.ok) {
      throw new Error(portalData.error?.message || 'Could not open the subscription management page.');
    }

    return json(res, 200, { url: portalData.url });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Something went wrong.' });
  }
};
