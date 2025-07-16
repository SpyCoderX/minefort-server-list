const plans = {
    10: "Hut (free)",
    35: "Cottage (T1)",
    50: "House (T2)",
    100: "Mansion (T3)",
    200: "Fort (T4)"
};
const rawColorValues = [
    [90, 90, 100],   // Hut (darker gray)
    [100, 100, 10],  // Cottage (darker yellow)
    [120, 60, 10],  // House (darker orange)
    [120, 20, 10],   // Mansion (darker red)
    [98, 41, 150]    // Fort (darker blue)
];
// Plan and state mappings

const states = {
    0: "Sleeping",
    1: "Uploading",
    2: "Downloading",
    3: "Starting",
    4: "Online",
    5: "Offline",
    6: "Creating backup",
    7: "Restoring backup",
    8: "Stopping",
    9: "Locked"
};
// Plan details arrays
const plan_costs = [0, 5.99, 11.49, 23.99, 47.99];
const plan_ram = [1, 2, 4, 8, 12]; // in GB
const plan_storage = [10, 20, 40, 80, 120]; // in GB SSD
const plan_backups = [1, 3, 5, 7, 15];
// Solid colors for each plan tier (normal and hover) (made procedurally from rawColorValues)
const planColors = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")},0.32)`);
const planColorsHover = rawColorValues.map(color => `rgba(${color.join(",")},0.64)`);
const glowColors = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")}, 0.12)`)
const glowColorsHover = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")}, 0.24)`)
const glowColorsLegend = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")}, 0.40)`)

function buildLegend(legendElement) {
    if (!legendElement) {
        console.error('Legend element not found.');
        return;
    }
    legendElement.innerHTML = Object.entries(plans).map(([key, name], index) => {
        const color = planColors[index] || 'rgba(0,0,0,0.1)';
        return `<div class="plan-legend-wrapper"><div class="plan-legend-item" style="background: ${color}; box-shadow: 0 4px 16px 0 rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.30), inset 0 0 8px 2px ${glowColorsLegend[index]}, inset 0 0 32px 4px ${glowColorsLegend[index]};">
            <h3 class="plan-name">${name}</h3>
            <div class="plan-details">
            <div class="plan-left">
            <span class="plan-cost">Cost:</span>
            <span class="plan-ram">RAM:</span>
            <span class="plan-storage">Storage:</span>
            <span class="plan-backups">Backups:</span>
            </div>
            <div class="plan-right">
            <span class="plan-cost-value">$${plan_costs[index]}</span>
            <span class="plan-ram-value">${plan_ram[index]} GB</span>
            <span class="plan-storage-value">${plan_storage[index]} GB</span>
            <span class="plan-backups-value">${plan_backups[index]}</span>
            </div>
            </div>
        </div></div>`;
    }).join("");
}

async function minefortOnLoad(serverListElement, aboutElement) {
    console.log('minefortOnLoad executing!');
    if (!serverListElement) {
        console.error('Server list element not found.');
        return;
    }
    serverListElement.innerHTML = '<p>Server list is loading...</p>';

    

    async function fetchServers() {
        const url = "https://minefort-server-list-backend.onrender.com/api/servers";
        let payload = {
            pagination: { skip: 0, limit: 1 },
            sort: { field: "players.online", order: "desc" }
        };
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        // Get total count
        let res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
        console.log('First API response:', res.body);
        let data = await res.json();
        console.log('First API response:', data);
        const total = data.pagination?.total || 0;
        if (!total) return [];
        // Fetch all servers
        payload = {
            pagination: { skip: 0, limit: total },
            sort: { field: "players.online", order: "desc" }
        };
        res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
        data = await res.json();
        console.log('Second API response:', data);
        if (data.result && Array.isArray(data.result)) {
            return data.result;
        } else {
            console.warn('No result array found in API response:', data);
            return [];
        }
    }

    // Colorize Minecraft MOTD (&-codes)
    function colorizeMotd(motd) {
        if (!motd) return '';
        const colorMap = {
            '0': 'mc-color-0', '1': 'mc-color-1', '2': 'mc-color-2', '3': 'mc-color-3',
            '4': 'mc-color-4', '5': 'mc-color-5', '6': 'mc-color-6', '7': 'mc-color-7',
            '8': 'mc-color-8', '9': 'mc-color-9', 'a': 'mc-color-a', 'b': 'mc-color-b',
            'c': 'mc-color-c', 'd': 'mc-color-d', 'e': 'mc-color-e', 'f': 'mc-color-f'
        };
        const formatMap = {
            'l': 'mc-bold', 'o': 'mc-italic', 'n': 'mc-underline', 'm': 'mc-strikethrough'
        };
        let openTags = [];
        let out = '';
        let i = 0;
        while (i < motd.length) {
            if ((motd[i] === '&' || motd[i] === '§') && i + 1 < motd.length) {
                const code = motd[i + 1].toLowerCase();
                if (colorMap[code]) {
                    // Close all open tags
                    while (openTags.length) {
                        out += '</span>';
                        openTags.pop();
                    }
                    out += `<span class="${colorMap[code]}">`;
                    openTags.push(colorMap[code]);
                } else if (formatMap[code]) {
                    out += `<span class="${formatMap[code]}">`;
                    openTags.push(formatMap[code]);
                } else if (code === 'r') {
                    // Reset: close all
                    while (openTags.length) {
                        out += '</span>';
                        openTags.pop();
                    }
                }
                i += 2;
                continue;
            }
            if (motd[i] === '\n') {
                out += '<br>';
            } else {
                out += motd[i];
            }
            i++;
        }
        while (openTags.length) {
            out += '</span>';
            openTags.pop();
        }
        return out;
    }

    function createServerItem(server) {
        const players = server.players || {};
        const planKey = players.max;
        const planIndex = Object.keys(plans).map(Number).indexOf(planKey);
        const icon = server.serverIcon || {};
        const motd = server.messageOfTheDay || '';
        const version = server.version.split("-") || [];
        const versionType = version[0] || 'Unknown';
        const versionNum = version[1] || '';
        const serverId = server.serverId || '';
        
        const planTier = planIndex !== -1 ? planIndex : 0;
        // Plan expandable in glassmorphic div, button themed, section glassy
        const iconImg = icon.image ? `<img src="${icon.image}" style="width: 32px; height: 32px; padding: 5px; box-shadow: 0 2px 4px 2px rgba(0,0,0,0.3);" alt="icon" />` : '';
        const copyIpBtn = `<button class="copy-ip-btn" title="Copy IP"><svg style="filter: drop-shadow(0px 0px 4px rgba(255,255,255, 1));" width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z"/></svg></button>`;
        const topRow = `<div class="server-top">
            ${iconImg}
            <span class="server-name">${server.serverName}</span>
            ${copyIpBtn}
        </div>`;
        const motdSection = `<div class="motd-glass">
            <span>${colorizeMotd(motd)}</span>
        </div>`;
        const playerList = `<div class="player-list">
            ${players.list.map(player => `<div class="player-icon ${(!player.name)?"broken":""}" data-name="${player.name || 'Error loading username'}"><img class="empty-icon" src="empty.png" width="24" height="24"/><img class="actual-icon" src="https://avatars.minefort.com/avatar/${player.uuid}" width="24" height="24" alt="${player.uuid}" class="player-avatar" /></div>`).join('')}
        </div>`;
        const bottomRow = `<div class="server-bottom">
            <div>
                <span class="glow-2" style="font-weight:600;font-size:1em;">${versionType}</span>
                ${versionNum ? `<span class="glow-3" style="font-size:0.97em;color:#b0b3b8;">${versionNum}</span>` : ''}
            </div>
            <div class="glow-2" style="font-weight:600;font-size:1em;"><p>${players.online ?? '?'} <span class="glow-3 mc-color-7">/ ${players.max ?? '?'}</span></p></div>
        </div>`;
        const uniqueId = `server-item-${serverId}`;
        const styleBlock = `
          <style>
            .${uniqueId} {
              background: ${planColors[planTier]};
              border-radius: 12px;
              padding: 1.2rem 1.1rem 1.1rem 1.1rem;
              box-shadow: 0 4px 16px 0 rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 8px 2px rgba(255,255,255,0.13), inset 0 0 32px 4px rgba(80,180,255,0.08);
              display: flex;
              flex-direction: column;
              position: relative;
              text-align: left;
              transition: box-shadow 0.2s, transform 0.2s, background 0.2s;
              overflow: visible;
              box-shadow:
                0 4px 16px 0 rgba(0,0,0,0.18),
                0 0 0 1px rgba(255,255,255,0.08),
                inset 0 0 8px 8px rgba(0,0,0,0.2),
                inset 0 0 16px 24px rgba(0,0,0,0.1);
            }
            .${uniqueId}:hover {
              background: ${planColorsHover[planTier]};
              box-shadow:
                0 8px 16px 4px rgba(0,0,0,0.26),
                0 0 0 1px rgba(255,255,255,0.08),
                inset 0 0 4px 0px ${glowColorsHover[planTier]},
                inset 0 0 16px 2px ${glowColorsHover[planTier]};
            }
          </style>
        `;
        return `
          ${styleBlock}
          <div class="server-item ${uniqueId}" data-plan-tier="${planTier}">
            ${topRow}
            ${motdSection}
            ${playerList}
            ${bottomRow}
          </div>
        `;
    }

    async function fillServerList() {
        serverListElement.innerHTML = '<div class="mc-color-7 server-list-info">Loading...</div>';
        try {
            const servers = await fetchServers();
            if (!servers.length) {
                serverListElement.innerHTML = '<div class="mc-color-c server-list-info">No servers found.</div>';
                return;
            }
            const total_servers = servers.length;
            const total_players = servers.reduce((sum, server) => sum + (server.players?.online || 0), 0);
            aboutElement.querySelector('.about-servers').innerHTML = total_servers;
            aboutElement.querySelector('.about-players').innerHTML = total_players;
            serverListElement.innerHTML = servers.map(createServerItem).join("");
            serverListElement.style.height = serverListElement.scrollHeight + "px";
            serverListElement.addEventListener('transitionend', () => {
                serverListElement.style.height = "auto"; // Reset height to auto after transition
                serverListElement.style.overflow = "visible";
            });


            // Attach all event listeners after DOM update
            // MOTD toggle
            serverListElement.querySelectorAll('.copy-ip-btn').forEach(item => {
                const ip = item.closest('.server-item').querySelector('.server-name');
                item.addEventListener('click', () => {
                    navigator.clipboard.writeText(ip.textContent + '.minefort.com').then(() => {
                        item.classList.add('copied');
                        setTimeout(() => {
                            item.classList.remove('copied');
                        }, 400);
                    });
                });
            });
        } catch (e) {
            serverListElement.innerHTML = '<div class="mc-color-c server-list-info">Failed to load servers.</div>';
            console.error('Error loading servers:', e);
        }
    }

    await fillServerList();
}

