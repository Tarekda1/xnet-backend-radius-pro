# MikroTik Bandwidth Monitoring Setup

This guide explains how to set up real-time bandwidth monitoring from your MikroTik router.

## Prerequisites

1. MikroTik router with RouterOS 6.0 or higher
2. API access enabled on your MikroTik router
3. Network connectivity between your backend server and MikroTik router

## Configuration

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# MikroTik Router Configuration
MIKROTIK_IP=192.168.88.1
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=your_mikrotik_password
MIKROTIK_API_PORT=8728
MIKROTIK_USE_HTTPS=false
MIKROTIK_TIMEOUT=10000
```

### 2. MikroTik Router Setup

#### Enable API Access

1. Log into your MikroTik router via WinBox or WebFig
2. Go to **IP → Services**
3. Enable **API** service (port 8728 for HTTP, 8729 for HTTPS)
4. Go to **IP → Services → API**
5. Set **API SSL** to `yes` if you want to use HTTPS

#### Create API User (Recommended)

1. Go to **System → Users**
2. Click **+** to add a new user
3. Set **Name**: `api-user`
4. Set **Password**: `your_secure_password`
5. Set **Group**: `full` (or create a custom group with limited permissions)
6. Click **OK**

#### Configure Firewall (if needed)

If your backend server is on a different network:

1. Go to **IP → Firewall → Filter Rules**
2. Add a new rule:
   - **Chain**: `input`
   - **Protocol**: `tcp`
   - **Dst Port**: `8728` (or `8729` for HTTPS)
   - **Src Address**: `your_backend_server_ip`
   - **Action**: `accept`

### 3. Testing the Connection

You can test the connection using the API endpoint:

```bash
curl -X GET "http://localhost:3000/api/bandwidth/test" \
  -H "Authorization: Bearer your_jwt_token"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## API Endpoints

### Get Bandwidth Metrics
```
GET /api/bandwidth/metrics
```
Returns comprehensive bandwidth and system data.

### Get Bandwidth Summary
```
GET /api/bandwidth/summary
```
Returns total bandwidth usage across all interfaces.

### Get Interface Traffic
```
GET /api/bandwidth/interfaces
```
Returns traffic data for individual interfaces.

### Get System Resources
```
GET /api/bandwidth/system
```
Returns CPU, memory, and system information.

### Test Connection
```
GET /api/bandwidth/test
```
Tests connectivity to the MikroTik router.

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if API service is enabled on MikroTik
   - Verify the IP address and port
   - Check firewall rules

2. **Authentication Failed**
   - Verify username and password
   - Check if the user has API access permissions
   - Try using the admin account temporarily

3. **No Traffic Data**
   - Ensure interfaces are active
   - Check if traffic monitoring is enabled
   - Verify interface names match RouterOS configuration

### Debug Mode

Enable debug logging by setting the log level in your backend:

```typescript
// In src/logging/logging.ts
Logger.getInstance({ level: 'debug' });
```

### Manual Testing

You can test the MikroTik API directly using curl:

```bash
curl -u "admin:password" \
  -H "Content-Type: application/json" \
  "http://192.168.88.1:8728/rest/system/resource"
```

## Security Considerations

1. **Use HTTPS**: Enable SSL/TLS for API communication
2. **Create API User**: Don't use admin account for API access
3. **Limit Permissions**: Create a custom user group with minimal required permissions
4. **Firewall Rules**: Restrict API access to your backend server only
5. **Strong Passwords**: Use complex passwords for API users

## Performance Notes

- The API refreshes data every 5-15 seconds depending on the endpoint
- Monitor your MikroTik router's CPU usage when enabling API access
- Consider adjusting refresh intervals based on your network size
- Historical data collection requires additional setup (not included in this implementation)

## Next Steps

For production deployment:

1. Set up proper SSL certificates
2. Implement rate limiting on the MikroTik side
3. Add data persistence for historical bandwidth tracking
4. Set up monitoring and alerting for API connectivity
5. Implement backup authentication methods 