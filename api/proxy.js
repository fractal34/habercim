const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const url = req.query.url;
  if (!url) {
    res.status(400).send('URL parameter is required');
    return;
  }

  try {
    const response = await fetch(url);
    const text = await response.text();

    // CORS başlıklarını ekle
    res.setHeader('Access-Control-Allow-Origin', 'https://habercim.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.status(200).send(text);
  } catch (error) {
    res.status(500).send(`Error fetching URL: ${error.message}`);
  }
};