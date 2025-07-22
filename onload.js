
let allVersions = new Map();
let global_filters = {};
let global_servers;

const tooltip = document.getElementById('global-tooltip');

function showTooltip(text, x, y) {
    tooltip.innerHTML = text;
    tooltip.style.left = (x-tooltip.offsetWidth/2) + 'px';
    tooltip.style.top =  (y-tooltip.offsetHeight) + 'px';
    tooltip.style.opacity = 1;
}

function hideTooltip() {
    tooltip.style.opacity = 0;
}

function setupPlayerTooltips() {
    const icons = document.querySelectorAll('.updated-player');

    icons.forEach(icon => {
        const playerName = icon.getAttribute('data-name'); // set this attribute below

        icon.addEventListener('mousemove', e => {
        showTooltip(playerName, e.pageX, e.pageY);
        });

        icon.addEventListener('mouseleave', hideTooltip);
        icon.classList.remove('updated-player');
    });
    const titles = document.querySelectorAll('.updated-server .server-name');

    titles.forEach(title => {
        const titleName = title.innerHTML;
        title.addEventListener('mousemove', e => {
            showTooltip(`<span style="font-size: 16px;">${titleName}</span>`, e.pageX, e.pageY);
        });
        title.addEventListener('mouseleave', hideTooltip);
    })
    document.querySelectorAll('.updated-server').forEach(item => item.classList.remove('updated-server'))
}
function toggleTagDropdown() {
  document.getElementById('search-tags').classList.toggle('show');
}
function hideTagDropdown() {
    document.getElementById('search-tags').classList.remove('show');
}
async function buildSearch(searchContainerElement,document) {
    let versions;
    let res;
    try {
        res = await fetch('https://minefort-server-list-backend.onrender.com/api/versions',{method: 'GET'});
    } catch {
        res = await fetch('versions.json');
    }
    versions = (await res.json()).result;
    allVersions = new Map(versions.map(data => [data.name,data.versions]));
    const allVersionNums = [];
    Array.from(allVersions.values()).forEach(verList => verList.forEach(ver => {
        if (!allVersionNums.includes(ver.id)) {
            allVersionNums.push(ver.id);
        }
    }));
    allVersionNums.sort((a,b) => {
        const a1 = parseInt(a.split('.')[1],10);
        const b1 = parseInt(b.split('.')[1],10);
        if (a1 === b1) {
            const a2 = parseInt(a.split('.')[2],10);
            const b2 = parseInt(b.split('.')[2],10);
            return b2-a2;
        }
        return b1-a1;
    });
    allVersions.set("Any",allVersionNums.map(idn => {
        return {id:idn};
    }));
    searchContainerElement.querySelector(".search-filters").innerHTML = `
    <label style="margin-right: 5px">Version</label>
    <select id="search-version-type" onchange="changeVersion(this)">
        <option>Any</option>
        ${versions.map(data => `<option>${data.name}</option>`).join('')}
    </select>
    <select id="search-version-num">
        <option>Any</option>
        ${allVersions.get("Any").map(version => `<option>${version.id}</option>`).join('')}
    </select>
    <div id="search-tags">
        <button onclick="toggleTagDropdown()" class="tags-dropdown-button">Select Tags</button>
        <div id="tag-dropdown">${Array.from(tags.keys()).sort().map(key => `<label><input type="checkbox" value="${key}"> <span class="tag-${key}">${key}</span></label>`).join('')}</div>
    </div>`;
    const versionType = searchContainerElement.querySelector("#search-version-type");
    const versionNum = searchContainerElement.querySelector("#search-version-num");
    const searchElem = searchContainerElement.querySelector(".search-field");
    const button = searchContainerElement.querySelector('.search-button');
    const tagChecks = Array.from(searchContainerElement.querySelectorAll('#tag-dropdown input[type="checkbox"]'));
    const initiateSearch = () => {
        global_filters = {search:searchElem.value,
            version:{type:versionType.value!=="Any"?versionType.value:null,
                number:versionNum.value!=="Any"?versionNum.value:null},
            tags:tagChecks.filter(cb => cb.checked).map(cb => cb.value)}
        minefortOnLoad(document.getElementById('server-list'),document.getElementById('about'),true,global_filters);
    }
    button.addEventListener('mousedown', () => {
        button.classList.add('pressed');
        initiateSearch();
        setTimeout(() => {
            button.classList.remove('pressed');
        },100)
    });
    searchElem.addEventListener('input', initiateSearch);
    versionType.addEventListener('input', initiateSearch);
    versionNum.addEventListener('input',initiateSearch);
    tagChecks.forEach(cb => {
        cb.addEventListener('change', initiateSearch);
    });
}

function changeVersion(selectTypeElement) {
    selectTypeElement.nextElementSibling.innerHTML = '<option>Any</option>'+allVersions.get(selectTypeElement.value).map(version => `<option>${version.id}</option>`).join('')
}

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
const glowColors = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")}, 0.12)`);
const glowColorsHover = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")}, 0.24)`);
const glowColorsLegend = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")}, 0.40)`);
const fullColors = rawColorValues.map(color => `rgba(${color.map(a => a*2).join(",")}, 1)`);

function buildLegend(legendElement,serverElement,customStyle) {
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
    serverElement.innerHTML += Object.entries(plans).map(([key,name], index) => {
        const color = fullColors[index] || 'rgba(0,0,0,1)';
        return `${name.split(" ")[0]} <span class="servers-${name.split(" ")[0]} " style="color: ${color}; text-shadow: 0 0 8px ${color}, 0 0 4px ${color};"><span class="dot-fade"><z>.</z><z>.</z><z>.</z></span></span><br>`
    }).join("");
    customStyle.innerHTML = Array.from(tags.entries()).map(([key,val]) => {
        return `.tag-${key} {
            background: linear-gradient(to right,rgba(${val.join(',')},0.8),rgba(100,100,100,0.5));
            padding: 3px;
            border-radius: 3px;
            margin: 0 1px;
        }`
    }).join('') + 
    Object.entries(plans).map(([key,name], index) => {
        const color = planColors[index];
        const glowColor = glowColorsHover[index];
        const hover = planColorsHover[index];
        return `.server-item-${name.split(' ')[0]} {
              background: ${color};
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
                inset 0 0 8px 8px rgba(0,0,0,0.1),
                inset 0 0 16px 24px rgba(0,0,0,0.05);
            }
            .server-item-${name.split(' ')[0]}:hover {
              background: ${hover};
              box-shadow:
                0 8px 16px 4px rgba(0,0,0,0.26),
                0 0 0 1px rgba(255,255,255,0.08),
                inset 0 0 4px 0px ${glowColor},
                inset 0 0 16px 2px ${glowColor};
            }`
    }).join('');
}
const normal_text = "abcdefghijklmnopqrstuvwxyz";
const small_caps = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ";

const tags = new Map([
    ["Survival",[160,255,50]],
    ["Creative",[50,50,255]],
    ["Adventure",[255,100,50]],
    ["Hardcore",[255,50,50]],
    ["SMP",[0,255,0]],
    ["PvP",[255,255,100]],
    ["Gen",[100,255,200]],
    ["Box",[200,200,200]],
    ["SkyBlock",[100,100,255]],
    ["Lifesteal",[200,50,50]],
    ["Anarchy",[100,0,0]],
    ["Minigame",[150,0,200]],
    ["Economy",[200,150,0]]]);
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
    // console.log('First API response:', res.body);
    let data = await res.json();
    // console.log('First API response:', data);
    const total = data.pagination?.total || 0;
    if (!total) return;
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
    // console.log('Second API response:', data);
    if (data.result && Array.isArray(data.result)) {
        global_servers = data.result;
    } else {
        console.warn('No result array found in API response:', data);
        return;
    }
}
async function minefortOnLoad(serverListElement, aboutElement, update, filter={}) {
    // console.log('minefortOnLoad executing!');
    if (!serverListElement) {
        console.error('Server list element not found.');
        return;
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
    function stripMotd(motd) {
        let out = '';
        for (let index = 0; index < motd.length; index++) {
            const element = motd[index];
            if (element === "&" || element === "§") {
                index++;
                continue;
            }
            if (small_caps.includes(element)) {
                out += normal_text[small_caps.indexOf(element)]
            } else {
                out += element;
            }
        }
        return out;
    }
    function createPlayer(player) {
        return `<div class="player-icon ${(!player.name)?"broken":""} updated-player" data-name="${player.name || 'Error loading username'}" data-uuid="${player.uuid}"><img class="empty-icon" src="empty.png" width="24" height="24"/><img class="actual-icon" src="https://avatars.minefort.com/avatar/${player.uuid}" width="24" height="24" alt="${player.uuid}" class="player-avatar" /></div>`;
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
        const serverName = server.serverName;
        
        const planTier = planIndex !== -1 ? planIndex : 0;
        // Plan expandable in glassmorphic div, button themed, section glassy
        const iconImg = icon.image ? `<img src="${icon.image}" style="width: 32px; height: 32px; padding: 5px; box-shadow: 0 2px 4px 2px rgba(0,0,0,0.3);" alt="icon" />` : '';
        const copyIpBtn = `<button class="copy-ip-btn" title="Copy IP"><svg style="filter: drop-shadow(0px 0px 4px rgba(255,255,255, 1));" width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z"/></svg></button>`;
        const topRow = `<div class="server-top">
            ${iconImg}
            <span class="server-name">${serverName}</span>
             ${copyIpBtn}
        </div>`;
        const motdSection = `<div class="motd-glass">
            <span>${colorizeMotd(motd)}</span>
        </div>`;
        const playerList = players.online > 0 ? `<div class="player-list">
            ${players.list.map(createPlayer).join('')}
        </div>` : "";
        
        const strippedMotd = stripMotd(motd).toLowerCase();
        let resolvedTags = Array.from(tags.keys()).filter(key =>  strippedMotd.includes(key.toString().toLowerCase()) || serverName.toLowerCase().includes(key.toString().toLowerCase()));
        const tagList = resolvedTags.length > 0 ? `<div class="tag-list">
            ${resolvedTags.map(key => `<div class="server-tag tag-${key}">${key}</div>`).join('')}
        </div>` : "";
        
        const bottomRow = `<div class="server-bottom">
            <div>
                <span class="glow-2" style="font-weight:600;font-size:1em;">${versionType}</span>
                ${versionNum ? `<span class="glow-3" style="font-size:0.97em;color:#b0b3b8;">${versionNum}</span>` : ''}
            </div>
            <div class="glow-2" style="font-weight:600;font-size:1em;"><p><span class="online-players">${players.online ?? '?'}</span> <span class="glow-3 mc-color-7">/ ${players.max ?? '?'}</span></p></div>
        </div>`;
        
        return `
          <div class="server-item server-item-${plans[planKey].split(' ')[0]} updated-server" data-plan-tier="${planTier}" data-player-count="${players.online}">
            ${topRow}
            ${motdSection}
            ${playerList}
            ${tagList}
            ${bottomRow}
          </div>
        `;
    }
    function filterServerItem(server) {
        const searchText = filter?.search;
        const versionType = filter?.version?.type;
        const versionNum = filter?.version?.number;
        const tagList = filter?.tags;
        if (searchText) {
            if (!(server.serverName.includes(searchText) || stripMotd(server.messageOfTheDay).includes(searchText))) {
                return false;
            }
        }
        if (versionType) {
            if (!(server.version.split('-')[0].toLowerCase() == versionType.toLowerCase())) {
                return false;
            }
        }
        if (versionNum) {
            if (!(server.version.split('-')[1] === versionNum)) {
                return false;
            }
        }
        if (tagList) {
            if (!tagList.every(key => stripMotd(server.messageOfTheDay).includes(key.toString().toLowerCase()) || server.serverName.toLowerCase().includes(key.toString().toLowerCase()))) {
                return false;
            }
        }
        return true;
    }

    async function fillServerList() {
        if (!update) {
            serverListElement.innerHTML = '<div class="mc-color-7 server-list-info">Loading<span class="dot-fade"><z>.</z><z>.</z><z>.</z></span></div>';
        }
        try {
            if (!global_servers) {
                await fetchServers();
            }
            const servers = global_servers;
            if (!servers.length) {
                serverListElement.innerHTML = '<div class="mc-color-c server-list-info">No servers found.</div>';
                return;
            }
            const total_servers = servers.length;
            let total_players = 0;
            let java_players = 0;
            let bedrock_players = 0;
            let cracked_players = 0;
            let unknown_players = 0;
            let servers_to_plan = new Map(Object.entries(plans).map(([key,value]) => [parseInt(key),0]));
            servers.forEach(server => {
                total_players += server.players.online;
                server.players.list.forEach(player => {
                    let name = player?.name;
                    if (name) {
                        if (name.startsWith("+")) {
                            cracked_players += 1;
                        }
                        else if (name.startsWith(".")) {
                            bedrock_players += 1;
                        }
                        else {
                            java_players += 1;
                        }
                    } else {
                        unknown_players += 1;
                    }
                })
                const max = server.players.max;
                servers_to_plan.set(max,servers_to_plan.get(max)+1);
            });
            aboutElement.querySelector('.servers-total').innerHTML = total_servers;

            aboutElement.querySelector('.players-total').innerHTML = total_players;
            aboutElement.querySelector('.players-java').innerHTML = `${java_players} (${Math.round(java_players/total_players*1000)/10}%)`;
            aboutElement.querySelector('.players-bedrock').innerHTML = `${bedrock_players} (${Math.round(bedrock_players/total_players*1000)/10}%)`;
            aboutElement.querySelector('.players-cracked').innerHTML = `${cracked_players} (${Math.round(cracked_players/total_players*1000)/10}%)`;
            aboutElement.querySelector('.players-unknown').innerHTML = `${unknown_players} (${Math.round(unknown_players/total_players*1000)/10}%)`;

            Object.entries(plans).forEach(([key,name]) => {
                aboutElement.querySelector(`.servers-${name.split(" ")[0]}`).innerHTML = `${servers_to_plan.get(parseInt(key))} (${Math.round(servers_to_plan.get(parseInt(key))/total_servers*1000)/10}%)`;
            });
            if (update) {
                let filteredServers = servers.filter(filterServerItem);
                const serverItems = new Map(Array.from(serverListElement.querySelectorAll('.server-item')).map(item => [item,item.getBoundingClientRect()]));

                serverListElement.querySelectorAll('.server-item').forEach(item => {
                    const name = item.querySelector('.server-name').innerHTML;
                    const thisServer = filteredServers.filter(server => server.serverName === name)[0];
                    if (!thisServer) {
                        serverItems.set(item,null);
                        item.remove();
                        return;
                    }
                    const playerCount = item.querySelector('.online-players');
                    playerCount.innerHTML = thisServer.players.online;
                    item.setAttribute('data-player-count',thisServer.players.online);
                    const playerList = item.querySelector('.player-list');
                    let players = thisServer.players.list;
                    if (playerList) {
                        if (players.length === 0) {
                            playerList.remove();
                        } else {
                            Array.from(playerList.children).forEach(icon => {
                                const uuid = icon.getAttribute('data-uuid');
                                const thisPlayer = players.filter(pl => pl.uuid === uuid);
                                if (!thisPlayer) {
                                    icon.remove();
                                }
                                if (icon.getAttribute('data-name') !== thisPlayer.name) {
                                    icon.setAttribute('data-name',thisPlayer.name);
                                }
                                icon.classList.remove('updated-player');
                                players = players.filter(pl => pl.uuid !== uuid);
                            });
                            playerList.insertAdjacentHTML('beforeend',players.map(createPlayer).join(''));
                        }
                    } else if (players.length > 0) {
                        const motd = item.querySelector('.motd-glass');
                        motd.insertAdjacentHTML('afterend',`<div class="player-list">${players.map(createPlayer).join('')}</div>`)
                    }
                    

                    filteredServers = filteredServers.filter(server => server.serverName!==name);
                });
                serverListElement.insertAdjacentHTML('beforeend',filteredServers.map(createServerItem).join(''));

                const children = Array.from(serverListElement.children);

                // 2. Sort the array by player count
                children.sort((a, b) => {
                const aCount = parseInt(a.getAttribute('data-player-count'), 10);
                const bCount = parseInt(b.getAttribute('data-player-count'), 10);
                return bCount - aCount; // descending
                });

                // 3. Append in new order (this moves DOM elements instead of recreating them)
                children.forEach(server => serverListElement.appendChild(server));

                Array.from(serverItems.entries()).forEach(([item,first]) => {
                    if (!first) return;

                    const last = item.getBoundingClientRect(); 

                    const dx = first.left - last.left;
                    const dy = first.top - last.top;

                    item.style.transform = `translate(${dx}px, ${dy}px)`;
                    item.style.transition = 'transform 0s';

                    // Trigger reflow
                    requestAnimationFrame(() => {
                        item.style.transform = '';
                        item.style.transition = 'transform 0.8s ease';
                        setTimeout(() => {
                            item.style.transition = '';
                        }, 800)
                    });
                })

            } else {
                serverListElement.innerHTML = servers.filter(filterServerItem).map(createServerItem).join("");
                serverListElement.style.height = serverListElement.scrollHeight + "px";
                serverListElement.addEventListener('transitionend', () => {
                    serverListElement.style.height = "auto"; // Reset height to auto after transition
                    serverListElement.style.overflow = "visible";
                });
                
            }
            
            console.log("updated server list")


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
    setupPlayerTooltips();
}

