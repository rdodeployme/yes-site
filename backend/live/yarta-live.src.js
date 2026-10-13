/* Yarta live data layer.
   Turns the prototype portal and operations tool into a real, multi-user system on Firebase
   (Firestore + Cloud Storage + email-link sign-in) without rewriting the app.

   portal.js keeps rendering exactly as before. This module:
     - signs people in (invite-only, emailed link, no passwords),
     - loads what the signed-in person is allowed to see into the prototype's state shape,
     - writes changes back as narrow, rule-checked documents (see backend/firestore.rules),
     - publishes a customer's view only when Yarta issues a report,
     - stores files in Cloud Storage instead of this browser.

   When window.YARTA_FIREBASE is null the module does nothing and the prototype runs as before.
   Build: cd backend && npm run build:live  (bundles to src/assets/yarta/yarta-live.js). */

import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink, signOut as fbSignOut,
} from 'firebase/auth';
import {
  initializeFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, query, orderBy, limit as qLimit, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore/lite';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBlob, deleteObject } from 'firebase/storage';

const CFG = window.YARTA_FIREBASE || null;
const PAGE = window.YARTA_PAGE || 'portal';          // 'tool' (Yarta team) or 'portal' (customers)
const EMAIL_KEY = 'yarta-signin-email';
const VIEW_KEY = 'yarta-live-vieworg';
const TARGET_KEYS = ['target_emissions', 'target_renewable', 'target_diversion', 'target_fleet_ev', 'target_trees', 'target_rehab_ha', 'target_native_ha', 'target_participants'];
const BOOKING_KEYS = ['id', 'org', 'svc', 'status', 'slot', 'other', 'mode', 'location', 'contact', 'email', 'notes', 'share', 'why', 'month', 'group', 'createdAt', 'createdBy'];
const DELETABLE = /^(providers\/|orgs\/[^/]+\/declarations\/)/;
const CREATE_ONLY = /^(audit\/|gaplog\/|views\/[^/]+\/reports\/|orgs\/[^/]+\/inbox\/)/;
const SETTINGS = /^orgs\/[^/]+\/settings\/(targets|plan)$/;
const INVITE_DAYS = 14;

const L = {
  enabled: !!CFG,
  ready: false,
  page: PAGE,
  uid: null,
  user: null,          // the signed-in person's users/{uid} document
  login: { step: 'form', email: '', msg: '' },
};
window.YARTA_LIVE = L;
if (!CFG) { /* prototype mode */ }
else boot();

let app, auth, db, storage, api = null;
let base = {};            // path -> stable JSON last known to be on the server
let rejected = {};        // path -> stable JSON the server refused (not retried until it changes)
let published = {};       // orgId/ym -> { rev, issuedAt, hash } of what customers can currently see
let reportIds = new Set();
let leads = [];
let team = { users: [], invites: [] };
let clientOrg = null;
let syncing = false, again = false, timer = null, pendingWrites = 0;
let lastLoad = 0;

/* ------------------------------------------------------------------ helpers */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isoNow = () => new Date().toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
function stable(v) {
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (v instanceof Timestamp) return JSON.stringify(v.toDate().toISOString());
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : stable(x))).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
function fromFs(v) {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(fromFs);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = fromFs(v[k]); return o; }
  return v;
}
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const rid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 140);
function flash(m, t) { if (api) api.flash(m, t); }
function rerender() { if (api) api.render(); }
function me() { return L.user || {}; }
function myName() { return me().name || (auth && auth.currentUser && auth.currentUser.email) || 'Yarta'; }
const isStaffRole = (r) => r === 'owner' || r === 'staff';
function portalUrl() { return location.origin + location.pathname.replace(/\/tool\/?$/, '/portal/'); }
function toolUrl() { return location.origin + location.pathname.replace(/\/portal\/?$/, '/tool/'); }
function mimeOf(file) {
  const t = file.type || '';
  if (t) return t;
  const ext = (file.name || '').toLowerCase().split('.').pop();
  return { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
    csv: 'text/csv', txt: 'text/plain', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[ext] || 'application/octet-stream';
}
/* file keys used by the prototype → storage paths */
function keyToPath(key) {
  const k = String(key || '');
  let m = k.match(/^inbox\/([^/]+)\/(\d{4}-\d{2})\/(.+)$/);
  if (m) return 'orgs/' + m[1] + '/inbox/' + m[2] + '/' + safeId(m[3]);
  m = k.match(/^([^/]+)\/(\d{4}-\d{2})\/([^/]+)$/);
  if (m) return 'orgs/' + m[1] + '/evidence/' + m[2] + '/' + safeId(m[3]);
  return null;
}

/* ------------------------------------------------------------------ boot and sign-in */
function boot() {
  app = initializeApp(CFG);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  storage = getStorage(app);
  const em = CFG.emulators;
  if (em) {
    connectAuthEmulator(auth, em.auth, { disableWarnings: true });
    const [fh, fp] = em.firestore.split(':'); connectFirestoreEmulator(db, fh, +fp);
    const [sh, sp] = em.storage.split(':'); connectStorageEmulator(storage, sh, +sp);
  }
  prelabel();
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('beforeunload', (e) => { if (pendingWrites > 0 || timer) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('focus', () => { if (L.ready && L.uid && L.user && isStaffRole(L.user.role) && !timer && !syncing && pendingWrites === 0 && Date.now() - lastLoad > 120000) reload(); });

  if (isSignInWithEmailLink(auth, location.href)) {
    const saved = (() => { try { return localStorage.getItem(EMAIL_KEY); } catch (e) { return null; } })();
    if (saved) completeLink(saved);
    else { L.login = { step: 'confirm', email: '', msg: '' }; L.ready = true; }
  }
  onAuthStateChanged(auth, async (u) => {
    if (!u) { L.uid = null; L.user = null; if (L.login.step !== 'confirm' && L.login.step !== 'working') L.ready = true; rerender(); return; }
    L.uid = u.uid;
    try { await enter(u); } catch (e) { console.error(e); L.login = { step: 'error', email: u.email, msg: 'Yarta could not load your account. Check your connection and reload the page.' }; L.ready = true; rerender(); }
  });
}

async function completeLink(email) {
  L.login = { step: 'working', email, msg: '' }; rerender();
  try {
    await signInWithEmailLink(auth, email.trim().toLowerCase(), location.href);
    try { localStorage.removeItem(EMAIL_KEY); } catch (e) { /* ignore */ }
    history.replaceState(null, '', location.pathname + (location.hash && location.hash.length > 2 ? location.hash : ''));
  } catch (e) {
    console.error(e);
    L.login = { step: 'form', email, msg: e && e.code === 'auth/invalid-action-code'
      ? 'That sign-in link has expired or has already been used. Send yourself a new one.'
      : e && e.code === 'auth/invalid-email' ? 'That email does not match the one the link was sent to.' : 'That link did not work. Send yourself a new one.' };
    L.ready = true; history.replaceState(null, '', location.pathname); rerender();
  }
}

async function enter(u) {
  const email = (u.email || '').toLowerCase();
  let snap = await getDoc(doc(db, 'users', u.uid));
  if (!snap.exists()) {
    // first sign-in: accept the invite for this email, if there is one
    let inv = null;
    try { const is = await getDoc(doc(db, 'invites', email)); inv = is.exists() ? is.data() : null; } catch (e) { inv = null; }
    if (!inv) return deny(email, 'There is no Yarta invitation for ' + email + '. Ask your Yarta contact to invite this address.');
    if (inv.expiresAt && inv.expiresAt.toMillis() < Date.now()) return deny(email, 'Your invitation has expired. Ask your Yarta contact to send a new one.');
    await setDoc(doc(db, 'users', u.uid), { email, name: inv.name || email, title: inv.title || '', role: inv.role, orgId: inv.orgId || null, active: true, createdAt: serverTimestamp() });
    snap = await getDoc(doc(db, 'users', u.uid));
  }
  const user = { id: u.uid, ...fromFs(snap.data()) };
  if (!user.active) return deny(email, 'This Yarta account has been switched off. Ask your Yarta contact if you need access again.');
  L.user = user;
  if (PAGE === 'tool' && !isStaffRole(user.role)) { L.login = { step: 'wrongpage', email, msg: 'tool' }; L.ready = true; rerender(); return; }
  if (PAGE === 'portal' && isStaffRole(user.role)) { L.login = { step: 'wrongpage', email, msg: 'portal' }; L.ready = true; rerender(); return; }
  await reload();
  try { await updateDoc(doc(db, 'users', u.uid), { lastSeenAt: isoNow() }); } catch (e) { /* not important */ }
}
async function deny(email, msg) {
  L.login = { step: 'denied', email, msg }; L.user = null; L.ready = true;
  try { await fbSignOut(auth); } catch (e) { /* ignore */ }
  rerender();
}

async function reload() {
  L.ready = false; rerender();
  const st = isStaffRole(L.user.role) ? await loadStaff() : await loadClient();
  api.setState(st);
  lastLoad = Date.now();
  L.ready = true;
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = isStaffRole(L.user.role) ? '#/ops/home' : '#/dashboard';
  rerender();
  decorate();
}

function prelabel() {
  const tag = document.querySelector('.ytop .ydemo'); if (tag) tag.textContent = 'Secure sign-in';
  const lg = document.querySelector('.ytop .ylogo span'); if (lg) lg.innerHTML = '<b>Yarta</b>' + (PAGE === 'tool' ? 'Team · operations tool' : 'Client portal');
  document.querySelectorAll('.ytop a[href$="/demo/"]').forEach((a) => { a.style.display = 'none'; });
}
/* the page headers still say "Prototype"; say what is true instead */
function decorate() {
  const tag = document.querySelector('.ytop .ydemo');
  if (tag) tag.textContent = 'Signed in as ' + (me().name || '') + (isStaffRole(me().role) ? ' · Yarta team' : '');
  const lg = document.querySelector('.ytop .ylogo span');
  if (lg) lg.innerHTML = '<b>Yarta</b>' + (PAGE === 'tool' ? 'Team · operations tool' : 'Client portal');
}

/* ------------------------------------------------------------------ loading */
const all = async (path) => (await getDocs(collection(db, path))).docs.map((d) => ({ _id: d.id, ...fromFs(d.data()) }));
const one = async (path) => { const s = await getDoc(doc(db, path)); return s.exists() ? fromFs(s.data()) : null; };
const strip = (d) => { const o = { ...d }; delete o._id; return o; };

async function loadStaff() {
  base = {}; rejected = {}; published = {}; reportIds = new Set();
  const [orgDocs, users, invites, providers, outbox, gaplog, audit, opsCfg, leadDocs] = await Promise.all([
    all('orgs'), all('users'), all('invites'), all('providers'),
    getDocs(query(collection(db, 'outbox'), orderBy('at', 'desc'), qLimit(600))).then((s) => s.docs.map((d) => ({ _id: d.id, ...fromFs(d.data()) }))),
    all('gaplog'),
    getDocs(query(collection(db, 'audit'), orderBy('at', 'desc'), qLimit(400))).then((s) => s.docs.map((d) => ({ _id: d.id, ...fromFs(d.data()) }))),
    one('ops/config'),
    getDocs(query(collection(db, 'leads'), orderBy('created', 'desc'), qLimit(300))).then((s) => s.docs.map((d) => ({ _id: d.id, ...fromFs(d.data()) }))),
  ]);
  const st = { v: 4, orgs: {}, users: [], bookings: [], providers: [], gapLog: [], audit: [], outbox: [], importMaps: {}, guideNotes: [], ops2: true, opsSeeded: true, live: true };
  await Promise.all(orgDocs.map(async (od) => {
    const id = od._id;
    const [months, inbox, decls, bookings, settings, vmonths, reports, view] = await Promise.all([
      all('orgs/' + id + '/months'), all('orgs/' + id + '/inbox'), all('orgs/' + id + '/declarations'),
      all('orgs/' + id + '/bookings'), all('orgs/' + id + '/settings'), all('views/' + id + '/months'), all('views/' + id + '/reports'),
      one('views/' + id),
    ]);
    if (view) base['views/' + id] = stable(view);
    const o = { ...strip(od), id, records: [] };
    o.profile = o.profile || {};
    const tg = settings.find((s) => s._id === 'targets'); if (tg && tg.values) TARGET_KEYS.forEach((k) => { if (k in tg.values) o.profile[k] = tg.values[k]; });
    const pl = settings.find((s) => s._id === 'plan'); if (pl) o.plan = { ...(o.plan || {}), off: pl.off || {} };
    const byMonth = {};
    months.forEach((m) => { const r = strip(m); r.inbox = []; r.declared = {}; byMonth[r.month] = r; o.records.push(r); });
    const ensure = (ym) => { if (!byMonth[ym]) { const r = { month: ym, values: {}, evidence: {}, status: 'draft', inbox: [], declared: {} }; byMonth[ym] = r; o.records.push(r); } return byMonth[ym]; };
    inbox.sort((a, b) => (a.at < b.at ? -1 : 1)).forEach((it) => { const r = ensure(it.month); const x = strip(it); r.inbox.push(x); });
    decls.forEach((dc) => { const r = ensure(dc.month); r.declared[dc.cat] = { by: dc.by, byUid: dc.byUid, role: dc.role, at: dc.at, note: dc.note || '' }; });
    bookings.forEach((b) => st.bookings.push(strip(b)));
    vmonths.forEach((vm) => { published[id + '/' + vm.month] = { rev: vm.issueRev || 1, issuedAt: vm.issuedAt, hash: vm.hash }; base['views/' + id + '/months/' + vm.month] = stable(strip(vm)); });
    reports.forEach((rp) => reportIds.add('views/' + id + '/reports/' + rp._id));
    o.records.sort((a, b) => (a.month < b.month ? -1 : 1));
    st.orgs[id] = o;
  }));
  team = { users: users.map((u) => ({ id: u._id, ...strip(u) })), invites: invites.map((i) => ({ email: i._id, ...strip(i) })) };
  st.users = users.map((u) => ({ id: u._id, name: u.name, title: u.title || '', email: u.email, role: isStaffRole(u.role) ? 'operator' : 'customer', org: u.orgId || undefined, live: true, liveRole: u.role, active: u.active !== false, home: '#/ops/home' }));
  invites.filter((i) => i.role === 'client' && !users.some((u) => (u.email || '').toLowerCase() === i._id)).forEach((i) => {
    st.users.push({ id: 'inv:' + i._id, name: i.name, title: i.title || '', email: i._id, role: 'customer', org: i.orgId, pending: true });
  });
  st.providers = providers.map(strip);
  st.outbox = outbox.map(strip);
  st.gapLog = gaplog.map((g) => { const x = strip(g); x._gid = g._id; return x; });
  st.audit = audit.map(strip);
  st.importMaps = (opsCfg && opsCfg.importMaps) || (api.defaultImportMaps ? api.defaultImportMaps() : {});
  st.guideNotes = (opsCfg && opsCfg.guideNotes) || [];
  leads = leadDocs.map((l) => ({ id: l._id, ...strip(l) }));
  const ids = Object.keys(st.orgs).sort((a, b) => ((st.orgs[a].profile.org_name || a) < (st.orgs[b].profile.org_name || b) ? -1 : 1));
  let view = null; try { view = localStorage.getItem(VIEW_KEY); } catch (e) { /* ignore */ }
  st.session = { user: L.uid, viewOrg: st.orgs[view] ? view : (ids[0] || null) };
  // what is on the server now, for everything this person writes
  const docs = staffDocs(st);
  for (const p in docs) if (!(p in base)) base[p] = stable(docs[p]);
  // documents that should exist but do not (e.g. an earlier publish that failed) are not in base: handled by publish()
  return st;
}

async function loadClient() {
  base = {}; rejected = {}; published = {}; reportIds = new Set();
  const orgId = L.user.orgId; clientOrg = orgId;
  const [view, vmonths, inbox, decls, bookings, settings] = await Promise.all([
    one('views/' + orgId), all('views/' + orgId + '/months'), all('orgs/' + orgId + '/inbox'),
    all('orgs/' + orgId + '/declarations'), all('orgs/' + orgId + '/bookings'), all('orgs/' + orgId + '/settings'),
  ]);
  const v = view || { profile: { org_name: 'Your organisation' }, statuses: {} };
  const profile = { ...(v.profile || {}) };
  const opName = profile.operatorName; delete profile.operatorName; const opTitle = profile.operatorTitle; delete profile.operatorTitle;
  if (opName) profile.operator = 'op-view';
  const tg = settings.find((s) => s._id === 'targets'); if (tg && tg.values) TARGET_KEYS.forEach((k) => { if (k in tg.values) profile[k] = tg.values[k]; });
  const o = { id: orgId, profile, sites: v.sites || undefined, plan: { off: (v.plan && v.plan.off) || {} }, records: [] };
  const pl = settings.find((s) => s._id === 'plan'); if (pl) o.plan.off = pl.off || {};
  const byMonth = {};
  vmonths.forEach((m) => {
    const r = strip(m); delete r.hash; r.status = 'verified'; r.inbox = []; r.declared = r.declared || {};
    byMonth[r.month] = r; o.records.push(r);
  });
  const statuses = v.statuses || {};
  const ensure = (ym) => { if (!byMonth[ym]) { const s = statuses[ym] === 'submitted' ? 'submitted' : 'draft'; const r = { month: ym, values: {}, evidence: {}, status: s, inbox: [], declared: {}, shadow: true }; byMonth[ym] = r; o.records.push(r); } return byMonth[ym]; };
  Object.keys(statuses).forEach(ensure);
  inbox.sort((a, b) => (a.at < b.at ? -1 : 1)).forEach((it) => ensure(it.month).inbox.push(strip(it)));
  decls.forEach((dc) => { const r = ensure(dc.month); if (r.shadow) r.declared[dc.cat] = { by: dc.by, byUid: dc.byUid, role: dc.role, at: dc.at, note: dc.note || '' }; });
  o.records.sort((a, b) => (a.month < b.month ? -1 : 1));
  const st = { v: 4, orgs: { [orgId]: o }, users: [], bookings: bookings.map(strip), providers: [], gapLog: [], audit: [], outbox: [], importMaps: {}, guideNotes: [], ops2: true, opsSeeded: true, live: true };
  st.users.push({ id: L.uid, name: L.user.name, title: L.user.title || '', email: L.user.email, role: 'customer', org: orgId, live: true });
  if (opName) st.users.push({ id: 'op-view', name: opName, title: opTitle || 'Yarta data operator', role: 'operator', email: '' });
  // providers the customer has been introduced to: name only, from the booking
  st.bookings.forEach((b) => { if (b.provider && b.providerName && !st.providers.some((p) => p.id === b.provider)) st.providers.push({ id: b.provider, name: b.providerName, svc: [], accreditation: b.providerAccreditation || '', expiry: '' }); });
  st.session = { user: L.uid };
  const docs = clientDocs(st);
  for (const p in docs) base[p] = stable(docs[p]);
  return st;
}

/* ------------------------------------------------------------------ state → documents */
function targetsOf(profile) { const v = {}; TARGET_KEYS.forEach((k) => { if (profile && profile[k] !== undefined) v[k] = profile[k]; }); return v; }
function inboxDoc(orgId, ym, it) {
  if (!it.id) it.id = safeId(it.key ? it.key.split('/').slice(-1)[0] + '-' + fnv(it.key) : 'in-' + fnv(ym + it.name + it.at));
  if (!it.byUid) it.byUid = L.uid;
  return {
    id: it.id, kind: 'document', month: ym, cat: it.cat || '', site: it.site || '', siteName: it.siteName || '', key: it.key || '',
    path: keyToPath(it.key) || ('orgs/' + orgId + '/inbox/' + ym + '/' + it.id), name: String(it.name || 'document').slice(0, 240),
    size: Math.max(1, Math.round(+it.size || 1)), type: String(it.type || '').slice(0, 120), at: it.at || isoNow(), by: it.by || myName(), byUid: it.byUid,
  };
}
function declDoc(ym, cat, d) {
  if (!d.byUid) d.byUid = L.uid;
  return { month: ym, cat, by: d.by || myName(), byUid: d.byUid, role: d.role || '', at: d.at || isoNow(), note: d.note || '' };
}
function auditDoc(a) {
  if (!a.id) a.id = rid('a-');
  if (!a.byUid) a.byUid = L.uid;
  return { id: a.id, at: a.at || isoNow(), by: a.by || myName(), byUid: a.byUid, role: a.role || '', org: a.org || null, action: String(a.action || 'Change').slice(0, 120), detail: String(a.detail || '').slice(0, 2000) };
}
function clientStatus(r) {
  if (r.status === 'verified' && r.issuedAt) return 'verified';
  if (r.status === 'submitted' || r.status === 'verified') return 'submitted';
  return 'draft';
}
function opOf(s, o) { const id = o.profile && o.profile.operator; return (s.users || []).find((u) => u.id === id && u.role === 'operator'); }
function viewOf(s, o) {
  const profile = { ...(o.profile || {}) }; delete profile.operator;
  const op = opOf(s, o); if (op) { profile.operatorName = op.name; profile.operatorTitle = op.title || 'Yarta data operator'; }
  const statuses = {}; (o.records || []).forEach((r) => { statuses[r.month] = clientStatus(r); });
  const v = { orgId: o.id, profile, plan: { off: (o.plan && o.plan.off) || {} }, statuses };
  if (o.sites) v.sites = o.sites;
  return v;
}
function staffDocs(s) {
  const out = {};
  for (const id of Object.keys(s.orgs || {})) {
    const o = s.orgs[id];
    const od = {}; for (const k in o) if (k !== 'records') od[k] = o[k];
    od.id = id;
    out['orgs/' + id] = od;
    out['orgs/' + id + '/settings/targets'] = { values: targetsOf(o.profile) };
    out['orgs/' + id + '/settings/plan'] = { off: (o.plan && o.plan.off) || {} };
    for (const r of o.records || []) {
      const m = {}; for (const k in r) if (k !== 'inbox' && k !== 'declared' && k !== 'shadow') m[k] = r[k];
      out['orgs/' + id + '/months/' + r.month] = m;
      (r.inbox || []).forEach((it) => { const d = inboxDoc(id, r.month, it); out['orgs/' + id + '/inbox/' + d.id] = d; });
      const dec = r.declared || {}; for (const cat in dec) out['orgs/' + id + '/declarations/' + r.month + '_' + cat] = declDoc(r.month, cat, dec[cat]);
    }
    out['views/' + id] = viewOf(s, o);
  }
  (s.bookings || []).forEach((b) => {
    const d = { ...b }; const p = (s.providers || []).find((x) => x.id === b.provider);
    if (p) { d.providerName = p.name; d.providerAccreditation = p.accreditation || ''; }
    out['orgs/' + b.org + '/bookings/' + b.id] = d;
  });
  (s.providers || []).forEach((p) => { out['providers/' + p.id] = p; });
  (s.outbox || []).forEach((m) => { if (!m.id) m.id = rid('mx-'); out['outbox/' + m.id] = m; });
  (s.gapLog || []).forEach((g) => { if (!g._gid) g._gid = 'g-' + fnv(stable(g)); const d = { ...g }; delete d._gid; out['gaplog/' + g._gid] = d; });
  (s.audit || []).forEach((a) => { const d = auditDoc(a); out['audit/' + d.id] = d; });
  out['ops/config'] = { importMaps: s.importMaps || {}, guideNotes: s.guideNotes || [] };
  return out;
}
function clientDocs(s) {
  const out = {}; const id = clientOrg; const o = s.orgs[id]; if (!o) return out;
  out['orgs/' + id + '/settings/targets'] = { values: targetsOf(o.profile) };
  out['orgs/' + id + '/settings/plan'] = { off: (o.plan && o.plan.off) || {} };
  for (const r of o.records || []) {
    (r.inbox || []).forEach((it) => { const d = inboxDoc(id, r.month, it); out['orgs/' + id + '/inbox/' + d.id] = d; });
    if (r.shadow || r.status === 'draft' || r.status === 'returned') {
      const dec = r.declared || {}; for (const cat in dec) out['orgs/' + id + '/declarations/' + r.month + '_' + cat] = declDoc(r.month, cat, dec[cat]);
    }
  }
  (s.bookings || []).filter((b) => b.org === id).forEach((b) => { out['orgs/' + id + '/bookings/' + b.id] = b; });
  (s.audit || []).forEach((a) => { const d = auditDoc(a); out['audit/' + d.id] = d; });
  return out;
}

/* ------------------------------------------------------------------ writing */
function emptyState() { return { v: 4, orgs: {}, users: [], bookings: [], providers: [], gapLog: [], audit: [], outbox: [], importMaps: {}, guideNotes: [], session: null, ops2: true, opsSeeded: true, live: true }; }

function sync() {
  if (!L.ready || !L.uid || !L.user) return true;
  clearTimeout(timer);
  timer = setTimeout(() => { timer = null; runSync(); }, 700);
  savedLabel('Saving…');
  return true;
}
async function runSync() {
  if (syncing) { again = true; return; }
  syncing = true;
  try {
    const st = api.getState();
    const staff = isStaffRole(L.user.role);
    if (staff) stampMonths(st);
    if (staff) await invitesFromState(st);
    const docs = staff ? staffDocs(st) : clientDocs(st);
    const ops = [];
    for (const p in docs) {
      const js = stable(docs[p]);
      if (base[p] === js || rejected[p] === js) continue;
      if (CREATE_ONLY.test(p) && p in base) continue;
      if (!staff) { const op = clientOp(p, docs[p], js); if (op) ops.push(op); continue; }
      ops.push({ kind: 'set', path: p, data: withMeta(p, docs[p]), js });
    }
    if (staff) {
      const gone = Object.keys(base).filter((p) => !(p in docs) && DELETABLE.test(p));
      if (gone.length > 25) { flash('Not saved: that change would delete ' + gone.length + ' records at once. Reload the page.', 'err'); syncing = false; return; }
      gone.forEach((p) => ops.push({ kind: 'del', path: p }));
      (await publishOps(st)).forEach((o) => ops.push(o));
    } else {
      Object.keys(base).filter((p) => !(p in docs) && /\/declarations\//.test(p)).forEach((p) => ops.push({ kind: 'del', path: p }));
    }
    if (ops.length) await commit(ops);
    savedLabel('Saved to Yarta · ' + new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }));
  } catch (e) {
    console.error(e); savedLabel('Not saved yet. Retrying…');
    flash('Yarta could not save that change. Check your connection; it will keep retrying.', 'err');
    clearTimeout(timer); timer = setTimeout(() => { timer = null; runSync(); }, 10000);
  } finally {
    syncing = false;
    if (again) { again = false; runSync(); }
  }
}
function clientOp(p, data, js) {
  if (/\/settings\//.test(p)) return { kind: 'set', path: p, data: withMeta(p, data), js };
  if (/\/inbox\//.test(p)) return p in base ? null : { kind: 'set', path: p, data, js };
  if (/\/declarations\//.test(p)) return { kind: 'set', path: p, data, js };
  if (/^audit\//.test(p)) return p in base ? null : { kind: 'set', path: p, data, js };
  if (/\/bookings\//.test(p)) {
    if (!(p in base)) { const d = {}; BOOKING_KEYS.forEach((k) => { d[k] = data[k] === undefined ? (k === 'slot' || k === 'month' ? null : k === 'other' || k === 'share' || k === 'group' ? false : '') : data[k]; }); d.createdByUid = L.uid; return { kind: 'set', path: p, data: d, js }; }
    if (data.status === 'cancelled') return { kind: 'update', path: p, data: { status: 'cancelled', cancelledAt: data.cancelledAt || isoNow(), cancelledBy: data.cancelledBy || myName(), cancelledByUid: L.uid }, js };
    return null;
  }
  return null;
}
function withMeta(p, data) {
  if (SETTINGS.test(p)) return { ...data, updatedAt: serverTimestamp(), updatedBy: myName(), updatedByUid: L.uid };
  return data;
}
/* who entered and who verified, recorded at the moment it happens (the rules check both) */
function stampMonths(st) {
  for (const id of Object.keys(st.orgs || {})) {
    for (const r of st.orgs[id].records || []) {
      const was = base['orgs/' + id + '/months/' + r.month]; const before = was ? JSON.parse(was) : null;
      if (r.status === 'submitted' && (!before || before.status !== 'submitted')) r.enteredByUid = L.uid;
      if (r.status === 'verified' && (!before || before.status !== 'verified')) r.verifiedByUid = L.uid;
    }
  }
}
/* a customer becomes visible to that customer only when Yarta issues the report */
async function publishOps(st) {
  const out = [];
  const E = window.YESE, D = window.YESD;
  for (const id of Object.keys(st.orgs || {})) {
    const o = st.orgs[id];
    let S = null;
    for (const r of o.records || []) {
      if (r.status !== 'verified' || !r.issuedAt) continue;
      const rev = r.issueRev || 1;
      const key = id + '/' + r.month; const cur = published[key];
      const path = 'views/' + id + '/months/' + r.month;
      if (cur && cur.rev === rev && cur.issuedAt === r.issuedAt && (base[path] || '').length) {
        const repPath = 'views/' + id + '/reports/' + r.month + '-r' + rev;
        if (reportIds.has(repPath)) continue;
      }
      const pub = { month: r.month, status: 'verified', values: r.values || {} };
      if (r.sites !== undefined) pub.sites = r.sites;
      const ev = {}; Object.keys(r.evidence || {}).forEach((c) => { const e = r.evidence[c] || {}; ev[c] = { name: e.name || '', grade: e.grade || null, at: e.at || '' }; });
      Object.assign(pub, {
        evidence: ev, declared: r.declared || {}, enteredAt: r.enteredAt || '', enteredBy: r.enteredBy || '', enteredByUid: r.enteredByUid || null,
        verifiedAt: r.verifiedAt || '', verifiedBy: r.verifiedBy || '', verifiedByUid: r.verifiedByUid || null,
        issuedAt: r.issuedAt, issuedBy: r.issuedBy || '', issueRev: rev, method: E.VERSION, dictionary: D.VERSION,
      });
      pub.hash = await sha256(stable(pub));
      const js = stable(pub);
      if (base[path] !== js) out.push({ kind: 'set', path, data: pub, js, publish: { key, rev, issuedAt: r.issuedAt, hash: pub.hash } });
      const repPath = 'views/' + id + '/reports/' + r.month + '-r' + rev;
      if (!reportIds.has(repPath)) {
        if (!S) S = E.series(o.records.filter((x) => x.status === 'verified'), o.profile);
        const m = S.months.find((x) => x.month === r.month);
        out.push({ kind: 'set', path: repPath, report: true, data: { month: r.month, rev, issuedAt: r.issuedAt, issuedBy: r.issuedBy || myName(), issuedByUid: L.uid, method: E.VERSION, dictionary: D.VERSION, score: m && isFinite(m.score) ? Math.round(m.score) : null, hash: pub.hash, createdAt: serverTimestamp() } });
      }
    }
  }
  return out;
}
const ORDER = [/^orgs\/[^/]+$/, /\/months\//, /\/settings\//, /\/inbox\//, /\/declarations\//, /\/bookings\//, /^views\/[^/]+$/, /^views\/[^/]+\/months\//, /\/reports\//];
const rank = (p) => { const i = ORDER.findIndex((re) => re.test(p)); return i < 0 ? ORDER.length : i; };
async function commit(ops) {
  ops.sort((a, b) => rank(a.path) - rank(b.path));
  pendingWrites += ops.length;
  const chunks = []; for (let i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
  const failed = [];
  for (const chunk of chunks) {
    const b = writeBatch(db);
    chunk.forEach((op) => apply(b, op));
    try { await b.commit(); chunk.forEach(done); }
    catch (e) {
      if (e && e.code !== 'permission-denied') { pendingWrites -= ops.length; throw e; }
      const seen = new Set();
      for (const op of chunk) {   // find the one the rules refused; keep the rest
        if (seen.has(op)) continue; seen.add(op);
        const b1 = writeBatch(db); apply(b1, op);
        if (op.report || /^views\/[^/]+\/months\//.test(op.path)) {   // a publish and its report stand or fall together
          const pair = chunk.filter((x) => x !== op && x.path.split('/')[1] === op.path.split('/')[1] && (x.report || /^views\/[^/]+\/months\//.test(x.path)) && (x.data && op.data && x.data.month === op.data.month));
          pair.forEach((x) => { apply(b1, x); seen.add(x); });
          op.pair = pair;
        }
        try { await b1.commit(); done(op); (op.pair || []).forEach(done); }
        catch (e2) { [op].concat(op.pair || []).forEach((x) => { if (x.js) rejected[x.path] = x.js; failed.push(x.path); }); console.warn('refused', op.path, e2 && e2.message); }
      }
    }
  }
  pendingWrites -= ops.length;
  if (failed.length) flash('Yarta did not accept ' + failed.length + ' change' + (failed.length === 1 ? '' : 's') + ' (' + failed.slice(0, 2).join(', ') + '). Reload to see the current figures.', 'err');
}
function apply(b, op) {
  const r = doc(db, op.path);
  if (op.kind === 'del') b.delete(r);
  else if (op.kind === 'update') b.update(r, op.data);
  else b.set(r, op.data);
}
function done(op) {
  if (op.kind === 'del') { delete base[op.path]; return; }
  if (op.report) { reportIds.add(op.path); return; }
  if (op.publish) published[op.publish.key] = { rev: op.publish.rev, issuedAt: op.publish.issuedAt, hash: op.publish.hash };
  if (op.js) base[op.path] = op.js;
  delete rejected[op.path];
}
function savedLabel(t) { const s = document.getElementById('saved'); if (s) s.textContent = t; }

/* new customer contacts typed into the tool become invitations */
async function invitesFromState(st) {
  const fresh = (st.users || []).filter((u) => !u.live && !u.pending && u.role === 'customer' && u.email && u.org && st.orgs[u.org]);
  if (!fresh.length) return;
  const orgsFirst = writeBatch(db);
  fresh.forEach((u) => { const o = st.orgs[u.org]; const od = {}; for (const k in o) if (k !== 'records') od[k] = o[k]; orgsFirst.set(doc(db, 'orgs/' + u.org), od); });
  await orgsFirst.commit();
  fresh.forEach((u) => { const o = st.orgs[u.org]; const od = {}; for (const k in o) if (k !== 'records') od[k] = o[k]; base['orgs/' + u.org] = stable(od); });
  for (const u of fresh) {
    const email = u.email.trim().toLowerCase();
    try {
      await setDoc(doc(db, 'invites', email), inviteDoc(email, u.name, u.title, 'client', u.org));
      u.id = 'inv:' + email; u.email = email; u.pending = true;
      team.invites = team.invites.filter((i) => i.email !== email).concat([{ email, name: u.name, title: u.title || '', role: 'client', orgId: u.org, invitedBy: myName(), invitedAt: isoNow() }]);
    } catch (e) { console.error(e); flash('Could not create the sign-in invitation for ' + email + '.', 'err'); u.pending = true; u.failed = true; }
  }
}
function inviteDoc(email, name, title, role, orgId) {
  return { email, name: String(name || email).slice(0, 120), title: String(title || '').slice(0, 120), role, orgId: role === 'client' ? orgId : null,
    invitedByUid: L.uid, invitedBy: myName(), invitedAt: serverTimestamp(), expiresAt: Timestamp.fromDate(new Date(Date.now() + INVITE_DAYS * 864e5)) };
}
async function sendLink(email, toPage) {
  await sendSignInLinkToEmail(auth, email, { url: toPage === 'tool' ? toolUrl() : portalUrl(), handleCodeInApp: true });
}

/* ------------------------------------------------------------------ files */
async function putFile(key, file) {
  const path = keyToPath(key); if (!path) throw new Error('bad key');
  await uploadBytes(ref(storage, path), file, { contentType: mimeOf(file), customMetadata: { name: String(file.name || '').slice(0, 200) } });
}
async function getFile(key) {
  const path = keyToPath(key); if (!path) return null;
  return getBlob(ref(storage, path));
}
async function delFile(key) { const path = keyToPath(key); if (path) await deleteObject(ref(storage, path)); }

/* ------------------------------------------------------------------ screens: sign-in */
function loadingHtml() {
  return '<div class="login"><div class="r" style="min-height:60vh;display:flex;align-items:center;justify-content:center"><div class="box" style="text-align:center"><p class="kicker">Yarta</p><h2 style="font-size:24px;margin:8px 0">Loading…</h2><p class="small muted">Getting your figures.</p></div></div></div>';
}
function loginHtml() {
  const lg = L.login, team0 = PAGE === 'tool';
  let box = '';
  if (lg.step === 'sent') {
    box = '<p class="kicker">Check your email</p><h2 style="font-size:28px;margin:8px 0 14px">We sent you a sign-in link</h2>'
      + '<p>It went to <b>' + esc(lg.email) + '</b>. Open it on this device to sign in. The link works once.</p>'
      + '<p class="small muted" style="margin-top:14px">Nothing arrived after a few minutes? Check junk mail, then <button class="link" type="button" data-live="restart" style="background:none;border:0;padding:0;font:inherit;cursor:pointer">send another</button>.</p>';
  } else if (lg.step === 'confirm') {
    box = '<p class="kicker">Finish signing in</p><h2 style="font-size:28px;margin:8px 0 14px">Confirm your email</h2>'
      + '<p class="small muted">You opened the link on a different device or browser. Type the address the link was sent to.</p>'
      + form('Confirm and sign in', lg.email);
  } else if (lg.step === 'working') {
    box = '<p class="kicker">Signing in</p><h2 style="font-size:28px;margin:8px 0">One moment…</h2>';
  } else if (lg.step === 'denied' || lg.step === 'error') {
    box = '<p class="kicker">' + (lg.step === 'error' ? 'Something went wrong' : 'No access') + '</p><h2 style="font-size:26px;margin:8px 0 14px">' + esc(lg.msg) + '</h2>'
      + '<p class="small muted">Questions: <a class="link" href="mailto:contact@yes.com.au">contact@yes.com.au</a></p>'
      + '<button class="btn btn-ghost" type="button" data-live="restart" style="color:var(--ink);margin-top:10px">Use a different email</button>';
  } else if (lg.step === 'wrongpage') {
    const toTool = lg.msg === 'tool';
    box = '<p class="kicker">Wrong door</p><h2 style="font-size:26px;margin:8px 0 14px">' + (toTool ? 'This is the Yarta team tool. Your account is a customer account.' : 'This is the customer portal. Your account is a Yarta team account.') + '</h2>'
      + '<div class="btn-row"><a class="btn btn-primary" href="' + esc(toTool ? portalUrl() : toolUrl()) + '">' + (toTool ? 'Open the client portal' : 'Open the team tool') + '</a>'
      + '<button class="btn btn-ghost" type="button" data-live="signout" style="color:var(--ink)">Sign out</button></div>';
  } else {
    box = '<p class="kicker">Sign in</p><h2 style="font-size:30px;margin:8px 0 14px">' + (team0 ? 'Yarta team sign-in' : 'Sign in to your Yarta portal') + '</h2>'
      + (lg.msg ? '<p class="small" style="color:#B3261E;margin:0 0 12px">' + esc(lg.msg) + '</p>' : '')
      + form('Email me a sign-in link', lg.email)
      + '<p class="small muted" style="margin-top:16px">No passwords. We email a one-time link that signs you in on this device. Access is by invitation' + (team0 ? '.' : ' from Yarta.') + '</p>';
  }
  const lead = team0
    ? '<p class="eyebrow">Yarta team</p><h1><span class="silver">Documents in, figures entered,</span> months verified, reports issued.</h1><p class="lead" style="margin-top:20px;color:var(--silver-2)">The operations tool behind every Yarta Report. Two people sign off every month: whoever enters it cannot verify it.</p>'
    : '<p class="eyebrow">Client portal</p><h1><span class="silver">Your environmental report,</span> as Yarta issued it.</h1><p class="lead" style="margin-top:20px;color:var(--silver-2)">Your dashboard, reports, roadmap and suggestions. Send your documents here; Yarta enters every figure and a second analyst verifies the month before you see it.</p>';
  return '<div class="login"><div class="l"><div class="bg" aria-hidden="true"><video data-bgv muted loop playsinline preload="none" poster="../assets/video/aisle-720.webp"><source data-src="../assets/video/aisle-720.mp4" type="video/mp4"></video></div>'
    + '<a class="brand" href="../"><span class="mark silver" style="font-size:30px">Yarta</span><span class="full">Environmental<br>Sustainability</span></a>'
    + '<div>' + lead + '</div><p class="small" style="color:var(--silver-4);max-width:52ch">Your data is only ever shown to your organisation and the Yarta team. <a class="link" href="../privacy/" style="color:var(--silver-2)">Privacy</a></p></div>'
    + '<div class="r"><div class="box">' + box + '</div></div></div>';
}
function form(label, email) {
  return '<form id="ylive-form" novalidate><div class="field"><label for="ylive-email">Work email</label><input type="email" id="ylive-email" autocomplete="email" required value="' + esc(email || '') + '"></div>'
    + '<button class="btn btn-primary" type="submit" style="margin-top:12px">' + esc(label) + '</button></form>';
}
async function onSubmit(e) {
  const f = e.target; if (!f || f.id !== 'ylive-form') return;
  e.preventDefault(); e.stopPropagation();
  const email = (document.getElementById('ylive-email').value || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { L.login = { ...L.login, email, msg: 'Type a valid email address.' }; rerender(); return; }
  if (L.login.step === 'confirm') return completeLink(email);
  L.login = { step: 'working', email, msg: '' }; rerender();
  try {
    await sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
    try { localStorage.setItem(EMAIL_KEY, email); } catch (er) { /* ignore */ }
    L.login = { step: 'sent', email, msg: '' };
  } catch (er) {
    console.error(er);
    L.login = { step: 'form', email, msg: er && er.code === 'auth/quota-exceeded' ? 'Too many sign-in emails just now. Try again in a few minutes.' : 'The sign-in email could not be sent. Check the address and try again.' };
  }
  rerender();
}
function onClick(e) {
  const t = e.target.closest ? e.target.closest('[data-live]') : null; if (!t) return;
  const a = t.getAttribute('data-live');
  e.preventDefault(); e.stopPropagation();
  if (a === 'restart') { L.login = { step: 'form', email: '', msg: '' }; rerender(); }
  else if (a === 'signout') signOut();
  else if (a === 'refresh') reload();
  else if (a === 'team-invite') teamInvite();
  else if (a === 'team-send') teamSend(t.getAttribute('data-email'), t.getAttribute('data-page'));
  else if (a === 'team-active') teamActive(t.getAttribute('data-uid'), t.getAttribute('data-on') === '1');
  else if (a === 'team-revoke') teamRevoke(t.getAttribute('data-email'));
  else if (a === 'lead-status') leadStatus(t.getAttribute('data-id'), t.getAttribute('data-status'));
}
async function signOut() {
  if (pendingWrites > 0 || timer) { clearTimeout(timer); timer = null; await runSync(); }
  try { await fbSignOut(auth); } catch (e) { /* ignore */ }
  location.hash = ''; location.reload();
}

/* ------------------------------------------------------------------ screens: team and access */
function roleLabel(r) { return { owner: 'Owner', staff: 'Yarta team', client: 'Customer' }[r] || r; }
function vTeam() {
  const st = api.getState(), owner = me().role === 'owner';
  const orgName = (id) => (st.orgs[id] && st.orgs[id].profile.org_name) || id || '';
  const accepted = new Set(team.users.map((u) => (u.email || '').toLowerCase()));
  const staffRows = team.users.filter((u) => isStaffRole(u.role)).map((u) => row(u, true)).join('');
  const clientRows = team.users.filter((u) => u.role === 'client').sort((a, b) => (orgName(a.orgId) < orgName(b.orgId) ? -1 : 1)).map((u) => row(u, false)).join('');
  const pend = team.invites.filter((i) => !accepted.has(i.email)).map((i) => {
    const exp = i.expiresAt ? new Date(i.expiresAt) : null; const lapsed = exp && exp.getTime() < Date.now();
    return '<tr><td><b style="font-weight:600">' + esc(i.name) + '</b><div class="small muted">' + esc(i.email) + '</div></td><td>' + roleLabel(i.role) + (i.orgId ? ' · ' + esc(orgName(i.orgId)) : '') + '</td><td class="small">' + (lapsed ? '<span class="st st-returned">Expired</span>' : 'Invited by ' + esc(i.invitedBy || '') + (exp ? '<div class="muted">until ' + exp.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + '</div>' : '')) + '</td><td style="text-align:right;white-space:nowrap">'
      + ((owner || i.role === 'client') ? '<button class="btn btn-ghost btn-sm" type="button" data-live="team-send" data-email="' + esc(i.email) + '" data-page="' + (i.role === 'client' ? 'portal' : 'tool') + '" style="color:var(--ink)">' + (lapsed ? 'Renew and send link' : 'Email sign-in link') + '</button> <button class="btn btn-ghost btn-sm" type="button" data-live="team-revoke" data-email="' + esc(i.email) + '" style="color:var(--ink)">Withdraw</button>' : '') + '</td></tr>';
  }).join('');
  function row(u, isTeam) {
    const canToggle = u.id !== L.uid && (owner || (!isTeam));
    return '<tr><td><b style="font-weight:600">' + esc(u.name) + '</b>' + (u.id === L.uid ? ' <span class="chip">You</span>' : '') + '<div class="small muted">' + esc(u.email) + '</div></td><td>' + roleLabel(u.role) + (u.orgId ? ' · ' + esc(orgName(u.orgId)) : '') + '</td><td class="small">' + (u.active === false ? '<span class="st st-returned">Switched off</span>' : '<span class="st st-verified">Active</span>') + (u.lastSeenAt ? '<div class="muted">last in ' + new Date(u.lastSeenAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + '</div>' : '') + '</td><td style="text-align:right;white-space:nowrap">'
      + (canToggle ? '<button class="btn btn-ghost btn-sm" type="button" data-live="team-active" data-uid="' + esc(u.id) + '" data-on="' + (u.active === false ? '1' : '0') + '" style="color:var(--ink)">' + (u.active === false ? 'Switch back on' : 'Switch off') + '</button>' : '') + '</td></tr>';
  }
  const orgOpts = Object.keys(st.orgs).map((id) => '<option value="' + esc(id) + '">' + esc(orgName(id)) + '</option>').join('');
  const tbl = (rows, empty) => rows ? '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact"><thead><tr><th>Person</th><th>Access</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="sec-s" style="margin-top:8px">' + empty + '</p>';
  const body = '<div class="pg-head"><div><p class="kicker">Team and access</p><h1>Who can sign in</h1><p class="pg-sub">Access is by invitation only. Customers see their own organisation\'s issued reports and nothing else; the database enforces it. Switching someone off takes effect on their next action.</p></div></div>'
    + '<div class="panel"><h3>Invite someone</h3><div class="row2" style="margin-top:12px"><div class="stack">'
    + '<div class="field"><label for="tm-name">Name <span class="req">*</span></label><input type="text" id="tm-name"></div>'
    + '<div class="field"><label for="tm-email">Email <span class="req">*</span></label><input type="email" id="tm-email"></div>'
    + '<div class="field"><label for="tm-title">Role or title</label><input type="text" id="tm-title" placeholder="Finance officer"></div></div><div class="stack">'
    + '<div class="field"><label for="tm-kind">Access</label><select id="tm-kind"><option value="client">Customer contact</option>' + (owner ? '<option value="staff">Yarta team</option><option value="owner">Owner (can invite the team)</option>' : '') + '</select></div>'
    + '<div class="field"><label for="tm-org">Organisation (customers)</label><select id="tm-org">' + (orgOpts || '<option value="">Create a customer first</option>') + '</select></div>'
    + '<label class="small" style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" id="tm-send" checked> Email them a sign-in link now</label></div></div>'
    + '<div class="pill-row" style="margin-top:14px"><button class="btn btn-primary" type="button" data-live="team-invite">Send invitation</button></div>'
    + (owner ? '' : '<p class="small muted" style="margin-top:10px">Only an owner can invite Yarta team members.</p>') + '</div>'
    + '<h2 class="sec-t" style="margin-top:28px">Waiting to accept</h2>' + tbl(pend, 'No open invitations.')
    + '<h2 class="sec-t" style="margin-top:28px">Yarta team</h2>' + tbl(staffRows, 'Nobody yet.')
    + '<h2 class="sec-t" style="margin-top:28px">Customer logins</h2>' + tbl(clientRows, 'No customer has signed in yet.')
    + '<p class="small muted" style="margin-top:22px">Signed in as ' + esc(me().name) + ' (' + esc(me().email) + ') · ' + roleLabel(me().role) + '. <button class="link" type="button" data-live="refresh" style="background:none;border:0;padding:0;font:inherit;cursor:pointer">Reload from the server</button></p>';
  return api.shell('team', body);
}
async function teamInvite() {
  const v = (id) => ((document.getElementById(id) || {}).value || '').trim();
  const name = v('tm-name'), email = v('tm-email').toLowerCase(), title = v('tm-title'), kind = v('tm-kind') || 'client', orgId = v('tm-org');
  const send = !!(document.getElementById('tm-send') || {}).checked;
  if (!name) return flash('Add their name.', 'err');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return flash('Add a valid email.', 'err');
  if (kind === 'client' && !orgId) return flash('Choose the organisation.', 'err');
  if (team.users.some((u) => (u.email || '').toLowerCase() === email)) return flash(email + ' already has an account.', 'err');
  try {
    await setDoc(doc(db, 'invites', email), inviteDoc(email, name, title, kind, orgId));
    team.invites = team.invites.filter((i) => i.email !== email).concat([{ email, name, title, role: kind, orgId: kind === 'client' ? orgId : null, invitedBy: myName(), invitedAt: isoNow(), expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5).toISOString() }]);
    const st = api.getState();
    if (kind === 'client') { st.users = st.users.filter((u) => u.id !== 'inv:' + email); st.users.push({ id: 'inv:' + email, name, title, email, role: 'customer', org: orgId, pending: true }); }
    api.log('Invitation created', name + ' · ' + email + ' · ' + roleLabel(kind), kind === 'client' ? orgId : null);
    if (send) await sendLink(email, kind === 'client' ? 'portal' : 'tool');
    api.save();
    flash(send ? 'Invitation sent to ' + email + '.' : 'Invitation created for ' + email + '. They can sign in at the ' + (kind === 'client' ? 'client portal' : 'team tool') + '.');
    rerender();
  } catch (e) { console.error(e); flash(e && e.code === 'permission-denied' ? 'You cannot send that kind of invitation.' : 'The invitation could not be created.', 'err'); }
}
async function teamSend(email, page) {
  try {
    const inv = team.invites.find((i) => i.email === email);
    if (inv && inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now() + 864e5) {
      await setDoc(doc(db, 'invites', email), inviteDoc(email, inv.name, inv.title, inv.role, inv.orgId));
      inv.expiresAt = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
    }
    await sendLink(email, page);
    flash('Sign-in link emailed to ' + email + '.'); rerender();
  } catch (e) { console.error(e); flash('The link could not be sent.', 'err'); }
}
async function teamActive(uid, on) {
  try {
    await updateDoc(doc(db, 'users', uid), { active: on });
    const u = team.users.find((x) => x.id === uid); if (u) u.active = on;
    const su = api.getState().users.find((x) => x.id === uid); if (su) su.active = on;
    api.log(on ? 'Access switched back on' : 'Access switched off', (u && u.name) || uid, (u && u.orgId) || null); api.save();
    flash(on ? 'Access switched back on.' : 'Access switched off.'); rerender();
  } catch (e) { console.error(e); flash('Only an owner can change a Yarta team member\'s access.', 'err'); }
}
async function teamRevoke(email) {
  try {
    await deleteDoc(doc(db, 'invites', email));
    team.invites = team.invites.filter((i) => i.email !== email);
    const st = api.getState(); st.users = st.users.filter((u) => u.id !== 'inv:' + email);
    flash('Invitation withdrawn.'); rerender();
  } catch (e) { console.error(e); flash('That invitation could not be withdrawn.', 'err'); }
}

/* ------------------------------------------------------------------ screens: Readiness Check leads */
const SECTOR = { council: 'Council', business: 'Business and offices', health: 'Hospitals and aged care', education: 'Universities and schools', manufacturing: 'Manufacturing and industry', construction: 'Construction and property', retail: 'Retail and hospitality', logistics: 'Logistics and transport', government: 'Government agency', other: 'Other' };
const REC = { electricity: 'Electricity bills', gas: 'Gas bills', fuel: 'Fuel purchases', vehicles: 'Vehicle list', water: 'Water bills', waste: 'Waste and recycling reports', solar: 'Solar generation', travel: 'Flights and travel', kerbside: 'Kerbside collection data', procurement: 'Purchasing data' };
const RECV = { monthly: 'Monthly', patchy: 'Patchy', no: 'No', unsure: 'Not sure', na: 'Not relevant' };
const LSTAT = { new: 'New', contacted: 'Contacted', converted: 'Customer', closed: 'Closed' };
const LBL = {
  employees: { '1-30': 'Up to 30', '31-100': '31 to 100', '101-500': '101 to 500', '500+': 'More than 500' },
  residents: { 'under-10k': 'Under 10,000', '10-50k': '10,000 to 50,000', '50-100k': '50,000 to 100,000', '100k+': 'More than 100,000' },
  sites: { 1: 'One', '2-5': '2 to 5', '6-20': '6 to 20', '20+': 'More than 20' },
  drivers: { climate: 'Mandatory climate reporting', target: 'A council or company target', funding: 'Grant or funding conditions', tender: 'A customer or tender asks', board: 'Board or executive reporting', improve: 'To improve, not just report', unsure: 'Not sure yet' },
  group: { 1: 'Group 1', 2: 'Group 2', 3: 'Group 3', none: 'Not covered', unsure: 'Not sure' },
  timeline: { '3m': 'Within 3 months', '6m': '3 to 6 months', '12m': '6 to 12 months', exploring: 'Just exploring' },
  holder: { finance: 'Finance', facilities: 'Facilities or property', sustainability: 'Sustainability', fleet: 'Fleet', operations: 'Operations', unsure: 'Not sure' },
  approach: { none: 'Nothing yet', spreadsheet: 'Spreadsheets', consultant: 'A consultant', software: 'Carbon software', contractor: "A contractor's portal" },
  baseline: { yes: 'Yes', no: 'No', unsure: 'Not sure' },
};
const lbl = (k, v) => (Array.isArray(v) ? v.map((x) => (LBL[k] && LBL[k][x]) || x).join(', ') : (LBL[k] && LBL[k][v]) || v || '');
function leadChip(s) { return '<span class="st ' + ({ new: 'st-submitted', contacted: 'st-draft', converted: 'st-verified', closed: 'st-returned' }[s] || '') + '">' + esc(LSTAT[s] || s) + '</span>'; }
function vLeads(id) {
  if (id) return vLead(id);
  const rows = leads.map((l) => '<tr><td><a class="link" href="#/ops/leads/' + esc(l.id) + '"><b style="font-weight:600">' + esc(l.org_name) + '</b></a><div class="small muted">' + esc(SECTOR[l.sector] || l.sector) + (l.state ? ' · ' + esc(l.state) : '') + '</div></td><td>' + esc(l.contact_name) + '<div class="small muted">' + esc(l.email) + '</div></td><td class="num">' + (l.score != null ? esc(l.score) + '%' : '—') + '<div class="small muted">' + esc(l.band || '') + '</div></td><td class="small">' + (l.created ? new Date(l.created).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '') + '</td><td>' + leadChip(l.status || 'new') + '</td></tr>').join('');
  const body = '<div class="pg-head"><div><p class="kicker">Readiness Checks</p><h1>Leads</h1><p class="pg-sub">Every Readiness Check submitted on the website. Each one is also the intake for onboarding: converting a lead opens a new customer with its answers filled in.</p></div><div class="pg-actions"><a class="btn btn-ghost btn-sm" href="../readiness/" target="_blank" rel="noopener" style="color:var(--ink)">Open the Readiness Check</a></div></div>'
    + (rows ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Organisation</th><th>Contact</th><th>Records ready</th><th>Received</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty">No Readiness Checks yet. Link to it from the council email.</div>');
  return api.shell('leads', body);
}
function vLead(id) {
  const l = leads.find((x) => x.id === id);
  if (!l) return api.shell('leads', '<div class="empty">That lead is not here. <a class="link" href="#/ops/leads">All leads</a>.</div>');
  const kv = (k, v) => v ? '<tr><th style="width:38%">' + esc(k) + '</th><td>' + v + '</td></tr>' : '';
  const recs = Object.keys(REC).filter((k) => l.records && l.records[k]).map((k) => kv(REC[k], esc(RECV[l.records[k]] || l.records[k]))).join('');
  const body = '<div class="pg-head"><div><p class="kicker"><a class="link" href="#/ops/leads">Leads</a></p><h1>' + esc(l.org_name) + '</h1><p class="pg-sub">' + esc(SECTOR[l.sector] || l.sector) + (l.state ? ' · ' + esc(l.state) : '') + ' · received ' + (l.created ? new Date(l.created).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '') + '</p></div><div class="pg-actions">' + leadChip(l.status || 'new') + '</div></div>'
    + '<div class="row2"><div class="panel"><h3>Contact</h3><table class="tbl compact" style="margin-top:8px"><tbody>' + kv('Name', esc(l.contact_name)) + kv('Role', esc(l.contact_role)) + kv('Email', '<a class="link" href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>') + kv('Phone', esc(l.phone)) + kv('Notes', esc(l.notes)) + '</tbody></table></div>'
    + '<div class="panel"><h3>Readiness result</h3><p style="font-size:34px;font-weight:700;margin:6px 0">' + (l.score != null ? esc(l.score) + '%' : '—') + '</p><p class="sec-s">' + esc(l.band || '') + '</p>'
    + '<table class="tbl compact" style="margin-top:8px"><tbody>' + ['employees', 'residents', 'sites', 'drivers', 'group', 'timeline', 'holder', 'approach', 'baseline'].map((k) => kv({ employees: 'Employees', residents: 'Residents', sites: 'Sites', drivers: 'Why now', group: 'Reporting group', timeline: 'First report needed', holder: 'Who holds the records', approach: 'Reporting today', baseline: 'Baseline year' }[k], esc(lbl(k, l[k])))).join('') + '</tbody></table></div></div>'
    + '<div class="panel" style="margin-top:18px"><h3>Records they hold</h3><table class="tbl compact" style="margin-top:8px"><tbody>' + (recs || '<tr><td>Not answered</td></tr>') + '</tbody></table></div>'
    + '<div class="pill-row" style="margin-top:18px"><a class="btn btn-primary" href="#/ops/customers/new?lead=' + esc(l.id) + '">Convert to customer</a>'
    + ['contacted', 'closed', 'new'].filter((s) => s !== l.status).map((s) => '<button class="btn btn-ghost" type="button" data-live="lead-status" data-id="' + esc(l.id) + '" data-status="' + s + '" style="color:var(--ink)">Mark ' + esc(LSTAT[s].toLowerCase()) + '</button>').join('') + '</div>';
  return api.shell('leads', body);
}
async function leadStatus(id, status) {
  try {
    await updateDoc(doc(db, 'leads', id), { status, updatedAt: isoNow(), updatedBy: myName() });
    const l = leads.find((x) => x.id === id); if (l) l.status = status;
    flash('Lead marked ' + (LSTAT[status] || status).toLowerCase() + '.'); rerender();
  } catch (e) { console.error(e); flash('The lead could not be updated.', 'err'); }
}
function prefillFromLead(q) {
  const l = q && q.lead && leads.find((x) => x.id === q.lead); if (!l) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '' && !el.dataset.filled) { el.value = v; el.dataset.filled = '1'; } };
  const type = l.sector === 'council' ? 'Council' : l.sector === 'government' ? 'Government agency' : 'Business';
  set('nc-name', l.org_name); set('nc-type', type);
  if (window.YESS && window.YESS.BY && window.YESS.BY[l.sector]) set('nc-sector', l.sector);
  if (l.state && l.state !== 'National') set('nc-state', l.state);
  set('nc-cname', l.contact_name); set('nc-ctitle', l.contact_role); set('nc-cemail', l.email);
  const btn = document.querySelector('[data-act="nc-create"]');
  if (btn && !btn.dataset.lead) { btn.dataset.lead = l.id; btn.addEventListener('click', () => setTimeout(() => { if (location.hash.indexOf('#/ops/gaps/') === 0) leadStatus(l.id, 'converted'); }, 400)); }
  const head = document.querySelector('.pg-sub'); if (head && !head.dataset.lead) { head.dataset.lead = '1'; head.insertAdjacentHTML('beforeend', ' <b>Filled in from ' + esc(l.org_name) + '\'s Readiness Check.</b> Add the employee count, then create.'); }
}

/* ------------------------------------------------------------------ hooks for portal.js */
L.emptyState = emptyState;
L.sync = sync;
L.putFile = putFile; L.getFile = getFile; L.delFile = delFile;
L.loginHtml = loginHtml; L.loadingHtml = loadingHtml;
L.signOut = signOut;
L.navExtras = () => [['#/ops/leads', 'Leads', 'leads', leads.filter((l) => (l.status || 'new') === 'new').length || ''], ['#/ops/team', 'Team and access', 'team']];
L.route = (P, q) => {
  if (!L.user || !isStaffRole(L.user.role) || P[0] !== 'ops') return null;
  if (P[1] === 'team') return vTeam();
  if (P[1] === 'leads') return vLeads(P[2]);
  return null;
};
L.afterRender = (P, q) => {
  if (P[0] === 'ops' && P[1] === 'customers' && P[2] === 'new') prefillFromLead(q);
  const st = api && api.getState();
  if (st && st.session && st.session.viewOrg) { try { localStorage.setItem(VIEW_KEY, st.session.viewOrg); } catch (e) { /* ignore */ } }
};
L.attach = (a) => { api = a; };
L.busy = () => syncing || !!timer || pendingWrites > 0;
L.footHtml = () => 'Signed in as ' + esc(me().name || '') + '.<br><button class="btn btn-ghost btn-sm" type="button" data-live="refresh" style="color:var(--silver-2)">Reload</button> <button class="btn btn-ghost btn-sm" type="button" data-live="signout" style="color:var(--silver-2)">Sign out</button>';
