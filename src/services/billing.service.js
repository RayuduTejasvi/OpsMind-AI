export function createMockCheckout({ userId, plan }) {
  return {
    checkoutUrl: `https://example.com/mock-checkout?user=${userId}&plan=${plan || 'pro'}`,
    mode: 'mock',
    message: 'Stripe is not configured. Using a mock checkout URL for local development.',
  };
}

export function createMockPortal({ userId }) {
  return {
    portalUrl: `https://example.com/mock-billing-portal?user=${userId}`,
    mode: 'mock',
    message: 'Stripe is not configured. Using a mock billing portal URL for local development.',
  };
}
