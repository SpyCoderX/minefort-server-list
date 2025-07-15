const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const net = require('net');

const app = express();
app.use(cors());
app.use(express.json());

// Cache structure: Map<serverName, { minefortKey, namedPlayers }>
const uuidNameCache = new Map(); // uuid -> { name, lastSeen }
const fallbackQueue = [];        // [{ uuid, resolve, reject }]

async function refreshServerData() {
  try {
    const res = await fetch('https://api.minefort.com/v1/servers/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ page: 1, limit: 100 })
    });

    const data = await res.json();
    console.log(`Result: ${data.result}`)

    for (const server of data.result) {
      const serverName = server.serverName;
      const ip = `${serverName}.minefort.com`;
      const players = server.players.list || [];
      try {
        const rawPlayers = await getPlayerList(ip);
        for (const player of rawPlayers) {
          uuidNameCache.set(player.id, { name: player.name || null, lastSeen: Date.now() });
          players = players.filter(p => p.id !== player.id); // Remove from rawPlayers if already cached
        }
      } catch (err) {
        console.warn(`Failed to ping ${ip}`);
      }
      players.forEach(player => {
        fallbackQueue.push(player);
      });

    }

  } catch (err) {
    console.error("Failed to refresh server data:", err.message);
  }
}

setInterval(async () => {
  const player = fallbackQueue.shift();
  if (!player) return;

  const uuid = player.id;
  const name = await getPlayerDetails({ uuid });
  if (name) {
    uuidNameCache.set(uuid, { name, lastSeen: Date.now() });
  } else {
    fallbackQueue.push(player); // Requeue if failed
  }
}, 1000); // 1 req/sec = 60/min (rate limit safety)


// Run every 30 seconds
setInterval(refreshServerData, 30_000);

/**
 * Encode an integer as a VarInt (used by Minecraft protocol)
 */
function writeVarInt(value) {
  const buffer = [];
  do {
    let temp = value & 0b01111111;
    value >>>= 7;
    if (value !== 0) temp |= 0b10000000;
    buffer.push(temp);
  } while (value !== 0);
  return Buffer.from(buffer);
}

/**
 * Write a Minecraft string (VarInt length + UTF-8 content)
 */
function writeString(str) {
  const strBuf = Buffer.from(str, 'utf8');
  return Buffer.concat([writeVarInt(strBuf.length), strBuf]);
}

/**
 * Read a VarInt from the socket buffer
 */
function readVarInt(socket) {
  return new Promise((resolve, reject) => {
    let result = 0;
    let shift = 0;
    let count = 0;

    function readByte() {
      socket.once('data', (chunk) => {
        const byte = chunk[0];
        result |= (byte & 0x7F) << shift;

        if ((byte & 0x80) !== 0x80) {
          resolve(result);
        } else {
          shift += 7;
          count++;
          if (count > 5) {
            reject(new Error('VarInt is too big'));
          } else {
            readByte();
          }
        }
      });
    }

    readByte();
  });
}

/**
 * Ping a Minecraft Java Edition server manually
 */
async function pingServer(ip, port = 25565, timeout = 2000, hostname = null) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseData = Buffer.alloc(0);

    client.setTimeout(timeout);
    client.connect(port, ip, () => {
      // ---- Handshake Packet ----
      const protocolVersion = 764; // 1.20.4
      const state = 1; // status
      const serverAddress = hostname || ip;

      const handshake = Buffer.concat([
        writeVarInt(0x00),                          // Packet ID for handshake
        writeVarInt(protocolVersion),
        writeString(serverAddress),
        Buffer.from([(port >> 8) & 0xff, port & 0xff]), // Port (2 bytes)
        writeVarInt(state)
      ]);

      const handshakePacket = Buffer.concat([
        writeVarInt(handshake.length),
        handshake
      ]);

      client.write(handshakePacket);

      // ---- Status Request ----
      const request = writeVarInt(0x00);
      const requestPacket = Buffer.concat([
        writeVarInt(request.length),
        request
      ]);

      client.write(requestPacket);
    });

    client.on('data', async (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);

      try {
        // Read packet length
        const length = await readVarInt(client);
        const packetId = await readVarInt(client);
        const jsonLength = await readVarInt(client);

        if (responseData.length >= jsonLength) {
          const jsonPart = responseData.slice(-jsonLength).toString('utf8');
          const status = JSON.parse(jsonPart);
          client.destroy();
          resolve(status);
        }
      } catch (err) {
        client.destroy();
        reject(err);
      }
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Connection timed out'));
    });

    client.on('error', (err) => {
      client.destroy();
      reject(err);
    });
  });
}

async function getPlayerList(ip) {
  // Use the ping_server function logic from Python to fetch player list
  try {
    const result = await pingServer(ip);
    if (!result || !result.players || !result.players.sample) {
      throw new Error('Invalid server response');
    }
    return result.players.sample || [];
  } catch (err) {
    console.error(`Failed to get player list for ${ip}:`, err);
    return [];
  }
}

async function getJavaPlayerDetails(uuid) {
  try {
    const res = await fetch(`https://mcprofile.io/api/v1/java/uuid/${uuid}`);
    if (!res.ok){
      if (res.status !== 400) {
        throw new Error(`MCProfile returned ${res.status}`);
      }
      // If 400, it means UUID not found, return null
      return null;
    }
    const data = await res.json();
    return data.username;
  } catch (err) {

    console.warn(`Failed to resolve UUID "${uuid}":`, err.message);
    return null;
  }
}
async function getBedrockPlayerDetails(fuid) {
  try {
    const res = await fetch(`https://mcprofile.io/api/v1/bedrock/fuid/${fuid}`);
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
  } else {
    return await getJavaPlayerDetails(player.uuid);
  }
}

async function repairPlayer(player) {
  if (!player) return null;

  const details = await getPlayerDetails(player);
  if (!details) return player;

  player.name = details;
  player.state = "repaired";

  return player;
}

app.post('/api/servers', async (req, res) => {
  try {
    const response = await fetch('https://api.minefort.com/v1/servers/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    data.result = data.result.map((server) => {
      server.players.list = server.players.list.map((player) => {
        const cached = uuidNameCache.get(player.id);
        if (cached) {
          return { ...player, name: cached.name, state: 'cache' };
        }
        fallbackQueue.push(player); // Push to deferred queue
        return { ...player, name: null, state: 'queued' };
      });
      return server;
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Proxy running on port', port));
