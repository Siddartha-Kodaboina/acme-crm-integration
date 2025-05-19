const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/tests/kafka-consumer.test.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the problematic query
content = content.replace(
  "SELECT * FROM event_processing WHERE event_type = $1 AND details->'contactId' = $2",
  "SELECT * FROM event_processing WHERE event_type = $1 AND details->>'contactId' = $2"
);

fs.writeFileSync(filePath, content);
console.log('Fixed SQL query in kafka-consumer.test.js');
