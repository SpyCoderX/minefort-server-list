const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Cache structure: Map<serverName, { minefortKey, namedPlayers }>
const server_cache = new Map();

// Get real player list from mcstatus.io
async function getPlayerList(ip) {
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${ip}`);
    const data = await res.json();
    return data.players?.list || [];
  } catch (err) {
    console.error(`Failed to fetch status for ${ip}:`, err.message);
    return [];
  }
}

app.post('/api/servers', async (req, res) => {
  try {
    const response = await fetch('https://api.minefort.com/v1/servers/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    const enrichedServers = await Promise.all(
      data.map(async (server) => {
        const serverName = server.serverName;
        const playerList = server.players?.list || [];

        // Create a simple hash key of current player list (e.g., length or join(','))
        const minefortKey = JSON.stringify(playerList); // You could make this more compact
        const cached = server_cache.get(serverName);

        let useCache = false;
        if (cached && cached.minefortKey === minefortKey) {
          useCache = true;
        }

        if (useCache) {
          // Use cached real players
          server.players.list = cached.namedPlayers;
        } else if (playerList.length > 0) {
          // Player list changed — fetch new data
          const ip = `${serverName}.minefort.com`;
          const namedPlayers = await getPlayerList(ip);

          // Save to cache
          server_cache.set(serverName, {
            minefortKey,
            namedPlayers
          });

          // Replace list with detailed info
          server.players.list = namedPlayers;
        }

        return server;
      })
    );

    res.set('Access-Control-Allow-Origin', '*');
    res.json({ servers: enrichedServers });

  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Proxy running on port', port));
