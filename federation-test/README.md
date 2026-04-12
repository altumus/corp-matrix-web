# Federation Testing Guide

## Setup

```bash
cd federation-test
docker compose up -d
```

Wait ~30 seconds for both servers to start.

## Register test users

### Server 1 (server1.localhost:8008)
```bash
curl -s -X POST http://localhost:8008/_matrix/client/v3/register \
  -H "Content-Type: application/json" \
  -d '{"username":"feduser1","password":"testpass123","auth":{"type":"m.login.dummy"}}'
```

### Server 2 (server2.localhost:8009)  
```bash
curl -s -X POST http://localhost:8009/_matrix/client/v3/register \
  -H "Content-Type: application/json" \
  -d '{"username":"feduser2","password":"testpass123","auth":{"type":"m.login.dummy"}}'
```

## Test scenarios

### 1. Cross-server invite
1. Login as `feduser1` on `http://localhost:8008` in Corp Matrix
2. Create a room
3. Invite `@feduser2:server2.localhost` via InviteToRoomDialog
4. Login as `feduser2` on `http://localhost:8009` in another browser tab
5. Accept invite
6. **Expected:** Both users see the room, can exchange messages

### 2. Cross-server messaging
1. Both users in the same federated room
2. Send messages from both sides
3. **Expected:** Messages appear in real-time on both sides

### 3. Cross-server E2E encryption
1. Enable encryption in the federated room
2. Send messages
3. **Expected:** Messages encrypted/decrypted correctly on both sides

### 4. Avatar/profile from other server
1. Set avatar on feduser2 (server2)
2. View member list in feduser1's client
3. **Expected:** feduser2's avatar loads correctly (proxied via server1)

### 5. Presence
1. Both users online
2. **Expected:** Online indicator shows for federated user (may be delayed)

## Cleanup

```bash
docker compose down -v
rm -rf synapse1-data synapse2-data
```

## Notes

- Federation over localhost requires `federation_verify_certificates: false`
- For production: use real domain names with valid TLS certificates
- The `.well-known` delegation or SRV records are needed for production federation
