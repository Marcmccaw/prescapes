/* ============================================
   PAYPAL SUBSCRIPTION CONFIG
   ============================================
   Edit this file to activate/update the mowing subscription
   buttons on services.html. Each property size + frequency
   combination is its own PayPal Plan.

   HOW TO ADD/UPDATE A PLAN
   -------------------------
   1. Log into paypal.com (real account, Live mode) →
      Pay & Get Paid → Subscriptions → Create Plan.
   2. Use the "Lawn Mowing" product you already created.
   3. Create a plan for each size + frequency combo, e.g.
      "Weekly Mowing – 1/2 Acre", billing cycle weekly,
      with that tier's price.
   4. PayPal gives you a Plan ID like "P-3F115243GK999991FNJ5FWEQ".
   5. Paste the Plan ID AND the price below in the matching spot.

   Both the id and the price must be filled in for a tier to
   work — the price shown on the site comes from here, not
   automatically from PayPal.
   ============================================ */

const PAYPAL_CLIENT_ID = "BAAlb7_rIZWawLsnZ4Nu1r7KMXc46_n67a_NkW8zmeMoOE0_N957vHLhzyGvoLNGVxXrbNStRHIqVyw13k";

const PAYPAL_PLANS = {
  weekly: {
    label: "Weekly Mowing",
    tiers: [
      { size: "1/4 Acre", id: "P-3F115243GK999991FNJ5FWEQ", price: 50 },
      { size: "1/2 Acre", id: "P-5YU16811RA9173935NJ5FZCY", price: 65 },
      { size: "1 Acre",   id: "P-76622933XA348094MNJ5FZRA", price: 85 }
    ]
  },
  biweekly: {
    label: "Biweekly Mowing",
    tiers: [
      { size: "1/4 Acre", id: "P-6J677994DT598901RNJ5F3NQ", price: 60 },
      { size: "1/2 Acre", id: "P-28685506HH0940037NJ5F4PA", price: 75 },
      { size: "1 Acre",   id: "P-8DM103676M649873BNJ5F5MQ", price: 90 }
    ]
  }
};
