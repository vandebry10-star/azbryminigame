// api/leaderboard.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: "KV not configured" });
  const headers = { Authorization: `Bearer ${token}` };

  // Tambah skor per user
  if (req.method === "POST") {
    try {
      const { name, delta } = req.body || {};
      if (!name) return res.status(400).json({ error: "No name provided" });
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
      const inc = Math.max(1, Math.min(10, Number(delta || 1)));

      // tambah total player & global
      await fetch(`${url}/incrby/azbry:player:${safeName}/${inc}`, { method: "POST", headers });
      const r = await fetch(`${url}/incrby/azbry:total/${inc}`, { method: "POST", headers });
      const jr = await r.json();

      return res.status(200).json({ ok: true, total: Number(jr.result || 0) });
    } catch (err) {
      return res.status(400).json({ error: "Invalid payload" });
    }
  }

  // Ambil 10 besar leaderboard
  if (req.method === "GET") {
    const r = await fetch(`${url}/scan/0?match=azbry:player:*`, { method: "POST", headers });
    const j = await r.json();
    const items = (j.result || []).filter((x, i) => i % 2 === 1)
      .map((v, i) => ({
        name: (j.result[i * 2] || "").split(":").pop(),
        score: Number(v || 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return res.status(200).json({ top: items });
  }

  res.status(405).json({ error: "Method not allowed" });
}
