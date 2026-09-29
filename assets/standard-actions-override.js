/**
 * Standard Actions configuration for the Bonsai theme.
 *
 * Storefront Renderer injects the Shopify Standard Actions bundle
 * (`window.Shopify.actions.{updateCart,openCart,getCart,…}`), which apps use
 * to open and change the cart. These handlers route it to the Bonsai cart
 * drawer and cart page (assets/bonsai-cart.js).
 *
 *   - openCart   — opens the cart drawer; falls back to /cart where there is
 *     no drawer (the cart page itself).
 *   - updateCart — after the default mutation, re-renders the drawer and the
 *     cart page so they show the new cart.
 *   - other actions (getCart, etc.) keep the default implementation.
 */

function initStandardActions() {
  const actions = window.Shopify?.actions;
  if (!actions) return;

  actions.openCart.configure({
    async handler(defaultHandler) {
      if (document.querySelector('[data-bh-drawer]')) {
        document.dispatchEvent(new CustomEvent('bh:cart:open'));
        return;
      }
      return defaultHandler();
    },
  });

  actions.updateCart.configure({
    eventTarget: () => document,
    async handler(defaultHandler) {
      const result = await defaultHandler();
      document.dispatchEvent(new CustomEvent('bh:cart:refresh'));
      return result;
    },
  });
}

// Run immediately if the standard-actions bundle has already attached
// `Shopify.actions`; otherwise wait for DOMContentLoaded, which fires after
// all module scripts have executed regardless of document order.
if (window.Shopify?.actions) {
  initStandardActions();
} else {
  document.addEventListener('DOMContentLoaded', initStandardActions, { once: true });
}
