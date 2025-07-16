import socket
import struct
import json

def write_varint(value):
    """Encodes an integer as a VarInt."""
    out = b""
    while True:
        temp = value & 0b01111111
        value >>= 7
        if value != 0:
            temp |= 0b10000000
        out += struct.pack("B", temp)
        if value == 0:
            break
    return out

def write_string(s):
    """Encodes a string with a VarInt length prefix."""
    encoded = s.encode('utf-8')
    return write_varint(len(encoded)) + encoded

def read_varint(s):
    """Reads a VarInt from a socket."""
    num = 0
    for i in range(5):  # Max length of VarInt is 5 bytes
        byte = s.recv(1)
        if not byte:
            raise IOError("Connection closed while reading VarInt")
        val = byte[0]
        num |= (val & 0x7F) << (7 * i)
        if not (val & 0x80):
            break
    return num

def ping_server(ip, port, timeout=0.1,hostname=None):
    """Pings a Minecraft server and prints its status."""
    try:
        with socket.create_connection((ip, port), timeout=timeout) as s:
            # ---- Handshake packet ----
            protocol_version = 764  # For Minecraft 1.20.4
            next_state = 1  # status

            hostname = hostname if hostname else ip

            handshake_data = (
                write_varint(0x00) +                      # Packet ID for handshake
                write_varint(protocol_version) +          # Protocol version
                write_string(hostname) +                        # Server address (hostname)
                struct.pack('>H', port) +                 # Server port
                write_varint(next_state)                  # Next state
            )

            handshake_packet = write_varint(len(handshake_data)) + handshake_data
            s.sendall(handshake_packet)

            # ---- Status Request packet ----
            request_data = write_varint(0x00)  # Packet ID 0 (status request)
            request_packet = write_varint(len(request_data)) + request_data
            s.sendall(request_packet)

            # ---- Read response ----
            s.settimeout(2)
            length = read_varint(s)
            response_packet_id = read_varint(s)
            json_length = read_varint(s)
            response_data = b''
            while len(response_data) < json_length:
                chunk = s.recv(json_length - len(response_data))
                if not chunk:
                    raise IOError("Connection closed while reading JSON response")
                response_data += chunk
            response_data = response_data.decode('utf-8')

            # Parse JSON response
            status = json.loads(response_data)
            return (ip, port, status)

    except Exception as e:
        # print(f"[X] - Error pinging {ip}:{port} - {e}\n",end="")
        return None
ip = "hub_4.minefort.com"
server = ping_server(ip,25565,hostname=ip)
print(server)
for player in server[2].get("players", {}).get("sample"):
    print(f"Player: {player.get('name')} - UUID: {player.get('id')}")