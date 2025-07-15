const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

async function getPlayerList(ip) {
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${ip}`);
    const data = await res.json();

    return data.players?.list || []; // return an array of player objects
  } catch (err) {
    console.error(`Failed to fetch status for ${ip}:`, err.message);
    return [];
  }
}

const server_cache = new Map();

app.post('/api/servers', async (req, res) => {
  try {
    const response = await fetch('https://api.minefort.com/v1/servers/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    // Get server IPs from Minefort response
    enrichedServers = await Promise.all(
      data.servers.map(async (server) => {
        if (server.players.online > 0 || (server_cache.has(server.serverName) && server_cache.get(server.serverName) === server.players.list)) {
          // Fallback to server.address if domain is unavailable
          const ip = server.serverName + ".minefort.com";

          const players = await getPlayerList(ip);
          server_cache.set(server.serverName, server.players.list); //We use the server's list of players as the cache key because it means we don't have to fetch the player list to check if it has changed.
          server.players.list = players; // Update the server's player list with the fetched data
          return server; // Return the server with the player list
        } else {
          return server; // No players online, return server as is
        }
      })
    );

    res.set('Access-Control-Allow-Origin', '*');
    res.json({ servers: enrichedServers });

  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Proxy running on port', port));
