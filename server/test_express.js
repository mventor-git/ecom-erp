const express = require('express');
const app = express();

console.log('>>> CREATING TEST ROUTE <<<');
app.get('/api/test', (req, res) => {
  console.log('>>> TEST ROUTE HIT <<<');
  res.json({ message: 'Test works!' });
});
console.log('>>> TEST ROUTE CREATED <<<');

app.listen(3001, () => {
  console.log('Test server running on port 3001');
});
