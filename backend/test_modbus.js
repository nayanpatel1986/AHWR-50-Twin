const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

client.connectTCP("192.168.0.11", { port: 502 })
    .then(async () => {
        client.setID(1);
        try {
            const data = await client.readCoils(0, 10);
            console.log("Raw Modbus Coils (0-9):");
            data.data.forEach((val, i) => {
                console.log(`Coil ${i.toString().padStart(2, '0')}: ${val ? 1 : 0}`);
            });
        } catch (e) {
            console.error("Error reading coils:", e);
        }
        client.close();
    })
    .catch((e) => {
        console.error("Connection Error:", e);
    });
