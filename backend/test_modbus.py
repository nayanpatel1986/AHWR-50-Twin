import sys
from pymodbus.client import ModbusTcpClient

def check_modbus():
    client = ModbusTcpClient('192.168.0.11', port=502)
    client.connect()
    
    # Read coils 0 through 9
    result = client.read_coils(0, 10, slave=1)
    
    if result.isError():
        print(f"Error reading Modbus: {result}")
    else:
        print("Raw Modbus Coils (0-9):")
        for i, bit in enumerate(result.bits[:10]):
            print(f"Coil {i:02d}: {1 if bit else 0}")
            
    client.close()

if __name__ == "__main__":
    check_modbus()
