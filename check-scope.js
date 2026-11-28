// node check-scope.js <adminUser> <adminPass> [<normalUser> <normalPass>]
//
// Phase 2A check - READ-ONLY (login + GET mattum, DB-la ethuvum ezhudhaadhu).
// Backend run aagitu irukkanum (node server.js), vera terminal-la idha run pannu.
// Normal user kudutha, avanga Main Store-la irukkaangala nu kooda check pannum.
const BASE = process.env.BASE || "http://localhost:5000";   // port vera na maathu
const [aU, aP, uU, uP] = process.argv.slice(2);
const FAKE = "64b000000000000000000000";                    // illaadha store id

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
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (storeId) headers["X-Store-Id"] = storeId;
  const r = await fetch(`${BASE}/api/${path}`, { headers });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};

(async () => {
  if (!aU || !aP) {
    console.log("Usage: node check-scope.js <adminUser> <adminPass> [<normalUser> <normalPass>]");
    process.exit(1);
  }
  const admin = await login(aU, aP);

  console.log("\n--- Token illaama ---");
  check((await get(null, "stores/mine")).s === 401, "no token -> 401");

  console.log("\n--- Admin ---");
  const list = await get(admin, "stores");
  check(list.s === 200 && Array.isArray(list.j), "GET /stores -> 200");
  const main = (list.j || []).find((s) => s.isDefault);
  check(!!main, `Main Store irukku (${main ? main.name + ", code " + main.code : "illa - seedStores.js --apply run pannu"})`);

  let r = await get(admin, "stores/mine");
  check(r.s === 200 && r.j.all === true && r.j.store === null, "no header -> ALL stores");
  if (main) {
    r = await get(admin, "stores/mine", String(main._id));
    check(r.s === 200 && r.j.isMain === true && r.j.all === false, "header = Main Store -> isMain");
  }
  check((await get(admin, "stores/mine", FAKE)).s === 404, "unknown store id -> 404");
  check((await get(admin, "stores/mine", "garbage")).s === 400, "bad store id -> 400");

  if (uU && uP) {
    console.log("\n--- Normal user ---");
    const user = await login(uU, uP);
    r = await get(user, "stores/mine");
    check(r.s === 200 && r.j.all === false, "/stores/mine -> 200, all=false");
    console.log("   ", r.j && r.j.store ? `store: ${r.j.store.name} (${r.j.store.code}), isMain=${r.j.isMain}` : r.j);
    check(r.j.isMain === true, "pazhaya user -> Main Store (ippo ellaarum Main Store dhaan)");
    check((await get(user, "stores/mine", FAKE)).s === 200, "user X-Store-Id header anuppinaalum ignore aagudhu (store maatha mudiyaadhu)");
    check((await get(user, "stores")).s === 403, "user GET /stores -> 403 (admin only)");
  }

  console.log(fails ? `\n❌ ${fails} failed` : "\n🎉 All checks passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });