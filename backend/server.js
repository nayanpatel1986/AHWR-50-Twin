const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { InfluxDB } = require('@influxdata/influxdb-client');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 5000;
const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'my-super-secret-auth-token';
const INFLUX_ORG = process.env.INFLUX_ORG || 'romii_org';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'romii_bucket';

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
    res.send('ROM-II Backend is running');
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// InfluxDB Query Client
const queryApi = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN }).getQueryApi(INFLUX_ORG);

// --- Drilling Physics Engine ---
const DRILLING_STATE_FILE = './drilling_state.json';
let drillingState = {
    stringWeight: 0, // kips (Tare weight)
    totalDepth: 1000, // ft
    bitDepth: 0, // ft
    lastBlockPosition: 0 // ft
};

// Load state from disk if exists
if (fs.existsSync(DRILLING_STATE_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(DRILLING_STATE_FILE));
        drillingState = { ...drillingState, ...saved };
    } catch (e) {
        console.error("Failed to load drilling state:", e);
    }
}

const saveDrillingState = () => {
    fs.writeFileSync(DRILLING_STATE_FILE, JSON.stringify(drillingState, null, 2));
};

// Physics Loop (Runs on data update)
const updatePhysics = (rigData) => {
    // 1. Get Inputs
    const currentHookLoad = rigData.drawworks?.hook_load || 0;
    const currentBlockPos = rigData.drawworks?.block_position || 0;

    // 2. Calculate WOB
    // WOB is the weight of the string supported by the bottom, so StringWeight - HookLoad
    let wob = Math.max(0, drillingState.stringWeight - currentHookLoad);

    // 3. Calculate Depths
    const deltaBlock = drillingState.lastBlockPosition - currentBlockPos; // Positive = Moving Down

    // Update Bit Depth based on block movement
    let newBitDepth = drillingState.bitDepth + deltaBlock;

    // Constrain Bit Depth (Cannot be less than 0)
    newBitDepth = Math.max(0, newBitDepth);

    // Drilling Logic
    const WOB_THRESHOLD = 1.0; // kips
    if (wob > WOB_THRESHOLD) {
        // We are on bottom and applying weight -> Drilling
        drillingState.bitDepth = newBitDepth;
        // Total Depth increases if we push past it
        if (drillingState.bitDepth > drillingState.totalDepth) {
            drillingState.totalDepth = drillingState.bitDepth;
        }
    } else {
        // Off bottom - moving freely
        drillingState.bitDepth = newBitDepth;
        // Bit cannot go deeper than hole depth if we aren't drilling (simplified colission)
        drillingState.bitDepth = Math.min(drillingState.bitDepth, drillingState.totalDepth);
    }

    // Update History
    drillingState.lastBlockPosition = currentBlockPos;
    saveDrillingState();

    return {
        wob: Number(wob.toFixed(1)),
        bit_depth: Number(drillingState.bitDepth.toFixed(2)),
        hole_depth: Number(drillingState.totalDepth.toFixed(2))
    };
};

// --- APIs for Calibration ---
app.post('/api/drilling/zero-wob', (req, res) => {
    // Set String Weight to current Hook Load
    // We need the latest hook load, which we might not have direct access to here easily 
    // without querying DB or caching. For now, let's accept it from the client or use valid cached data.
    // Better: Client sends current hookload to confirm? Or we just use strict state.
    // Let's rely on the body for now to be explicit, or fetch latest.
    const { currentHookLoad } = req.body;
    if (currentHookLoad !== undefined) {
        drillingState.stringWeight = Number(currentHookLoad);
        saveDrillingState();
        res.json({ success: true, stringWeight: drillingState.stringWeight });
    } else {
        res.status(400).json({ error: "Missing currentHookLoad" });
    }
});

app.post('/api/drilling/set-depth', (req, res) => {
    const { bitDepth, holeDepth } = req.body;
    if (bitDepth !== undefined) drillingState.bitDepth = Number(bitDepth);
    if (holeDepth !== undefined) drillingState.totalDepth = Number(holeDepth);
    saveDrillingState();
    res.json({ success: true, state: drillingState });
});

