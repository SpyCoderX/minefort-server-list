
function minefortOnLoad(serverListElement) {
    console.log('minefortOnLoad executing!');
    if (!serverListElement) {
        console.error('Server list element not found.');
        return;
    }
    serverListElement.innerHTML = '<p>Server list is loading...</p>';

    // Plan and state mappings
    const plans = {
        10: "Hut (free)",
        35: "Cottage (T1)",
        50: "House (T2)",
        100: "Mansion (T3)",
        200: "Fort (T4)"
    };
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
        if (data.servers && Array.isArray(data.servers)) {
            return data.servers;
        } else {
            console.warn('No servers array found in API response:', data);
            return [];
        }
    }

    function createServerItem(server) {
        const players = server.players || {};
        const planKey = players.max;
        const planName = plans[planKey] || `Unknown: ${server.planId}`;
        const planIndex = Object.keys(plans).map(Number).indexOf(planKey);
        const planCost = planIndex !== -1 ? plan_costs[planIndex] : '?';
        const ram = planIndex !== -1 ? plan_ram[planIndex] : '?';
        const storage = planIndex !== -1 ? plan_storage[planIndex] : '?';
        const backups = planIndex !== -1 ? plan_backups[planIndex] : '?';
        const stateName = states[server.state] || "Unknown";
        const icon = server.serverIcon || {};
        const motd = server.messageOfTheDay || '';
        const version = server.version || '';
        const serverId = server.serverId || '';
        const userId = server.userId || '';
        return `
        <div class="server-item">
            <div class="server-name">${server.serverName || server.name}</div>
            <div class="server-desc">
                <span class="mc-color-7"><b>ServerId:</b></span> <code>${serverId}</code><br>
                <span class="mc-color-7"><b>UserId:</b></span> <code>${userId}</code><br>
                <span class="mc-color-7"><b>Version:</b></span> <code>${version}</code><br>
                <span class="mc-color-b"><b>State:</b></span> <span class="mc-color-f">${stateName}</span><br>
                ${icon.image ? `<span class="mc-color-7"><b>Icon:</b></span> ${icon.name} (item: ${icon.item}) <img src="${icon.image}" width="20" height="20" /> <br>` : ''}
                <span class="mc-color-7"><b>MOTD:</b></span> <code>${motd}</code><br>
                <span class="mc-color-6"><b>Plan:</b></span> <span class="mc-color-f">${planName}</span><br>
                <span class="mc-color-6"><b>Plan cost:</b></span> $<span class="mc-color-f">${planCost}</span><br>
                <span class="mc-color-6"><b>RAM:</b></span> <span class="mc-color-f">${ram} GB</span><br>
                <span class="mc-color-6"><b>Storage:</b></span> <span class="mc-color-f">${storage} GB SSD</span><br>
                <span class="mc-color-6"><b>Backups:</b></span> <span class="mc-color-f">${backups}</span><br>
                <span class="mc-color-a"><b>Players Online:</b></span> <span class="mc-color-f">${players.online ?? '?'}</span> / <span class="mc-color-7">${players.max ?? '?'}</span>
            </div>
        </div>
        `;
    }

    async function fillServerList() {
        serverListElement.innerHTML = '<h2>Servers</h2><div class="mc-color-7">Loading...</div>';
        try {
            const servers = await fetchServers();
            if (!servers.length) {
                serverListElement.innerHTML = '<h2>Servers</h2><div class="mc-color-c">No servers found.</div>';
                return;
            }
            serverListElement.innerHTML = '<h2>Servers</h2>' + servers.map(createServerItem).join("");
        } catch (e) {
            serverListElement.innerHTML = '<h2>Servers</h2><div class="mc-color-c">Failed to load servers.</div>';
            console.error('Error loading servers:', e);
        }
    }

    fillServerList();
}
