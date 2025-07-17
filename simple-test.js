const MikroNode = require('mikronode');

const device = new MikroNode('172.8.16.2');
device.connect('apiuser', '123456').then(([login]) => {
  console.log('✅ Logged in');

  const chan = login.openChannel('sys');
  chan.write('/system/resource/print');

  chan.on('done', data => {
    const parsed = MikroNode.resultsToObj(data);
    console.log('📊 System Info:', parsed);
    login.close();
  });

  chan.on('trap', trap => console.error('🚨 Trap:', trap));
  chan.on('error', err => console.error('❌ Channel error:', err));
}).catch(err => {
  console.error('❌ Connection failed:', err.message || err);
});