app.get('/api/drilling/state', (req, res) => {
    res.json(drillingState);
});

// --- Main Socket & Data Loop ---

// Modbus Configuration API helpers
const CONFIG_PATH = process.env.TELEGRAF_CONFIG_PATH || './telegraf/telegraf.conf';
const DB_PATH = './modbus_db.json'; // Simple JSON DB for storing Modbus config

// Helper: Read/Write JSON DB
const getModbusConfig = () => {
    if (!fs.existsSync(DB_PATH)) return { slaves: [] };
    return JSON.parse(fs.readFileSync(DB_PATH));
};

const saveModbusConfig = (config) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(config, null, 2));
};

// Map Modbus fields to application categories
const FIELD_MAP = {
    "HOOK_LOAD": { meas: "drawworks", field: "hook_load" },
    "BLOCK_POSITION": { meas: "drawworks", field: "block_position" },
    "ENGINE_RPM": { meas: "engine", field: "rpm" },
    "OIL_PRESSURE": { meas: "engine", field: "oil_pressure" },
    "OIL_TEMP": { meas: "engine", field: "oil_temp" },
    "COOLANT_TEMP": { meas: "engine", field: "coolant_temp" },
    "EXHAUST_TEMP": { meas: "engine", field: "exhaust_temp" },
    "FUEL_LEVEL": { meas: "engine", field: "fuel_level" },
    "BATTERY_VOLTAGE": { meas: "engine", field: "battery_voltage" },
    "SPM_1": { meas: "mudpump", field: "spm" },
    "SPM_2": { meas: "mudpump", field: "spm_2" },
    "TOTAL_SPM": { meas: "mudpump", field: "total_spm" },
    "PUMP_PRESSURE": { meas: "mudpump", field: "pressure" },
    "FLOW_IN": { meas: "mudpump", field: "flow_in" },
    "FLOW_OUT": { meas: "mudpump", field: "flow_out" },
    "TUBING_PRESSURE": { meas: "wellcontrol", field: "tubing_pressure" },
    "CASING_PRESSURE": { meas: "wellcontrol", field: "casing_pressure" },
    "BOP_PRESSURE": { meas: "wellcontrol", field: "bop_pressure" },
    "ACCUMULATOR_PRESSURE": { meas: "wellcontrol", field: "accumulator_pressure" },
    "MANIEFOLD_PRESSURE": { meas: "wellcontrol", field: "manifold_pressure" },
    "MANIFOLD_PRESSURE": { meas: "wellcontrol", field: "manifold_pressure" },
    "ANNULAR_PRESSURE": { meas: "wellcontrol", field: "annular_pressure" },
    "TRIP_TANK": { meas: "fluid", field: "trip_tank" },
    "RIG_AIR_PRESSURE": { meas: "system", field: "rig_air_pressure" },
    "CROWNOMATIC": { meas: "drawworks", field: "crownomatic" },
    "FLOOROMATIC": { meas: "drawworks", field: "flooromatic" },
    "ANNULAR_OPEN": { meas: "wellcontrol", field: "annular_open" },
    "ANNULARRAM_OPEN": { meas: "wellcontrol", field: "annular_open" },
    "ANNULARRAM_CLOSE": { meas: "wellcontrol", field: "annular_close" },
    "PIPE_RAM_OPEN": { meas: "wellcontrol", field: "pipe_ram_open" },
    "PIPE_RAM_CLOSE": { meas: "wellcontrol", field: "pipe_ram_close" },
    "BLIND_RAM_OPEN": { meas: "wellcontrol", field: "blind_ram_open" },
    "BLIND_RAM_CLOSE": { meas: "wellcontrol", field: "blind_ram_close" },
    "SHEAR_RAM_OPEN": { meas: "wellcontrol", field: "shear_ram_open" },
    "TRAVELLING_UP": { meas: "drawworks", field: "travelling_up" },
    "TRAVELLING_DOWN": { meas: "drawworks", field: "travelling_down" }
};

const queryData = async () => {
    // Query for latest values from 'drawworks', 'engine', 'mudpump', 'wellcontrol', and 'modbus'
    const measurements = ['drawworks', 'engine', 'mudpump', 'wellcontrol', 'modbus'];
    const measurementFilter = measurements.map(m => `r["_measurement"] == "${m}"`).join(' or ');

    const fluxQuery = `
    from(bucket: "${INFLUX_BUCKET}")
      |> range(start: -10s)
      |> filter(fn: (r) => ${measurementFilter})
      |> last()
  `;

    try {
        const data = {};
        await new Promise((resolve, reject) => {
            queryApi.queryRows(fluxQuery, {
                next(row, tableMeta) {
                    const o = tableMeta.toObject(row);
                    let meas = o._measurement;
                    let f = o._field;

                    if (FIELD_MAP[f]) {
                        meas = FIELD_MAP[f].meas;
                        f = FIELD_MAP[f].field;
                    }

                    if (!data[meas]) data[meas] = {};
                    data[meas][f] = o._value;
                },
                error(error) {
                    console.error('InfluxDB Query Error:', error);
                    reject(error);
                },
                complete() {
                    resolve();
                },
            });
        });

        // Check if we have valid sensor data (Drawworks is critical)
        const hasSensorData = data.drawworks || data.engine || data.mudpump;

        if (hasSensorData) {
            // Run Physics Engine
            const physicsData = updatePhysics(data);
            data.drilling = physicsData;
        } else {
            // No Sensor Data (PLC Disconnected) -> Aggressive Zero State
            data.drilling = {
                wob: 0,
                bit_depth: 0,
                hole_depth: 0
            };
        }

        // Map real Modbus "wellcontrol" data to frontend expectation "well_control", defaulting to safely zeroed fields if missing
        const wcReal = data.wellcontrol || {};
        data.well_control = {
            annular_pressure: wcReal.annular_pressure || 0,
            manifold_pressure: wcReal.manifold_pressure || 0,
            accumulator_pressure: wcReal.accumulator_pressure || 0,
            annular_open: wcReal.annular_open || false,
            annular_close: wcReal.annular_close || false,
            pipe_ram_open: wcReal.pipe_ram_open || false,
            pipe_ram_close: wcReal.pipe_ram_close || false,
            blind_ram_open: wcReal.blind_ram_open || false,
            blind_ram_close: wcReal.blind_ram_close || false,
            shear_ram_open: wcReal.shear_ram_open || false
        };
        // Remove the internal un-underscored reference to save payload size
        delete data.wellcontrol;

        // Emit data (Real or Zeroed)
        // console.log("Drawworks payload:", JSON.stringify(data.drawworks));
        console.log("Raw Modbus Object:", JSON.stringify(data.modbus));
        console.log("Well Control payload:", JSON.stringify(data.well_control));
        console.log(`[DEBUG] UP: ${data.drawworks?.travelling_up}, DOWN: ${data.drawworks?.travelling_down}`);
        io.emit('rig_data', data);

    } catch (err) {
        console.error("Error querying InfluxDB:", err);
    }
};

// Poll InfluxDB every second
setInterval(queryData, 1000);

