const request = require('supertest');
const app = require('../app'); // Assuming your Express app is exported from app.js

describe('GET /protected', () => {
    it('should return 401 if no token is provided', async () => {
        const res = await request(app).get('/protected');
        expect(res.statusCode).toBe(401);
    });

    // ...additional tests...
});
