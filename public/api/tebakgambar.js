export default async function handler(req, res) {
  const key = process.env.BTC_API_KEY; // diambil dari env Vercel
  const upstream = `https://api.botcahx.eu.org/api/game/tebakgambar?apikey=${encodeURIComponent(key)}`;
  try {
    const r = await fetch(upstream);
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store');
    res.status(r.ok ? 200 : 500).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