// API: Get Historical Data
// API: Get Historical Data
app.get('/api/history', async (req, res) => {
    const { range, start, stop } = req.query;

    // Build range filter
    let rangeFilter = '';
    let windowPeriod = '5s';

    if (start && stop) {
        rangeFilter = `|> range(start: ${start}, stop: ${stop})`;

        // Calculate window dynamically based on duration
        const durationMs = new Date(stop).getTime() - new Date(start).getTime();
        const hours = durationMs / (1000 * 60 * 60);

        if (hours > 24 * 30 * 6) windowPeriod = '24h';
        else if (hours > 24 * 30) windowPeriod = '6h';
        else if (hours > 24 * 7) windowPeriod = '1h';
        else if (hours > 24) windowPeriod = '15m';
        else if (hours > 1) windowPeriod = '1m';
    } else {
        rangeFilter = `|> range(start: ${range || '-30s'})`;

        if (range?.includes('mo')) windowPeriod = '24h';
        else if (range?.includes('30d')) windowPeriod = '6h';
        else if (range?.includes('7d')) windowPeriod = '1h';
        else if (range?.includes('24h')) windowPeriod = '15m';
        else if (range?.includes('12h')) windowPeriod = '5m';
        else if (range?.includes('1h')) windowPeriod = '30s';
        else if (range?.includes('15m')) windowPeriod = '5s';
        else if (range?.includes('10m')) windowPeriod = '5s';
        else if (range?.includes('5m')) windowPeriod = '2s';
        else if (range?.includes('1m')) windowPeriod = '1s';
    }

    // Determine if we need date in the time label
    const needsDate = range?.includes('24h') || range?.includes('7d') || range?.includes('30d') || range?.includes('mo') || (start && stop);

    const measurements = ['drawworks', 'engine', 'mudpump', 'wellcontrol', 'modbus'];
    const measurementFilter = measurements.map(m => `r["_measurement"] == "${m}"`).join(' or ');

    const fluxQuery = `
    import "types"
    from(bucket: "${INFLUX_BUCKET}")
      ${rangeFilter}
      |> filter(fn: (r) => ${measurementFilter})
      |> filter(fn: (r) => types.isType(v: r._value, type: "float") or types.isType(v: r._value, type: "int") or types.isType(v: r._value, type: "uint"))
      |> aggregateWindow(every: ${windowPeriod}, fn: mean, createEmpty: false)
      |> yield(name: "mean")
  `;

    try {
        const history = [];
        await new Promise((resolve, reject) => {
            queryApi.queryRows(fluxQuery, {
                next(row, tableMeta) {
                    const o = tableMeta.toObject(row);
                    let meas = o._measurement;
                    let f = o._field;

                    if (FIELD_MAP[f]) {
                        meas = FIELD_MAP[f].meas;
                        f = FIELD_MAP[f].field;
                    }

                    history.push({
                        time: o._time,
                        measurement: meas,
                        field: f,
                        value: o._value
                    });
                },
                error(error) {
                    console.error(error);
                    reject(error);
                },
                complete() {
                    resolve();
                }
            });
        });

        // Group by timestamp for the chart
        const grouped = {};
        history.forEach(pt => {
            const t = new Date(pt.time).getTime(); // Use numeric timestamp as key
            if (!grouped[t]) {
                const d = new Date(pt.time);
                let label;
                if (needsDate) {
                    label = d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                } else {
                    label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                }
                grouped[t] = { name: label, timestamp: t };
            }
            grouped[t][`${pt.measurement}.${pt.field}`] = pt.value;
        });

        // Sort by numeric timestamp (not string)
        res.json(Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Modbus Configuration API

// Helper: Generate Telegraf TOML
const generateTelegrafConfig = (config) => {
    let toml = '';
    config.slaves.forEach(slave => {
        toml += `[[inputs.modbus]]\n`;
        toml += `  name = "${slave.name}"\n`;
        toml += `  slave_id = ${slave.slaveId}\n`;
        toml += `  timeout = "1s"\n`;
        toml += `  controller = "tcp://${slave.ip}:${slave.port}"\n`;

        toml += `  configuration_type = "register"\n`;
        toml += `  optimization = "none"\n\n`;

        // Discrete Inputs
        const discretes = slave.registers.filter(r => r.type === 'discrete_input' && r.address !== null && r.address !== undefined && r.address !== "");
        if (discretes.length > 0) {
            toml += `  discrete_inputs = [\n`;
            discretes.forEach(r => {
                toml += `    { name = "${r.name}", address = [${r.address}] },\n`;
            });
            toml += `  ]\n`;
        }

        // Coils
        const coils = slave.registers.filter(r => r.type === 'coil' && r.address !== null && r.address !== undefined && r.address !== "");
        if (coils.length > 0) {
            toml += `  coils = [\n`;
            coils.forEach(r => {
                toml += `    { name = "${r.name}", address = [${r.address}] },\n`;
            });
            toml += `  ]\n`;
        }

        // Holding Registers (INT16, FLOAT32, etc.)
        const holding = slave.registers.filter(r => (r.type === 'holding_register' || r.type === 'input_register') && r.address !== null && r.address !== undefined && r.address !== "");
        if (holding.length > 0) {
            toml += `  holding_registers = [\n`;
            holding.forEach(r => {
                let scaleVal = r.scale !== undefined && r.scale !== null && r.scale !== "" ? Number(r.scale) : 1.0;
                let scaleStr = Number.isInteger(scaleVal) ? scaleVal.toFixed(1) : String(scaleVal);
                // Use AB for 16-bit, ABCD for 32-bit (assuming Big Endian default)
                const byteOrder = (r.dataType === 'INT16' || r.dataType === 'UINT16') ? 'AB' : 'ABCD';
                toml += `    { name = "${r.name}", byte_order = "${byteOrder}", data_type = "${r.dataType}", scale = ${scaleStr}, address = [${r.address}] },\n`;
            });
            toml += `  ]\n`;
        }
        toml += `\n`;
    });
    return toml;
};

// API: Get Modbus Config
app.get('/api/modbus', (req, res) => {
    res.json(getModbusConfig());
});

// API: Save Modbus Config
app.post('/api/modbus', (req, res) => {
    try {
        const config = req.body; // Expect { slaves: [...] }
        saveModbusConfig(config);

        // Update Telegraf.conf
        // 1. Read existing file
        let content = fs.readFileSync(CONFIG_PATH, 'utf8');

        // 2. Find markers
        const startMarker = '# MODBUS_CONFIG_START';
        const endMarker = '# MODBUS_CONFIG_END';
        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);

        if (startIndex === -1 || endIndex === -1) {
            throw new Error("Telegraf configuration file is missing markers.");
        }

        // 3. Generate new section
        const newSection = generateTelegrafConfig(config);

        // 4. Replace content
        const before = content.substring(0, startIndex + startMarker.length);
        const after = content.substring(endIndex);
        const newContent = `${before}\n${newSection}\n${after}`;
        fs.writeFileSync(CONFIG_PATH, newContent);
        // 5. Restart Telegraf Container via Docker Socket API (Native Node)
        const options = {
            socketPath: '/var/run/docker.sock',
            path: '/containers/romii_telegraf/restart',
            method: 'POST'
        };

        const dockerReq = http.request(options, (dockerRes) => {
            if (dockerRes.statusCode === 204 || dockerRes.statusCode === 200) {
                console.log("Telegraf container restarted successfully via Docker API.");
                res.json({ success: true, message: "Configuration saved and Telegraf restarted successfully." });
            } else {
                console.error("Docker API error restarting telegraf:", dockerRes.statusCode);
                res.status(500).json({ success: false, error: 'Config saved, but failed to restart Telegraf. Docker status: ' + dockerRes.statusCode });
            }
        });

        dockerReq.on('error', (err) => {
            console.error("Failed to connect to Docker socket:", err);
            res.status(500).json({ success: false, error: 'Config saved, but Docker socket connection failed: ' + err.message });
        });

        dockerReq.end();

    } catch (err) {
        console.error("Error saving modbus config:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- User Management ---
const USERS_FILE = './users.json';
let users = [];

// Load users
const loadUsers = () => {
    if (fs.existsSync(USERS_FILE)) {
        try {
            users = JSON.parse(fs.readFileSync(USERS_FILE));
        } catch (e) {
            console.error("Failed to load users:", e);
            users = [];
        }
    } else {
        // Default Admin
        users = [{ id: 1, username: 'admin', password: 'admin', role: 'admin', status: 'active' }];
        saveUsers();
    }
};

const saveUsers = () => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

loadUsers();

// API: List Users
app.get('/api/users', (req, res) => {
    // Return users without passwords
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json(safeUsers);
});

// API: Add User
app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: "Username already exists" });
    }

    const newUser = {
        id: Date.now(),
        username,
        password, // In prod, hash this!
        role: role || 'operator',
        status: 'active'
    };
    users.push(newUser);
    saveUsers();
    res.json({ success: true, user: { ...newUser, password: undefined } });
});

// API: Update User
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, password, role, status } = req.body;

    const index = users.findIndex(u => u.id == id);
    if (index === -1) return res.status(404).json({ error: "User not found" });

    // Update fields
    if (username) users[index].username = username;
    if (password) users[index].password = password; // In prod, hash!
    if (role) users[index].role = role;
    if (status) users[index].status = status;

    saveUsers();
    res.json({ success: true, user: { ...users[index], password: undefined } });
});

