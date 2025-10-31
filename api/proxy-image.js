// /api/proxy-image.js
export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      res.status(400).send('Missing url');
      return;
    }

    // Ambil gambar dari sumber asli
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(502).send(`Upstream error: ${upstream.status}`);
      return;
    }

    // Deteksi content-type, default ke image/jpeg
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());

    // Header: non-cache + type yang benar
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', ct);
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).send('Proxy error: ' + e.message);
  }
}
