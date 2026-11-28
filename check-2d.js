// node check-2d.js <adminUser> <adminPass> [<normalUser> <normalPass> [<engineerUser> <engineerPass>]]
//
// Phase 2D gate - READ-ONLY (login + GET, ... 403 check-ku empty POST mattum; ethuvum create/delete aagaadhu).
// 1) Users list: admin ALL == admin + Main header (ippo ellaarum Main Store)
// 2) Normal user: /users GET + POST -> 403 (admin / store manager mattum)
// 3) Engineer (kudutha): dashboard-ku venum routes ellam innum velai seiyudhaa
const BASE = process.env.BASE || "http://localhost:5000";
const [aU, aP, uU, uP, eU, eP] = process.argv.slice(2);

let fails = 0;
const check = (ok, msg) => { console.log(ok ? "✅" : "❌", msg); if (!ok) fails++; };

async function login(u, p) {
  const r = await fetch(`${BASE}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
  const d = await r.json();
  if (!d.token) throw new Error(`Login failed for ${u}: ${d.message}`);
  return d.token;
}
const call = async (token, method, path, storeId, body) => {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-Store-Id"] = storeId;
  const r = await fetch(`${BASE}/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const names = (a) => (Array.isArray(a) ? a.map((x) => x.username).sort().join("|") : "");

(async () => {
  if (!aU || !aP) { console.log("Usage: node check-2d.js <adminUser> <adminPass> [<normalUser> <normalPass> [<engineerUser> <engineerPass>]]"); process.exit(1); }
  const admin = await login(aU, aP);

  const stores = await call(admin, "GET", "stores");
  const main = (stores.j || []).find((s) => s.isDefault);
  if (!main) { console.log("❌ Main Store illa - seedStores.js --apply run pannu"); process.exit(1); }
  const mainId = String(main._id);

  console.log("\n--- Users list (admin) ---");
  const all = await call(admin, "GET", "users");
  const m = await call(admin, "GET", "users", mainId);
  check(all.s === 200 && m.s === 200, `admin ALL=${all.s}, admin+Main=${m.s}`);
  if (all.s === 200) {
    console.log(`    ${all.j.length} accounts`);
    check(names(all.j) === names(m.j), "admin ALL == admin + Main header (ellaarum Main Store)");
    check(all.j.every((u) => !("password" in u)), "password field list-la varala");
  }

  if (uU && uP) {
    console.log("\n--- Normal user ---");
    const user = await login(uU, uP);
    check((await call(user, "GET", "users")).s === 403, "GET /users -> 403");
    check((await call(user, "POST", "users", null, {})).s === 403, "POST /users -> 403");
    check((await call(user, "DELETE", `users/${"0".repeat(24)}`)).s === 403, "DELETE /users/:id -> 403");
  }

  if (eU && eP) {
    console.log("\n--- Engineer (dashboard routes innum velai seiyanum) ---");
    const eng = await login(eU, eP);
    check((await call(eng, "GET", "engineers")).s === 200, "GET /engineers -> 200");
    const f = await call(eng, "GET", `jobsheets/filter?engineer=${encodeURIComponent(eU)}`);
    check(f.s === 200, `GET /jobsheets/filter?engineer=... -> ${f.s}`);
    const first = Array.isArray(f.j) && f.j[0];
    if (first) check((await call(eng, "GET", `jobsheets/${first._id}`)).s === 200, "GET /jobsheets/:id -> 200");
    check((await call(eng, "GET", "jobsheets/workload")).s === 200, "GET /jobsheets/workload -> 200");
    check((await call(eng, "GET", "users")).s === 403, "engineer GET /users -> 403");
  }

  console.log(fails ? `\n❌ ${fails} failed` : "\n🎉 All checks passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });