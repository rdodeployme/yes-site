// Yarta security rules: the attack suite.
// Every "BLOCKED" test is an attack that must fail; every "ALLOWED" test is normal use that must work.
// Run with: npm run test:rules   (starts the Firestore and Storage emulators, runs this file, stops them)

import { test, describe, before, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where,
  serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const here = new URL('..', import.meta.url).pathname;
let env;

const PAST = Timestamp.fromDate(new Date(Date.now() - 86400000));
const SOON = Timestamp.fromDate(new Date(Date.now() + 7 * 86400000));
const VALUES = { energy_grid_kwh: 125000, water_kl: 840, waste_landfill_t: 12.4 };

const people = {
  owner:   { uid: 'owner1',  email: 'owner@yarta.test',   role: 'owner',  orgId: null },
  staffA:  { uid: 'staffA',  email: 'morgan@yarta.test',  role: 'staff',  orgId: null },
  staffB:  { uid: 'staffB',  email: 'chris@yarta.test',   role: 'staff',  orgId: null },
  staffX:  { uid: 'staffX',  email: 'left@yarta.test',    role: 'staff',  orgId: null, active: false },
  clientA: { uid: 'clientA', email: 'ava@shire-a.test',   role: 'client', orgId: 'orgA' },
  clientB: { uid: 'clientB', email: 'ben@company-b.test', role: 'client', orgId: 'orgB' },
  clientGone: { uid: 'clientGone', email: 'gone@shire-a.test', role: 'client', orgId: 'orgA', active: false },
};

function as(p, extra = {}) {
  return env.authenticatedContext(p.uid, { email: p.email, email_verified: true, ...extra });
}
const db = (ctx) => ctx.firestore();
const st = (ctx) => ctx.storage();
const anon = () => env.unauthenticatedContext();

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const p of Object.values(people)) {
      await setDoc(doc(d, 'users', p.uid), { email: p.email, name: p.uid, title: '', role: p.role, orgId: p.orgId, active: p.active !== false });
    }
    await setDoc(doc(d, 'orgs/orgA'), { id: 'orgA', profile: { org_name: 'Shire A' }, subscription: { status: 'active', notes: 'internal' } });
    await setDoc(doc(d, 'orgs/orgB'), { id: 'orgB', profile: { org_name: 'Company B' } });
    await setDoc(doc(d, 'orgs/orgA/months/2026-06'), { month: '2026-06', status: 'verified', values: VALUES, evidence: { energy: { name: 'bill.pdf', grade: 'A' } }, enteredByUid: 'staffA', verifiedByUid: 'staffB', verifiedAt: '2026-07-09', verifiedBy: 'staffB', issuedAt: '2026-07-20', issueRev: 1 });
    await setDoc(doc(d, 'orgs/orgA/months/2026-07'), { month: '2026-07', status: 'submitted', values: { ...VALUES, water_kl: 900 }, enteredByUid: 'staffA', notes: [{ text: 'bill looks odd' }] });
    await setDoc(doc(d, 'orgs/orgA/months/2026-08'), { month: '2026-08', status: 'draft', values: {} });
    await setDoc(doc(d, 'orgs/orgB/months/2026-07'), { month: '2026-07', status: 'draft', values: { energy_grid_kwh: 5 } });
    await setDoc(doc(d, 'views/orgA'), { orgId: 'orgA', profile: { org_name: 'Shire A' }, statuses: { '2026-06': 'verified' } });
    await setDoc(doc(d, 'views/orgA/months/2026-06'), { month: '2026-06', status: 'verified', values: VALUES, enteredByUid: 'staffA', verifiedByUid: 'staffB', issuedAt: '2026-07-20', issueRev: 1, hash: 'h-0606-r1' });
    await setDoc(doc(d, 'views/orgA/reports/2026-06-r1'), { month: '2026-06', rev: 1, issuedAt: '2026-07-20', issuedBy: 'staffA', issuedByUid: 'staffA', method: 'v0.1', dictionary: 'v0.1', score: 69, hash: 'h-0606-r1', createdAt: PAST });
    await setDoc(doc(d, 'views/orgB'), { orgId: 'orgB', profile: { org_name: 'Company B' } });
    await setDoc(doc(d, 'orgs/orgA/bookings/bk1'), { id: 'bk1', org: 'orgA', svc: 'audit', status: 'requested', createdByUid: 'clientA' });
    await setDoc(doc(d, 'orgs/orgB/bookings/bk2'), { id: 'bk2', org: 'orgB', svc: 'audit', status: 'requested', createdByUid: 'clientB' });
    await setDoc(doc(d, 'orgs/orgA/inbox/in1'), { id: 'in1', month: '2026-08', name: 'power.pdf' });
    await setDoc(doc(d, 'invites/newclient@shire-a.test'), { email: 'newclient@shire-a.test', name: 'New Client', title: '', role: 'client', orgId: 'orgA', invitedByUid: 'staffA', invitedBy: 'Morgan', invitedAt: PAST, expiresAt: SOON });
    await setDoc(doc(d, 'invites/late@shire-a.test'), { email: 'late@shire-a.test', name: 'Late', title: '', role: 'client', orgId: 'orgA', invitedByUid: 'staffA', invitedBy: 'Morgan', invitedAt: PAST, expiresAt: PAST });
    await setDoc(doc(d, 'invites/newstaff@yarta.test'), { email: 'newstaff@yarta.test', name: 'New Staff', title: '', role: 'staff', orgId: null, invitedByUid: 'owner1', invitedBy: 'Owner', invitedAt: PAST, expiresAt: SOON });
    await setDoc(doc(d, 'providers/p1'), { id: 'p1', name: 'Provider', licence: 'X1' });
    await setDoc(doc(d, 'outbox/m1'), { id: 'm1', to: 'ava@shire-a.test', subject: 'Gap email' });
    await setDoc(doc(d, 'gaplog/g1'), { org: 'orgA', month: '2026-08' });
    await setDoc(doc(d, 'ops/config'), { importMaps: {} });
    await setDoc(doc(d, 'audit/a1'), { id: 'a1', at: '2026-08-01', by: 'Morgan', byUid: 'staffA', role: 'staff', org: 'orgA', action: 'Month opened', detail: '' });
    await setDoc(doc(d, 'leads/l1'), { v: 1, org_name: 'Prospect', email: 'p@x.test', status: 'new' });
  });
}

