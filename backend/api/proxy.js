const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const url = req.query.url;
    if (!url) {
        res.status(400).send('URL parameter is required');
        return;
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });
        const text = await response.text();
        res.setHeader('Content-Type', 'text/xml');
        res.send(text);
    } catch (error) {
        res.status(500).send(`Error fetching the URL: ${error.message}`);
    }
};