// API: Delete User
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = users.length;
    users = users.filter(u => u.id != id);

    if (users.length < initialLength) {
        saveUsers();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

// --- Dashboard Persistence ---
const DASHBOARD_FULL_CONFIG_FILE = './dashboard_layout.json';

// Default Layout (Fallback)
const DEFAULT_DASHBOARD_CONFIG = {
    gauges: [
        { id: 'd2', label: 'PUMP PRESSURE', dataKey: 'pump_pressure', min: 0, max: 5000, unit: 'psi', color: '#fb7185', gridWidth: 3, size: 160 },
        { id: 'd4', label: 'TORQUE', dataKey: 'torque', min: 0, max: 10000, unit: 'ft-lbs', color: '#fbbf24', gridWidth: 3, size: 160 },
        { id: 'd1', label: 'HOOK LOAD', dataKey: 'hook_load', min: 0, max: 100, unit: 'ton', color: '#38bdf8', gridWidth: 6, size: 300, majorTicks: 10, minorTicks: 4 },
        { id: 'd3', label: 'ENGINE RPM', dataKey: 'engine_rpm', min: 0, max: 2000, unit: 'RPM', color: '#34d399', gridWidth: 3, size: 160 },
        { id: 'd5', label: 'TRIP TANK', dataKey: 'trip_tank', min: 0, max: 100, unit: 'm³', color: '#a78bfa', gridWidth: 3, size: 160 },
        { id: 'd6', label: 'RIG AIR PRESSURE', dataKey: 'rig_air_pressure', min: 0, max: 200, unit: 'psi', color: '#22d3ee', gridWidth: 3, size: 160 },
    ],
    sideStats: [
        { key: 'pump_pressure', label: 'Pump Pressure', unit: 'psi', min: 0, max: 5000 },
        { key: 'torque', label: 'Rotary Torque', unit: 'ft-lbs', min: 0, max: 20000 }
    ],
    units: { wob: 'tonnes', depth: 'ft' },
    wellInfo: { well: 'WELL-001', rig: 'RIG-ALPHA' }
};

const getDashboardConfig = () => {
    if (fs.existsSync(DASHBOARD_FULL_CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DASHBOARD_FULL_CONFIG_FILE));
        } catch (e) {
            console.error("Failed to load dashboard config:", e);
        }
    }
    return DEFAULT_DASHBOARD_CONFIG;
};

const saveDashboardConfig = (config) => {
    fs.writeFileSync(DASHBOARD_FULL_CONFIG_FILE, JSON.stringify(config, null, 2));
};

// API: Get Dashboard Layout
app.get('/api/dashboard/layout', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.json(getDashboardConfig());
});

// API: Save Dashboard Layout
app.post('/api/dashboard/layout', (req, res) => {
    const incomingConfig = req.body;
    const existingConfig = getDashboardConfig();

    // Merge existing config with incoming updates
    const mergedConfig = {
        ...existingConfig,
        ...incomingConfig
    };

    saveDashboardConfig(mergedConfig);
    // Real-time broadcast
    io.emit('dashboard_layout_update', mergedConfig);
    res.json({ success: true, config: mergedConfig });
});

// --- Authentication API ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username && u.password === password && u.status !== 'inactive');

    if (user) {
        // Return mock token and user info (excluding password)
        const { password, ...safeUser } = user;
        res.json({
            success: true,
            token: `mock-jwt-token-romii-${user.role}`,
            user: safeUser
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials or account inactive' });
    }
});
