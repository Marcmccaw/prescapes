/* ============================================
   Creates a Stripe Checkout Session for a recurring mowing
   subscription and returns the hosted checkout URL.

   Uses Stripe's REST API directly via fetch (no stripe npm
   package needed), matching the style of the other /api
   functions in this project. Only needs STRIPE_SECRET_KEY set
   as an environment variable in Vercel.
   ============================================ */

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function cleanText(value, fallback) {
  return String(value || '').trim() || fallback;
}

// Stripe's API expects application/x-www-form-urlencoded with
// bracket notation for nested fields, e.g. line_items[0][price_data][unit_amount]
function toFormBody(params) {
  const usp = new URLSearchParams();
  function add(key, value) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => add(`${key}[${i}]`, item));
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => add(`${key}[${k}]`, v));
    } else {
      usp.append(key, String(value));
    }
  }
  Object.entries(params).forEach(([k, v]) => add(k, v));
  return usp.toString();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const frequency = body.frequency === 'biweekly' ? 'biweekly' : 'weekly';
    const size = cleanText(body.size, '');
    const price = Number(body.price);
    const customerName = cleanText(body.customerName, '');
    const address = cleanText(body.address, '');
    const startDate = cleanText(body.startDate, '');
    const siteUrl = cleanText(body.siteUrl, 'https://presscapes.xyz');

    if (!price || price <= 0) return json(res, 400, { error: 'A valid price is required.' });
    if (!customerName || !address || !startDate) {
      return json(res, 400, { error: 'Name, address, and first visit date are required.' });
    }

    const frequencyLabel = frequency === 'biweekly' ? 'Biweekly' : 'Weekly';
    const productName = `${frequencyLabel} Mowing${size ? ' - ' + size : ''}`;

    const params = {
      mode: 'subscription',
      success_url: `${siteUrl}/services.html?subscribed=1`,
      cancel_url: `${siteUrl}/services.html?canceled=1`,
      customer_email: undefined, // Stripe Checkout will ask for email itself
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(price * 100),
            recurring: { interval: 'month' },
            product_data: {
              name: productName,
              description: `Recurring ${frequency} mowing service, billed monthly.`
            }
          }
        }
      ],
      metadata: {
        frequency,
        size,
        price: String(price),
        customerName,
        address,
        startDate
      },
      subscription_data: {
        metadata: {
          frequency,
          size,
          price: String(price),
          customerName,
          address,
          startDate
        }
      }
    };

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: toFormBody(params)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Could not create the checkout session.');
    }

    return json(res, 200, { url: data.url });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Could not create the checkout session.' });
  }
};
