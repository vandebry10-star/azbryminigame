export default async function handler(req, res) {
  try {
    // Ambil API key dari Environment Variable di Vercel
    const key = process.env.BTC_API_KEY || 'bijikepala67';
    const upstream = `https://api.botcahx.eu.org/api/game/tebakgambar?apikey=${encodeURIComponent(key)}`;

    const r = await fetch(upstream);
    if (!r.ok) throw new Error(`Upstream error: ${r.status} ${r.statusText}`);

    // Ambil data JSON dan kirim ke client
    const data = await r.json();

    // Set header biar tidak di-cache
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (err) {
    console.error('TebakGambar API Error:', err);
    res.status(500).json({
      error: 'Gagal mengambil data dari API BotCahx',
      message: err.message,
    });
  }
}
