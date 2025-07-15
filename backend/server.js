const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { status } = require('minecraft-server-util');

const app = express();
app.use(cors());
app.use(express.json());

// Cache structure: Map<serverName, { minefortKey, namedPlayers }>
const server_cache = new Map();

// Get real player list from mcstatus.io

async function getPlayerList(ip) {
  try {
    const res = await status(ip, 25565, { timeout: 2000 });
    // console.log(`Pinged ${ip}: ${res.players.online} online`);
    return res.players.sample || [];
  } catch (err) {
    console.warn(`Failed to ping ${ip}:`, err.message);
    return [];
  }
}

async function getJavaPlayerDetails(uuid) {
  try {
    const res = await fetch(`https://api.mcprofile.io/api/v1/java/uuid/${uuid}`);
    if (!res.ok) throw new Error(`MCProfile returned ${res.status}`);
    const data = await res.json();
    return data.username;
  } catch (err) {
    console.warn(`Failed to resolve UUID "${uuid}":`, err.message);
    return null;
  }
}
async function getBedrockPlayerDetails(fuid) {
  try {
    const res = await fetch(`https://api.mcprofile.io/api/v1/bedrock/fuid/${fuid}`);
    if (!res.ok) throw new Error(`MCProfile returned ${res.status}`);
    const data = await res.json();
    return '.' + data.gamertag;
  } catch (err) {
    console.warn(`Failed to resolve FUID "${fuid}":`, err.message);
    return null;
  }
}

async function getPlayerDetails(player) {
  if (player.uuid.startsWith('00000000-')) {
    return await getBedrockPlayerDetails(player.uuid);
  } else if (player.fuid) {
    return await getJavaPlayerDetails(player.uuid);
  }
  return null;
}

async function repairPlayer(player) {
  if (!player) return null;

  const details = await getPlayerDetails(player);
  if (!details) return player;

  player.name_clean = details;

  return player;
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

    data.result = await Promise.all(
      data.result.map(async (server) => {
        const serverName = server.serverName;
        const playerList = server.players?.list || [];

        // Create a simple hash key of current player list (e.g., length or join(','))
        const minefortKey = JSON.stringify(playerList); // You could make this more compact
        const cached = server_cache.get(serverName);

        let useCache = false;
        if (cached && cached.minefortKey === minefortKey && cached.namedPlayers) {
          useCache = true;
        }

        if (useCache) {
          // Use cached real players
          server.players.list = await Promise.all(server.players.list.map(async player => {
            const cachedPlayer = cached.namedPlayers.find(p => p.uuid === player.uuid);
            if (cachedPlayer) {
              return {
                ...player,
                name_clean: cachedPlayer.name_clean
              };
            } else {
              const repairedPlayer = await repairPlayer(player);
              return repairedPlayer;
            }
          }));
          return server;
        } else if (playerList.length > 0) {
          // Player list changed — fetch new data
          const ip = `${serverName}.minefort.com`;
          const namedPlayers = (await getPlayerList(ip)) || playerList;

          // Save to cache
          server_cache.set(serverName, {
            minefortKey,
            namedPlayers
          });

          // Replace list with detailed info
          server.players.list = await Promise.all(server.players.list.map(async player => {
            const namedPlayer = namedPlayers.find(p => p.uuid === player.uuid);
            if (namedPlayer) {
              return namedPlayer;
            } else {
              const repairedPlayer = await repairPlayer(player);
              return repairedPlayer;
            }
          }));
        }

        return server;
      })
    );

    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);

  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Proxy running on port', port));