function lead(over = {}) {
  return {
    v: 1, created: serverTimestamp(), status: 'new', source: 'readiness', org_name: 'Coastal Shire', sector: 'council', state: 'VIC',
    employees: '101-500', residents: '10-50k', sites: '6-20', drivers: ['climate', 'target'], group: '', timeline: '6m',
    records: { electricity: 'monthly', water: 'monthly', waste: 'patchy', fuel: 'no' },
    holder: 'finance', approach: 'spreadsheet', baseline: 'yes', contact_name: 'Jo Smith', contact_role: 'Sustainability lead',
    email: 'jo@coastal.test', phone: '', consent: true, score: 62, band: 'Nearly ready', page: '/readiness/', notes: '', ...over,
  };
}
function booking(id, over = {}) {
  return {
    id, org: 'orgA', svc: 'audit', status: 'requested', slot: null, other: true, mode: 'Online', location: '', contact: 'Ava',
    email: 'ava@shire-a.test', notes: 'Any Tuesday', share: false, why: '', month: '2026-07', group: false,
    createdAt: '2026-08-02T01:00:00Z', createdBy: 'Ava', createdByUid: 'clientA', ...over,
  };
}
function inboxItem(id, over = {}) {
  return {
    id, kind: 'document', month: '2026-08', cat: 'energy', site: '', siteName: '', key: 'inbox/orgA/2026-08/1-0',
    path: 'orgs/orgA/inbox/2026-08/1-0-power.pdf', name: 'power.pdf', size: 20480, type: 'application/pdf',
    at: '2026-08-02T01:00:00Z', by: 'Ava', byUid: 'clientA', ...over,
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-yarta',
    firestore: { rules: readFileSync(here + 'firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync(here + 'storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
beforeEach(seed);
after(async () => { await env.cleanup(); });

// ------------------------------------------------------------------------------------------
describe('Strangers (not signed in)', () => {
  test('BLOCKED: read a customer working file, published report, user, lead or provider', async () => {
    const d = db(anon());
    for (const p of ['orgs/orgA', 'orgs/orgA/months/2026-06', 'views/orgA', 'views/orgA/months/2026-06', 'users/clientA', 'leads/l1', 'providers/p1', 'invites/newclient@shire-a.test']) {
      await assertFails(getDoc(doc(d, p)));
    }
  });
  test('ALLOWED: submit a Readiness Check', async () => {
    await assertSucceeds(setDoc(doc(db(anon()), 'leads/new1'), lead()));
  });
  test('BLOCKED: Readiness Check with extra fields, a forged status, no consent, a bad email or a fake timestamp', async () => {
    const d = db(anon());
    await assertFails(setDoc(doc(d, 'leads/x1'), lead({ admin: true })));
    await assertFails(setDoc(doc(d, 'leads/x2'), lead({ status: 'won' })));
    await assertFails(setDoc(doc(d, 'leads/x3'), lead({ consent: false })));
    await assertFails(setDoc(doc(d, 'leads/x4'), lead({ email: 'not-an-email' })));
    await assertFails(setDoc(doc(d, 'leads/x5'), lead({ created: PAST })));
    await assertFails(setDoc(doc(d, 'leads/x6'), lead({ records: { electricity: 'monthly', payload: 'x' } })));
    await assertFails(setDoc(doc(d, 'leads/x7'), lead({ drivers: ['climate', '<script>'] })));
    await assertFails(setDoc(doc(d, 'leads/x8'), lead({ notes: 'x'.repeat(1001) })));
  });
  test('BLOCKED: read back or change any Readiness Check', async () => {
    const d = db(anon());
    await assertFails(getDoc(doc(d, 'leads/l1')));
    await assertFails(getDocs(collection(d, 'leads')));
    await assertFails(updateDoc(doc(d, 'leads/l1'), { status: 'closed' }));
  });
  test('BLOCKED: any file in storage', async () => {
    const s = st(anon());
    await assertFails(getBytes(ref(s, 'orgs/orgA/inbox/2026-08/power.pdf')));
    await assertFails(uploadBytes(ref(s, 'orgs/orgA/inbox/2026-08/x.pdf'), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
  });
});

// ------------------------------------------------------------------------------------------
describe('A customer (Shire A)', () => {
  test('ALLOWED: read their own published dashboard, months and issued reports', async () => {
    const d = db(as(people.clientA));
    await assertSucceeds(getDoc(doc(d, 'views/orgA')));
    await assertSucceeds(getDoc(doc(d, 'views/orgA/months/2026-06')));
    await assertSucceeds(getDocs(collection(d, 'views/orgA/months')));
    await assertSucceeds(getDoc(doc(d, 'views/orgA/reports/2026-06-r1')));
    await assertSucceeds(getDoc(doc(d, 'users/clientA')));
  });
  test('BLOCKED: read another customer (Company B), by document or by listing', async () => {
    const d = db(as(people.clientA));
    for (const p of ['views/orgB', 'orgs/orgB', 'orgs/orgB/months/2026-07', 'orgs/orgB/bookings/bk2', 'users/clientB']) {
      await assertFails(getDoc(doc(d, p)));
    }
    await assertFails(getDocs(collection(d, 'views')));
    await assertFails(getDocs(collection(d, 'orgs')));
    await assertFails(getDocs(collection(d, 'users')));
    await assertFails(getDocs(collection(d, 'views/orgB/months')));
  });
  test('BLOCKED: see their own drafts, unverified months, analyst notes or account notes', async () => {
    const d = db(as(people.clientA));
    await assertFails(getDoc(doc(d, 'orgs/orgA')));
    await assertFails(getDoc(doc(d, 'orgs/orgA/months/2026-07')));
    await assertFails(getDocs(collection(d, 'orgs/orgA/months')));
  });
  test('BLOCKED: enter or change a figure', async () => {
    const d = db(as(people.clientA));
    await assertFails(updateDoc(doc(d, 'orgs/orgA/months/2026-08'), { values: { energy_grid_kwh: 1 } }));
    await assertFails(setDoc(doc(d, 'orgs/orgA/months/2026-09'), { month: '2026-09', status: 'draft', values: { energy_grid_kwh: 1 } }));
  });
  test('BLOCKED: publish, alter a published month, or touch an issued report', async () => {
    const d = db(as(people.clientA));
    await assertFails(setDoc(doc(d, 'views/orgA/months/2026-07'), { month: '2026-07', status: 'verified', values: VALUES }));
    await assertFails(updateDoc(doc(d, 'views/orgA/months/2026-06'), { 'values.energy_grid_kwh': 1 }));
    await assertFails(updateDoc(doc(d, 'views/orgA'), { 'profile.org_name': 'Hacked' }));
    await assertFails(updateDoc(doc(d, 'views/orgA/reports/2026-06-r1'), { score: 99 }));
    await assertFails(deleteDoc(doc(d, 'views/orgA/reports/2026-06-r1')));
  });
  test('BLOCKED: promote themselves to staff or move to another organisation', async () => {
    const d = db(as(people.clientA));
    await assertFails(updateDoc(doc(d, 'users/clientA'), { role: 'staff' }));
    await assertFails(updateDoc(doc(d, 'users/clientA'), { role: 'owner' }));
    await assertFails(updateDoc(doc(d, 'users/clientA'), { orgId: 'orgB' }));
    await assertFails(updateDoc(doc(d, 'users/clientA'), { active: true, role: 'staff' }));
    await assertFails(setDoc(doc(d, 'users/clientA2'), { email: 'ava@shire-a.test', name: 'Ava', title: '', role: 'staff', orgId: null, active: true, createdAt: serverTimestamp() }));
  });
  test('ALLOWED: change their own name', async () => {
    await assertSucceeds(updateDoc(doc(db(as(people.clientA)), 'users/clientA'), { name: 'Ava Nguyen' }));
  });
  test('BLOCKED: invite people or read other invites', async () => {
    const d = db(as(people.clientA));
    await assertFails(setDoc(doc(d, 'invites/friend@x.test'), { email: 'friend@x.test', name: 'F', title: '', role: 'client', orgId: 'orgA', invitedByUid: 'clientA', invitedBy: 'Ava', invitedAt: serverTimestamp(), expiresAt: SOON }));
    await assertFails(getDoc(doc(d, 'invites/newclient@shire-a.test')));
  });
  test('ALLOWED: send a document for their organisation', async () => {
    await assertSucceeds(setDoc(doc(db(as(people.clientA)), 'orgs/orgA/inbox/in2'), inboxItem('in2')));
  });
  test('BLOCKED: send a document into another organisation, as someone else, or alter one already sent', async () => {
    const d = db(as(people.clientA));
    await assertFails(setDoc(doc(d, 'orgs/orgB/inbox/in3'), inboxItem('in3', { path: 'orgs/orgB/inbox/2026-08/x.pdf' })));
    await assertFails(setDoc(doc(d, 'orgs/orgA/inbox/in4'), inboxItem('in4', { byUid: 'staffA' })));
    await assertFails(setDoc(doc(d, 'orgs/orgA/inbox/in5'), inboxItem('in5', { path: 'orgs/orgB/inbox/2026-08/x.pdf' })));
    await assertFails(updateDoc(doc(d, 'orgs/orgA/inbox/in1'), { name: 'renamed.pdf' }));
    await assertFails(deleteDoc(doc(d, 'orgs/orgA/inbox/in1')));
  });
  test('ALLOWED: request help, then cancel the request', async () => {
    const d = db(as(people.clientA));
    await assertSucceeds(setDoc(doc(d, 'orgs/orgA/bookings/bk9'), booking('bk9')));
    await assertSucceeds(updateDoc(doc(d, 'orgs/orgA/bookings/bk9'), { status: 'cancelled', cancelledAt: 'now', cancelledBy: 'Ava', cancelledByUid: 'clientA' }));
  });
  test('BLOCKED: confirm their own booking, assign a provider, or book for another organisation', async () => {
    const d = db(as(people.clientA));
    await assertFails(setDoc(doc(d, 'orgs/orgA/bookings/bk10'), booking('bk10', { status: 'confirmed' })));
    await assertFails(setDoc(doc(d, 'orgs/orgB/bookings/bk11'), booking('bk11', { org: 'orgB' })));
    await assertFails(updateDoc(doc(d, 'orgs/orgA/bookings/bk1'), { status: 'confirmed' }));
    await assertFails(updateDoc(doc(d, 'orgs/orgA/bookings/bk1'), { provider: 'p1' }));
    await assertFails(updateDoc(doc(d, 'orgs/orgB/bookings/bk2'), { status: 'cancelled', cancelledAt: 'now', cancelledBy: 'Ava', cancelledByUid: 'clientA' }));
  });
  test('ALLOWED: set their own targets and choose roadmap items', async () => {
    const d = db(as(people.clientA));
    await assertSucceeds(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: { target_emissions: 50, target_diversion: 80 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await assertSucceeds(setDoc(doc(d, 'orgs/orgA/settings/plan'), { off: { audit: true }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
  });
  test('ALLOWED: change their own four targets while carrying the agreed ones unchanged', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orgs/orgA/settings/targets'), { values: { target_emissions: 40, target_trees: 3500, target_participants: 5000 }, updatedAt: PAST, updatedBy: 'Morgan', updatedByUid: 'staffA' });
    });
    const d = db(as(people.clientA));
    await assertSucceeds(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: { target_emissions: 50, target_renewable: 90, target_trees: 3500, target_participants: 5000 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
  });
  test('BLOCKED: change, add or drop a land, nature or community target (agreed with Yarta)', async () => {
    const d = db(as(people.clientA));
    await assertFails(setDoc(doc(d, 'orgs/orgB/settings/targets'), { values: { target_trees: 10 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orgs/orgA/settings/targets'), { values: { target_emissions: 40, target_trees: 3500, target_participants: 5000 }, updatedAt: PAST, updatedBy: 'Morgan', updatedByUid: 'staffA' });
    });
    await assertFails(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: { target_emissions: 40, target_trees: 100, target_participants: 5000 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await assertFails(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: { target_emissions: 40, target_trees: 3500, target_participants: 5000, target_rehab_ha: 1 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await assertFails(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: { target_emissions: 40, target_trees: 3500 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'orgs/orgA/settings/targets')); });
    await assertFails(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: { target_emissions: 40, target_native_ha: 2 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
  });
  test('BLOCKED: smuggle other fields in through targets, or write another setting', async () => {
    const d = db(as(people.clientA));
    await assertFails(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: { target_emissions: 50, score: 100 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await assertFails(setDoc(doc(d, 'orgs/orgA/settings/targets'), { values: {}, price: 0, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await assertFails(setDoc(doc(d, 'orgs/orgA/settings/subscription'), { off: {}, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
    await assertFails(setDoc(doc(d, 'orgs/orgB/settings/targets'), { values: { target_emissions: 1 }, updatedAt: serverTimestamp(), updatedBy: 'Ava', updatedByUid: 'clientA' }));
  });
  test('ALLOWED: declare a category "not reported" for an open month', async () => {
    await assertSucceeds(setDoc(doc(db(as(people.clientA)), 'orgs/orgA/declarations/2026-08_nature'), { month: '2026-08', cat: 'nature', by: 'Ava', byUid: 'clientA', role: 'customer', at: 'now', note: 'No land managed' }));
  });
  test('BLOCKED: declare "not reported" on a month already entered or verified (it would change the score)', async () => {
    const d = db(as(people.clientA));
    await assertFails(setDoc(doc(d, 'orgs/orgA/declarations/2026-07_nature'), { month: '2026-07', cat: 'nature', by: 'Ava', byUid: 'clientA', role: 'customer', at: 'now', note: '' }));
    await assertFails(setDoc(doc(d, 'orgs/orgA/declarations/2026-06_waste'), { month: '2026-06', cat: 'waste', by: 'Ava', byUid: 'clientA', role: 'customer', at: 'now', note: '' }));
  });
  test('BLOCKED: read providers, the outbox, gap emails, ops config, the activity log or leads', async () => {
    const d = db(as(people.clientA));
    for (const p of ['providers/p1', 'outbox/m1', 'gaplog/g1', 'ops/config', 'audit/a1', 'leads/l1']) {
      await assertFails(getDoc(doc(d, p)));
    }
  });
  test('ALLOWED: add a line to the activity log for their own organisation; BLOCKED: anything else in it', async () => {
    const d = db(as(people.clientA));
    const line = { id: 'a9', at: 'now', by: 'Ava', byUid: 'clientA', role: 'customer', org: 'orgA', action: 'Documents received', detail: '2 files' };
    await assertSucceeds(setDoc(doc(d, 'audit/a9'), line));
    await assertFails(setDoc(doc(d, 'audit/a10'), { ...line, id: 'a10', org: 'orgB' }));
    await assertFails(setDoc(doc(d, 'audit/a11'), { ...line, id: 'a11', byUid: 'staffA' }));
    await assertFails(updateDoc(doc(d, 'audit/a1'), { detail: 'erased' }));
    await assertFails(deleteDoc(doc(d, 'audit/a1')));
  });
  test('BLOCKED: a deactivated customer reads anything', async () => {
    const d = db(as(people.clientGone));
    await assertFails(getDoc(doc(d, 'views/orgA')));
    await assertFails(getDoc(doc(d, 'views/orgA/months/2026-06')));
  });
  test('BLOCKED: a customer signed in with an unverified email', async () => {
    await assertFails(getDoc(doc(db(as(people.clientA, { email_verified: false })), 'views/orgA')));
  });
});

// ------------------------------------------------------------------------------------------
describe('Accepting an invite', () => {
  const newClient = { uid: 'newC', email: 'newclient@shire-a.test' };
  const userDoc = (over = {}) => ({ email: 'newclient@shire-a.test', name: 'New Client', title: 'Sustainability lead', role: 'client', orgId: 'orgA', active: true, createdAt: serverTimestamp(), ...over });

  test('ALLOWED: the invited person creates their account with the role and organisation on the invite', async () => {
    const d = db(as(newClient));
    await assertSucceeds(getDoc(doc(d, 'invites/newclient@shire-a.test')));
    await assertSucceeds(setDoc(doc(d, 'users/newC'), userDoc()));
    await assertSucceeds(getDoc(doc(d, 'views/orgA')));
  });
  test('BLOCKED: accept an invite as staff, or into another organisation', async () => {
    const d = db(as(newClient));
    await assertFails(setDoc(doc(d, 'users/newC'), userDoc({ role: 'staff', orgId: null })));
    await assertFails(setDoc(doc(d, 'users/newC'), userDoc({ role: 'owner', orgId: null })));
    await assertFails(setDoc(doc(d, 'users/newC'), userDoc({ orgId: 'orgB' })));
  });
  test('BLOCKED: accept with an unverified email, without an invite, after it expired, or for someone else\'s account', async () => {
    await assertFails(setDoc(doc(db(as(newClient, { email_verified: false })), 'users/newC'), userDoc()));
    await assertFails(setDoc(doc(db(as({ uid: 'rando', email: 'rando@x.test' })), 'users/rando'), userDoc({ email: 'rando@x.test' })));
    await assertFails(setDoc(doc(db(as({ uid: 'late', email: 'late@shire-a.test' })), 'users/late'), userDoc({ email: 'late@shire-a.test' })));
    await assertFails(setDoc(doc(db(as(newClient)), 'users/someoneElse'), userDoc()));
  });
  test('BLOCKED: re-accept after being deactivated', async () => {
    await assertFails(setDoc(doc(db(as(people.clientGone)), 'users/clientGone'), userDoc({ email: 'gone@shire-a.test' })));
  });
});

// ------------------------------------------------------------------------------------------
describe('Yarta staff', () => {
  test('ALLOWED: set the agreed land, nature and community targets', async () => {
    await assertSucceeds(setDoc(doc(db(as(people.staffA)), 'orgs/orgA/settings/targets'), { values: { target_emissions: 40, target_trees: 3000, target_rehab_ha: 12, target_native_ha: 16, target_participants: 5000 }, updatedAt: serverTimestamp(), updatedBy: 'Morgan', updatedByUid: 'staffA' }));
  });
  test('ALLOWED: read every customer, every month, providers, leads and the activity log', async () => {
    const d = db(as(people.staffA));
    for (const p of ['orgs/orgA', 'orgs/orgB', 'orgs/orgA/months/2026-07', 'providers/p1', 'leads/l1', 'audit/a1', 'outbox/m1', 'invites/newclient@shire-a.test']) {
      await assertSucceeds(getDoc(doc(d, p)));
    }
    await assertSucceeds(getDocs(collection(d, 'orgs')));
  });
  test('BLOCKED: verify a month you entered yourself (four eyes)', async () => {
    await assertFails(updateDoc(doc(db(as(people.staffA)), 'orgs/orgA/months/2026-07'), { status: 'verified', verifiedByUid: 'staffA', verifiedAt: '2026-08-09', verifiedBy: 'Morgan' }));
  });
  test('ALLOWED: a second analyst verifies the month', async () => {
    await assertSucceeds(updateDoc(doc(db(as(people.staffB)), 'orgs/orgA/months/2026-07'), { status: 'verified', verifiedByUid: 'staffB', verifiedAt: '2026-08-09', verifiedBy: 'Chris' }));
  });
  test('BLOCKED: verify in someone else\'s name, or rewrite who entered it while verifying', async () => {
    await assertFails(updateDoc(doc(db(as(people.staffB)), 'orgs/orgA/months/2026-07'), { status: 'verified', verifiedByUid: 'owner1' }));
    await assertFails(updateDoc(doc(db(as(people.staffA)), 'orgs/orgA/months/2026-07'), { status: 'verified', verifiedByUid: 'staffA', enteredByUid: 'staffB' }));
  });
  test('BLOCKED: submit a month recorded as entered by someone else', async () => {
    await assertFails(updateDoc(doc(db(as(people.staffA)), 'orgs/orgA/months/2026-08'), { status: 'submitted', enteredByUid: 'staffB' }));
    await assertSucceeds(updateDoc(doc(db(as(people.staffA)), 'orgs/orgA/months/2026-08'), { status: 'submitted', enteredByUid: 'staffA' }));
  });
  test('BLOCKED: create a month that is already "verified" (skipping entry and verification)', async () => {
    await assertFails(setDoc(doc(db(as(people.owner)), 'orgs/orgA/months/2026-09'), { month: '2026-09', status: 'verified', values: VALUES, enteredByUid: 'staffA', verifiedByUid: 'staffB' }));
  });
  test('BLOCKED: change the figures or evidence of a verified month in place, even as owner', async () => {
    await assertFails(updateDoc(doc(db(as(people.staffA)), 'orgs/orgA/months/2026-06'), { 'values.water_kl': 1 }));
    await assertFails(updateDoc(doc(db(as(people.owner)), 'orgs/orgA/months/2026-06'), { 'evidence.energy.grade': 'C' }));
  });
  test('ALLOWED: reopen a verified month for correction (it then needs verifying again)', async () => {
    await assertSucceeds(updateDoc(doc(db(as(people.staffA)), 'orgs/orgA/months/2026-06'), { status: 'returned' }));
  });
  test('ALLOWED: publish a verified month exactly as verified', async () => {
    const d = db(as(people.staffA));
    await assertSucceeds(setDoc(doc(d, 'views/orgA/months/2026-06'), { month: '2026-06', status: 'verified', values: VALUES, enteredByUid: 'staffA', verifiedByUid: 'staffB', issuedAt: '2026-07-20', issueRev: 2, hash: 'h-0606-r2' }));
  });
  test('BLOCKED: publish figures that differ from the verified month, or publish an unverified month', async () => {
    const d = db(as(people.staffA));
    await assertFails(setDoc(doc(d, 'views/orgA/months/2026-06'), { month: '2026-06', status: 'verified', values: { ...VALUES, water_kl: 1 }, enteredByUid: 'staffA', verifiedByUid: 'staffB', issuedAt: '2026-07-20', issueRev: 2, hash: 'x' }));
    await assertFails(setDoc(doc(d, 'views/orgA/months/2026-07'), { month: '2026-07', status: 'verified', values: { ...VALUES, water_kl: 900 }, enteredByUid: 'staffA', verifiedByUid: 'staffB', issuedAt: '2026-08-20', issueRev: 1, hash: 'x' }));
  });
  test('ALLOWED: issue a report snapshot that matches the published month', async () => {
    const d = db(as(people.staffA));
    const b = writeBatch(d);
    b.set(doc(d, 'views/orgA/months/2026-06'), { month: '2026-06', status: 'verified', values: VALUES, enteredByUid: 'staffA', verifiedByUid: 'staffB', issuedAt: '2026-07-21', issueRev: 2, hash: 'h-0606-r2' });
    b.set(doc(d, 'views/orgA/reports/2026-06-r2'), { month: '2026-06', rev: 2, issuedAt: '2026-07-21', issuedBy: 'Morgan', issuedByUid: 'staffA', method: 'v0.1', dictionary: 'v0.1', score: 69, hash: 'h-0606-r2', createdAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
  test('BLOCKED: change or delete an issued report, even as owner', async () => {
    await assertFails(updateDoc(doc(db(as(people.owner)), 'views/orgA/reports/2026-06-r1'), { score: 90 }));
    await assertFails(deleteDoc(doc(db(as(people.owner)), 'views/orgA/reports/2026-06-r1')));
    await assertFails(setDoc(doc(db(as(people.staffA)), 'views/orgA/reports/2026-06-r1'), { month: '2026-06', rev: 1, issuedAt: 'x', issuedBy: 'x', issuedByUid: 'staffA', method: 'v', dictionary: 'v', score: 99, hash: 'h-0606-r1', createdAt: serverTimestamp() }));
  });
  test('BLOCKED: issue a report snapshot that does not match what is published', async () => {
    await assertFails(setDoc(doc(db(as(people.staffA)), 'views/orgA/reports/2026-06-r7'), { month: '2026-06', rev: 7, issuedAt: 'x', issuedBy: 'x', issuedByUid: 'staffA', method: 'v', dictionary: 'v', score: 99, hash: 'not-it', createdAt: serverTimestamp() }));
  });
  test('ALLOWED: invite a customer contact to their organisation', async () => {
    await assertSucceeds(setDoc(doc(db(as(people.staffA)), 'invites/fin@shire-a.test'), { email: 'fin@shire-a.test', name: 'Finance', title: 'Finance officer', role: 'client', orgId: 'orgA', invitedByUid: 'staffA', invitedBy: 'Morgan', invitedAt: serverTimestamp(), expiresAt: SOON }));
  });
  test('BLOCKED: staff invite more staff or an owner; invite into an organisation that does not exist; invite with a long expiry', async () => {
    const d = db(as(people.staffA));
    await assertFails(setDoc(doc(d, 'invites/mate@yarta.test'), { email: 'mate@yarta.test', name: 'Mate', title: '', role: 'staff', orgId: null, invitedByUid: 'staffA', invitedBy: 'Morgan', invitedAt: serverTimestamp(), expiresAt: SOON }));
    await assertFails(setDoc(doc(d, 'invites/boss@yarta.test'), { email: 'boss@yarta.test', name: 'Boss', title: '', role: 'owner', orgId: null, invitedByUid: 'staffA', invitedBy: 'Morgan', invitedAt: serverTimestamp(), expiresAt: SOON }));
    await assertFails(setDoc(doc(d, 'invites/x@nowhere.test'), { email: 'x@nowhere.test', name: 'X', title: '', role: 'client', orgId: 'orgZ', invitedByUid: 'staffA', invitedBy: 'Morgan', invitedAt: serverTimestamp(), expiresAt: SOON }));
    await assertFails(setDoc(doc(d, 'invites/y@shire-a.test'), { email: 'y@shire-a.test', name: 'Y', title: '', role: 'client', orgId: 'orgA', invitedByUid: 'staffA', invitedBy: 'Morgan', invitedAt: serverTimestamp(), expiresAt: Timestamp.fromDate(new Date(Date.now() + 90 * 86400000)) }));
    await assertFails(updateDoc(doc(d, 'invites/newstaff@yarta.test'), { role: 'client', orgId: 'orgA' }));
  });
  test('ALLOWED: the owner invites staff', async () => {
    await assertSucceeds(setDoc(doc(db(as(people.owner)), 'invites/mate@yarta.test'), { email: 'mate@yarta.test', name: 'Mate', title: 'Analyst', role: 'staff', orgId: null, invitedByUid: 'owner1', invitedBy: 'Owner', invitedAt: serverTimestamp(), expiresAt: SOON }));
  });
  test('ALLOWED: staff deactivate a customer login; BLOCKED: staff promote anyone or change their own role', async () => {
    const d = db(as(people.staffA));
    await assertSucceeds(updateDoc(doc(d, 'users/clientA'), { active: false }));
    await assertFails(updateDoc(doc(d, 'users/clientB'), { role: 'staff', orgId: null }));
    await assertFails(updateDoc(doc(d, 'users/staffA'), { role: 'owner' }));
    await assertFails(updateDoc(doc(d, 'users/staffB'), { active: false }));
  });
  test('ALLOWED: the owner deactivates staff', async () => {
    await assertSucceeds(updateDoc(doc(db(as(people.owner)), 'users/staffB'), { active: false }));
  });
  test('BLOCKED: anyone edits or deletes the activity log', async () => {
    await assertFails(updateDoc(doc(db(as(people.owner)), 'audit/a1'), { detail: 'x' }));
    await assertFails(deleteDoc(doc(db(as(people.owner)), 'audit/a1')));
  });
  test('BLOCKED: a deactivated staff member reads anything', async () => {
    const d = db(as(people.staffX));
    await assertFails(getDoc(doc(d, 'orgs/orgA')));
    await assertFails(getDoc(doc(d, 'leads/l1')));
  });
});

// ------------------------------------------------------------------------------------------
describe('Files', () => {
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
  async function seedFiles() {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const s = ctx.storage();
      await uploadBytes(ref(s, 'orgs/orgA/inbox/2026-08/power.pdf'), pdf, { contentType: 'application/pdf' });
      await uploadBytes(ref(s, 'orgs/orgA/evidence/2026-07/energy'), pdf, { contentType: 'application/pdf' });
      await uploadBytes(ref(s, 'orgs/orgA/reports/2026-06-r1.pdf'), pdf, { contentType: 'application/pdf' });
      await uploadBytes(ref(s, 'orgs/orgB/reports/2026-06-r1.pdf'), pdf, { contentType: 'application/pdf' });
    });
  }
  test('ALLOWED: a customer uploads a PDF to their own inbox and reads their own issued report file', async () => {
    await seedFiles();
    const s = st(as(people.clientA));
    await assertSucceeds(uploadBytes(ref(s, 'orgs/orgA/inbox/2026-08/water.pdf'), pdf, { contentType: 'application/pdf' }));
    await assertSucceeds(getBytes(ref(s, 'orgs/orgA/reports/2026-06-r1.pdf')));
    await assertSucceeds(getBytes(ref(s, 'orgs/orgA/inbox/2026-08/power.pdf')));
  });
  test('BLOCKED: a customer uploads into another organisation, uploads HTML or SVG, oversized files, or overwrites a sent file', async () => {
    await seedFiles();
    const s = st(as(people.clientA));
    await assertFails(uploadBytes(ref(s, 'orgs/orgB/inbox/2026-08/x.pdf'), pdf, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(s, 'orgs/orgA/inbox/2026-08/page.html'), pdf, { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(s, 'orgs/orgA/inbox/2026-08/logo.svg'), pdf, { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(s, 'orgs/orgA/inbox/2026-08/big.pdf'), new Uint8Array(15 * 1024 * 1024 + 1), { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(s, 'orgs/orgA/inbox/2026-08/power.pdf'), pdf, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(s, 'orgs/orgA/inbox/not-a-month/x.pdf'), pdf, { contentType: 'application/pdf' }));
  });
  test('BLOCKED: a customer reads evidence files or another organisation\'s reports, or deletes anything', async () => {
    await seedFiles();
    const s = st(as(people.clientA));
    await assertFails(getBytes(ref(s, 'orgs/orgA/evidence/2026-07/energy')));
    await assertFails(getBytes(ref(s, 'orgs/orgB/reports/2026-06-r1.pdf')));
    await assertFails(deleteObject(ref(s, 'orgs/orgA/inbox/2026-08/power.pdf')));
    await assertFails(uploadBytes(ref(s, 'orgs/orgA/reports/fake.pdf'), pdf, { contentType: 'application/pdf' }));
  });
  test('ALLOWED: staff read evidence and attach new evidence; BLOCKED: anyone replaces an issued report file', async () => {
    await seedFiles();
    const s = st(as(people.staffA));
    await assertSucceeds(getBytes(ref(s, 'orgs/orgA/evidence/2026-07/energy')));
    await assertSucceeds(uploadBytes(ref(s, 'orgs/orgA/evidence/2026-08/water'), pdf, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(st(as(people.owner)), 'orgs/orgA/reports/2026-06-r1.pdf'), pdf, { contentType: 'application/pdf' }));
  });
});
