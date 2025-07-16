const express = require('express');
const fetch = require('node-fetch');
const net = require('net');
const dns = require('dns').promises;

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
  if (req.method === 'OPTIONS') return res.sendStatus(200); // Quick exit for preflight
  next();
});

app.use(express.json());

// Cache structure: Map<serverName, { minefortKey, namedPlayers }>
const uuidNameCache = new Map(); // uuid -> { name, lastSeen }
const fallbackQueue = [];        // [{ uuid, resolve, reject }]

async function refreshServerData() {
  try {
    const res = await fetch('https://api.minefort.com/v1/servers/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ pagination: { skip: 0, limit: 100 }, sort: { field: 'players.online', order: 'desc' } })
    });

    const data = await res.json();
    console.log(`Fetched ${data.result.length} servers from Minefort API`);

    for (const server of data.result) {
      const serverName = server.serverName;
      const ip = `${serverName}.minefort.com`;
      let players = server.players.list || [];
      if (players.length === 0) {
        break; // Once a server with no players is found, all subsequent servers will also have no players due to sorting.
      }
      // console.log(`Processing server ${serverName} (${ip})`);
      try {
        const rawPlayers = await getPlayerList(ip);
        for (const player of rawPlayers) {
          uuidNameCache.set(player.id, { name: player.name || null, lastSeen: Date.now() });
          // console.log(`Cached player ${player.name || player.id} (${player.id}) from ${ip}`);
          players = players.filter(p => p.uuid !== player.id); // Remove from rawPlayers if already cached
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
let rateLimitPauseCompleted = 0;

setInterval(async () => {
  if (Date.now() < rateLimitPauseCompleted) {
    // console.log(`Rate limit pause active until ${new Date(rateLimitPauseCompleted).toUTCString()}`);
    return; // Skip if rate limit pause is active
  }
  const player = fallbackQueue.shift();
  if (!player) return;

  const uuid = player.uuid || player.id;
  const name = await getPlayerDetails(uuid);
  if (name?.error === 'Rate limit exceeded') {
    fallbackQueue.unshift(player); // Requeue if rate limit exceeded
    rateLimitPauseCompleted = Date.now() + 60_000; // Pause for 60 seconds
    console.warn(`Rate limit exceeded for UUID "${uuid}", pausing for 60 seconds`);
    return;
  }
  if (name) {
    uuidNameCache.set(uuid, { name:name.name, lastSeen: Date.now() });
  } else {
    fallbackQueue.push(player); // Requeue if failed
  }
}, 11000); // 1 req/sec = 60/min (rate limit safety)


// Run every 30 seconds
setInterval(refreshServerData, 30_000);
refreshServerData()

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
function readVarIntFromBuffer(buffer, offset = 0) {
  let num = 0;
  let shift = 0;
  let bytesRead = 0;

  while (true) {
    if (offset + bytesRead >= buffer.length) return null;
    const byte = buffer[offset + bytesRead];
    num |= (byte & 0x7F) << shift;
    shift += 7;
    bytesRead++;
    if ((byte & 0x80) === 0) break;
    if (bytesRead > 5) throw new Error('VarInt too big');
  }

  return { value: num, bytes: bytesRead };
}


/**
 * Ping a Minecraft Java Edition server manually
 */
async function dnsLookupWithTimeout(hostname, timeoutMs = 2000) {
  return Promise.race([
    dns.lookup(hostname, { family: 4 }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DNS lookup timed out')), timeoutMs)
    )
  ]);
}

function promiseTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Ping timed out')), ms)
    )
  ]);
}

async function pingServer(ipOrHostname, port = 25565, timeout = 12000) {
  try {
    const { address } = await dnsLookupWithTimeout(ipOrHostname, 2000);
    return await promiseTimeout(internalPing(address, port, timeout, ipOrHostname), timeout);
  } catch (err) {
    throw new Error(`Ping failed for ${ipOrHostname}: ${err.message}`);
  }
}

async function internalPing(ip, port = 25565, timeout = 2000, hostname = null) {
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

    client.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);

      try {
        let offset = 0;
        const lengthInfo = readVarIntFromBuffer(responseData, offset);
        if (!lengthInfo) return;
        offset += lengthInfo.bytes;

        const packetIdInfo = readVarIntFromBuffer(responseData, offset);
        if (!packetIdInfo) return;
        offset += packetIdInfo.bytes;

        const jsonLengthInfo = readVarIntFromBuffer(responseData, offset);
        if (!jsonLengthInfo) return;
        offset += jsonLengthInfo.bytes;

        const totalRequired = offset + jsonLengthInfo.value;
        if (responseData.length < totalRequired) return; // Wait for more data

        const jsonStr = responseData.slice(offset, totalRequired).toString('utf8');
        const status = JSON.parse(jsonStr);
        client.destroy();
        resolve(status);
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
      if (result.version.name.includes("Velocity") || result.version.name.includes("Error")) {
        return [];
      } else {
        throw new Error("Invlaid server response: " + JSON.stringify(result))
      }
    }
    // console.log(`Fetched player list for ${ip}:`, result.players.sample);
    return result.players.sample || [];
  } catch (err) {
    console.error(`Failed to get player list for ${ip}:`, err);
    return [];
  }
}

async function getJavaPlayerDetails(uuid) {
  try {
    const res = await fetch(`https://mcprofile.io/api/v1/java/uuid/${uuid}`);
    
    if (res.status === 429) {
      console.warn(`Rate limit exceeded for UUID "${uuid}"`);
      return { error: 'Rate limit exceeded', action: 'pause' };
    }

    if (res.status === 400) {
      return null; // UUID not found
    }

    if (!res.ok) {
      throw new Error(`MCProfile returned ${res.status}`);
    }

    const data = await res.json();
    return { name: data.username };
  } catch (err) {
    console.warn(`Failed to resolve UUID "${uuid}":`, err.message);
    return null;
  }
}

async function getBedrockPlayerDetails(fuid) {
  try {
    const res = await fetch(`https://mcprofile.io/api/v1/bedrock/fuid/${fuid}`);

    if (res.status === 429) {
      console.warn(`Rate limit exceeded for FUID "${fuid}"`);
      return { error: 'Rate limit exceeded', action: 'pause' };
    }

    if (!res.ok) {
      throw new Error(`MCProfile returned ${res.status}`);
    }

    const data = await res.json();
    return { name: '.' + data.gamertag };
  } catch (err) {
    console.warn(`Failed to resolve FUID "${fuid}":`, err.message);
    return null;
  }
}

async function getPlayerDetails(id) {
  if (id.startsWith('00000000-')) {
    return await getBedrockPlayerDetails(id);
  } else {
    return await getJavaPlayerDetails(id);
  }
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
        const cached = uuidNameCache.get(player.uuid);
        if (cached) {
          return { ...player, name: cached.name, state: 'cache' };
        }
        return { ...player, name: null, state: 'unknown' };
      });
      return server;
    });
    res.set('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Proxy running on port', port));
