// node check-reads.js <adminUser> <adminPass> [<normalUser> <normalPass>]
//
// Phase 2B gate - READ-ONLY (login + GET mattum, ethuvum ezhudhaadhu).
// Ippo ella data-vum Main Store dhaan. So:
//     admin (ALL stores)  ==  admin + Main Store header  ==  normal user
// Moonu-layum SAME numbers/data varanum. Edhaavadhu vithiyaasam na scope-la thappu.
// Backend run aagitu irukkanum (node server.js). Vera terminal-la idha run pannu.
const BASE = process.env.BASE || "http://localhost:5000";
const [aU, aP, uU, uP] = process.argv.slice(2);

let fails = 0;
const check = (ok, msg) => { console.log(ok ? "✅" : "❌", msg); if (!ok) fails++; };

async function login(u, p) {
  const r = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  });
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

const total = (g) => Object.values(g || {}).flat().length;
const ids = (a) => (Array.isArray(a) ? a.map((x) => x.jobSheetNo || x._id).sort().join("|") : "");
const sig = {
  "jobsheets/filter":            (j) => `${j.length} jobs | ${ids(j).length}`,
  "dashboard/stats":             (j) => JSON.stringify(j),
  "jobsheets/workload":          (j) => JSON.stringify([...j].sort((a, b) => a.name.localeCompare(b.name))),
  "jobsheets/stale?days=3":      (j) => `${j.length} | ${ids(j).length}`,
  "jobsheets/salesrep-report":   (j) => `${total(j)} jobs`,
  "jobsheets/user-report":       (j) => `${total(j)} jobs`,
  "jobsheets/customers/search?q=a": (j) => JSON.stringify(j.map((c) => c.name)),
};
const show = {
  "jobsheets/filter": (j) => `${j.length} jobs`,
  "dashboard/stats": (j) => `total ${j.totalJobs}, pending ${j.pendingJobs}, completed ${j.completedJobs}`,
};

(async () => {
  if (!aU || !aP) { console.log("Usage: node check-reads.js <adminUser> <adminPass> [<normalUser> <normalPass>]"); process.exit(1); }
  const admin = await login(aU, aP);
  const user = uU && uP ? await login(uU, uP) : null;

  const mine = await get(admin, "stores");
  const main = (mine.j || []).find((s) => s.isDefault);
  if (!main) { console.log("❌ Main Store illa - seedStores.js --apply run pannu"); process.exit(1); }
  const mainId = String(main._id);

  for (const [path, f] of Object.entries(sig)) {
    console.log(`\n--- ${path} ---`);
    const all = await get(admin, path);
    const m = await get(admin, path, mainId);
    check(all.s === 200 && m.s === 200, `admin ALL=${all.s}, admin+Main=${m.s}`);
    if (all.s !== 200 || m.s !== 200) continue;
    if (show[path]) console.log("    admin ALL :", show[path](all.j));
    check(f(all.j) === f(m.j), "admin ALL == admin + Main header");
    if (user) {
      const u = await get(user, path);
      check(u.s === 200, `normal user = ${u.s}`);
      if (u.s === 200) check(f(all.j) === f(u.j), "admin ALL == normal user");
    }
  }

  console.log(fails ? `\n❌ ${fails} failed` : "\n🎉 All checks passed - Main Store scope = pazhaya data");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });