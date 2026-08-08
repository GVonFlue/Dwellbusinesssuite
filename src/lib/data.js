/* ============================================================================
   data.js — the ONE seam.

   The app imports { auth, db } from here and never from supabase.js or demo.js
   directly. VITE_DEMO=1 swaps the implementation; nothing above this line knows
   which one it got. That is what makes the demo the real product rather than a
   parallel build that drifts.

   Static imports on purpose: Vite tree-shakes the unused branch out of the
   bundle at build time, so a demo build ships no Supabase calls and a real
   build ships no seed data.
   ========================================================================== */

import { DEMO } from './brand';
import * as real from './supabase';
import * as demo from './demo';

const impl = DEMO ? demo : real;

export const auth = impl.auth;
export const db = impl.db;
export const configured = impl.configured;
export const isDemo = !!DEMO;
export const demoApi = DEMO ? demo.demoApi : null;
