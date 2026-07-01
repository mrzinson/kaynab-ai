const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/user/exams',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer placeholder' // I don't have a valid token, but maybe auth middleware blocks it
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
