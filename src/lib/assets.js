/* ============================================================================
   assets.js — hard-coded brand artwork for THIS install (Dwell Real Estate
   Group).

   Everything here lives in /public/brand and is served from the site root, so
   these are plain URLs, not imports. That keeps them out of the JS bundle and
   lets the browser cache them like any other image.

   This file is deliberately separate from brand.js. brand.js is the ENV-driven
   tenant config that the template shares across every client; this file is the
   one place a per-client image path is pinned by hand. Swapping a client means
   dropping four files into /public/brand and editing four strings here.
   ========================================================================== */

export const ASSETS = {
  /* the client's own mark. White artwork — it must sit on a dark band. */
  clientLogo:     '/brand/dwell-logo.png',
  clientLogoAlt:  'dwellWICHITA',

  /* the sidebar backdrop. Sits UNDER a dark scrim (see .sb::before in
     styles.js) so nav text keeps its contrast — do not remove the scrim. */
  sidebarBg:      '/brand/sidebar-bg.jpg',

  /* ours, at the top of every screen. The artwork's own background is #000110,
     which is why .suite-logo paints a #000110 chip behind it — they match
     exactly, so the image reads as a wordmark and not as a pasted rectangle. */
  productLogo:    '/brand/proytech-logo.png',
  productLogoAlt: 'ProyTech',
};

export default ASSETS;
