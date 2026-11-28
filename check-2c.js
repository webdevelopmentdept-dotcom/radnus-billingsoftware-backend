// node check-2c.js <adminUser> <adminPass> [<normalUser> <normalPass>]
//
// Phase 2C gate - READ-ONLY (login + GET mattum, ethuvum ezhudhaadhu).
// 1) Engineers / Drawers / Sales reps lists: admin ALL == admin+Main == normal user
// 2) Per-job store check: pazhaya jobs (storeId illaadha) normal user-ku THIRAKKANUM (200).
//    Idhu dhaan mukkiyam - ippo ella job-um Main Store, edhuvum 404 aaga koodaadhu.
const BASE = process.env.BASE || "http://localhost:5000";
const [aU, aP, uU, uP] = process.argv.slice(2);

let fails = 0;
const check = (ok, msg) => { console.log(ok ? "✅" : "❌", msg); if (!ok) fails++; };

async function login(u, p) {
  const r = await fetch(`${BASE}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
  const d = await r.json();
  if (!d.token) throw new Error(`Login failed for ${u}: ${d.message}`);
  return d.token;
}
const get = async (token, path, storeId) => {
  const headers = { Authorization: `Bearer ${token}` };
  if (storeId) headers["X-Store-Id"] = storeId;
  const r = await fetch(`${BASE}/api/${path}`, { headers });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const names = (a) => (Array.isArray(a) ? a.map((x) => x.name).sort().join("|") : "");

(async () => {
  if (!aU || !aP) { console.log("Usage: node check-2c.js <adminUser> <adminPass> [<normalUser> <normalPass>]"); process.exit(1); }
  const admin = await login(aU, aP);
  const user = uU && uP ? await login(uU, uP) : null;

  const stores = await get(admin, "stores");
  const main = (stores.j || []).find((s) => s.isDefault);
  if (!main) { console.log("❌ Main Store illa - seedStores.js --apply run pannu"); process.exit(1); }
  const mainId = String(main._id);

  for (const path of ["engineers", "drawers", "salesreps"]) {
    console.log(`\n--- ${path} ---`);
    const all = await get(admin, path);
    const m = await get(admin, path, mainId);
    check(all.s === 200 && m.s === 200, `admin ALL=${all.s}, admin+Main=${m.s}`);
    if (all.s !== 200) continue;
    console.log(`    ${all.j.length} records`);
    check(names(all.j) === names(m.j), "admin ALL == admin + Main header");
    if (user) {
      const u = await get(user, path);
      check(u.s === 200 && names(u.j) === names(all.j), `normal user (${u.s}) == admin ALL`);
    }
  }

  console.log("\n--- per-job open (GET /jobsheets/:id) ---");
  const list = await get(admin, "jobsheets/filter");
  const jobs = Array.isArray(list.j) ? list.j : [];
  const withStore = jobs.filter((j) => j.storeId).length;
  console.log(`    ${jobs.length} jobs total, ${withStore} have storeId (puthu jobs), ${jobs.length - withStore} pazhaya jobs (storeId illa)`);
  // 40 jobs spread across the list (pazhaya + puthu)
  const step = Math.max(1, Math.floor(jobs.length / 40));
  const sample = jobs.filter((_, i) => i % step === 0).slice(0, 40);
  let adminBad = 0, userBad = 0;
  for (const j of sample) {
    if ((await get(admin, `jobsheets/${j._id}`)).s !== 200) adminBad++;
    if (user && (await get(user, `jobsheets/${j._id}`)).s !== 200) userBad++;
  }
  check(adminBad === 0, `admin opened ${sample.length}/${sample.length} sampled jobs`);
  if (user) check(userBad === 0, `normal user opened ${sample.length - userBad}/${sample.length} sampled jobs (pazhaya jobs ellam thirakkanum)`);

  console.log(fails ? `\n❌ ${fails} failed` : "\n🎉 All checks passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });