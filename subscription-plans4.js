/* ============================================
   SUBSCRIPTION PRICING CONFIG
   ============================================
   This is the only file you need to edit to update mowing
   subscription prices on the website.

   Unlike the old PayPal setup, Stripe does NOT need you to
   pre-create "Plan IDs" anywhere — just update the price
   number below and it takes effect immediately. Nothing else
   needs to change in Stripe's dashboard for a price update.

   Set a tier's price to null if that size isn't offered yet —
   it'll show "Contact us for a quote" instead of a broken button.
   ============================================ */

const SUBSCRIPTION_PLANS = {
  weekly: {
    label: "Weekly Mowing",
    tiers: [
      { size: "1/4 Acre", price: 200 },
      { size: "1/2 Acre", price: 260 },
      { size: "1 Acre",   price: 340 }
    ]
  },
  biweekly: {
    label: "Biweekly Mowing",
    tiers: [
      { size: "1/4 Acre", price: 0.50 },
      { size: "1/2 Acre", price: 150 },
      { size: "1 Acre",   price: 180 }
    ]
  }
};
