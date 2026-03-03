const http = require('http');

const config = {
    slaves: [
        {
            id: Date.now(),
            name: "PLC_1",
            ip: "192.168.1.10",
            port: 502,
            slaveId: 1,
            registers: [
                // --- DRAWWORKS ---
                { name: "HOOK_LOAD", address: 40001, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "BLOCK_POSITION", address: 40002, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "WOB", address: 40003, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "ROP", address: 40004, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "TORQUE", address: 40005, type: "holding_register", dataType: "INT16", scale: 1 },

                // --- MUD PUMPS ---
                { name: "PUMP_PRESSURE", address: 40010, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "SPM_1", address: 40011, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "SPM_2", address: 40012, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "TOTAL_SPM", address: 40013, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "FLOW_IN", address: 40014, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "FLOW_OUT", address: 40015, type: "holding_register", dataType: "INT16", scale: 1 },

                // --- ENGINE ---
                { name: "ENGINE_RPM", address: 40020, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "OIL_PRESSURE", address: 40021, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "OIL_TEMP", address: 40022, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "COOLANT_TEMP", address: 40023, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "EXHAUST_TEMP", address: 40024, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "FUEL_LEVEL", address: 40025, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "BATTERY_VOLTAGE", address: 40026, type: "holding_register", dataType: "INT16", scale: 1 },

                // --- WELL CONTROL ---
                { name: "TUBING_PRESSURE", address: 40030, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "CASING_PRESSURE", address: 40031, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "BOP_PRESSURE", address: 40032, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "ACCUMULATOR_PRESSURE", address: 40033, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "CHOKE_PRESSURE", address: 40034, type: "holding_register", dataType: "INT16", scale: 1 },
                { name: "CHOKE_POSITION", address: 40035, type: "holding_register", dataType: "INT16", scale: 1 },

                // --- DIGITAL INPUTS (STATUS) ---
                { name: "PUMP_1_RUN", address: 10001, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "PUMP_2_RUN", address: 10002, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "ENGINE_RUN", address: 10003, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "SCR_ASSIGNMENT", address: 10004, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "ANNULAR_OPEN", address: 10005, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "PIPE_RAM_OPEN", address: 10006, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "BLIND_RAM_OPEN", address: 10007, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "SHEAR_RAM_OPEN", address: 10008, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "CROWNOMATIC", address: 10009, type: "discrete_input", dataType: "BOOL", scale: 1 },
                { name: "FLOOROMATIC", address: 10010, type: "discrete_input", dataType: "BOOL", scale: 1 }
            ]
        }
    ]
};

const data = JSON.stringify(config);

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/modbus',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);
    });
});

req.on('error', (error) => console.error('Error:', error));
req.write(data);
req.end();
