import { RouterOSAPI } from 'node-routeros';

const api = new RouterOSAPI({
  host: '172.8.16.2',
  user: 'admin',
  password: '123456',
  port: 8728
});

async function test() {
  try {
    await api.connect();
    const result = await api.write('/system/resource/print');
    console.log('✅ Result:', result);
    await api.close();
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

test();
