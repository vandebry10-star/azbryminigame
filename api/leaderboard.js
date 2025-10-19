// api/leaderboard.js
export default async function handler(req, res) {
  // CORS (biar bisa diakses langsung dari browser)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const headers = { Authorization: `Bearer ${token}` };

  if (!url || !token)
    return res.status(500).json({ error: "KV not configured" });

  // GET = ambil total klik global
  if (req.method === "GET") {
    const r = await fetch(`${url}/get/azbry:total`, {
      method: "POST",
      headers,
    });
    const data = await r.json();
    return res.status(200).json({ total: Number(data.result || 0) });
  }

  // POST = tambah klik
  if (req.method === "POST") {
    let { delta } = req.body || {};
    delta = Math.max(1, Math.min(10, Number(delta || 1)));
    const r = await fetch(`${url}/incrby/azbry:total/${delta}`, {
      method: "POST",
      headers,
    });
    const data = await r.json();
    return res.status(200).json({ ok: true, total: Number(data.result || 0) });
  }

  res.status(405).json({ error: "Method not allowed" });
}
