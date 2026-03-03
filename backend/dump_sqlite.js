const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/database/romii.db', sqlite3.OPEN_READONLY);

db.all("SELECT * FROM modbus_config", [], (err, rows) => {
    if (err) {
        console.error("Database error:", err.message);
        return;
    }
    rows.forEach(row => {
        try {
            const config = JSON.parse(row.config_json);
            config.slaves.forEach(slave => {
                const coils = slave.registers.filter(r => r.type === 'coil');
                console.log(`SLAVE ${slave.slaveId} COILS:`, JSON.stringify(coils, null, 2));
            });
        } catch (e) {
            console.error("Parse error:", e);
        }
    });
    db.close();
});
