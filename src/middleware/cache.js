const redis = require('redis');
const client = redis.createClient();

client.on('error', (err) => {
    console.error('Redis error:', err);
});

module.exports = function (req, res, next) {
    const key = req.originalUrl;
    client.get(key, (err, data) => {
        if (err) throw err;

        if (data) {
            res.send(JSON.parse(data));
        } else {
            res.sendResponse = res.send;
            res.send = (body) => {
                client.setex(key, 3600, JSON.stringify(body));
                res.sendResponse(body);
            };
            next();
        }
    });
};
