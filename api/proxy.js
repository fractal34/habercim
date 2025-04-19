// /api/proxy.js

export default async function handler(req, res) {
  const url = req.query.url;

  if (!url) {
    res.status(400).send('URL parameter is required');
    return;
  }

  try {
    const response = await fetch(url);
    const data = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*'); // ya da sadece 'https://habercim.vercel.app'
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.status(200).send(data);
  } catch (error) {
    res.status(500).send(`Error fetching URL: ${error.message}`);
  }
}
