const { RouterOSAPI } = require('node-routeros');

const conn = new RouterOSAPI({
  host: '172.8.16.2',
  user: 'apiuser',
  password: '123456',
  port: 8728,
});

async function run() {
  try {
    await conn.connect();
    console.log('✅ Connected to MikroTik');

    const res = await conn.write('/system/resource/print');
    console.log('📊 System Info:', res);

    try {
      const res = await conn.write('/ppp/active/print');
      console.log(res);
    } catch (err) {
      console.error('❌ Failed to get PPP users:', err);
    }


    await conn.close();
  } catch (err) {
    console.error('❌ Failed:', err.message || err);
  }
}

run();
