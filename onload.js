
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

    async function fetchServers() {
        const url = "https://api.minefort.com/v1/servers/list";
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
        const planName = plans[server.players?.max] || `Custom (${server.players?.max ?? '?'})`;
        const stateName = states[server.state] || "Unknown";
        return `
        <div class="server-item">
            <div class="server-name">${server.name}</div>
            <div class="server-desc">
                <span class="mc-color-a">Players:</span> <span class="mc-color-f">${server.players?.online ?? '?'}</span> / <span class="mc-color-7">${server.players?.max ?? '?'}</span><br>
                <span class="mc-color-6">Plan:</span> <span class="mc-color-f">${planName}</span><br>
                <span class="mc-color-b">State:</span> <span class="mc-color-f">${stateName}</span>
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
