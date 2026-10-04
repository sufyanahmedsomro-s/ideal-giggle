
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'contacts',
};

const pool = mysql.createPool(dbConfig);
let dbReady = false;

// MySQL container ko start hone mein waqt lagta hai, isliye retry karte hain
async function connectWithRetry(retries = 40) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      await pool.query(
        'CREATE TABLE IF NOT EXISTS contacts (' +
          'id INT AUTO_INCREMENT PRIMARY KEY, ' +
          'username VARCHAR(100) NOT NULL, ' +
          'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
      );
      dbReady = true;
      console.log('Connected to MySQL, table ready');
      return;
    } catch (err) {
      console.log(`DB not ready (attempt ${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error('Could not connect to the database, giving up');
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: dbReady });
});

app.post('/api/contacts', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database abhi ready nahi hai, thori dair baad try karo' });
  const username = String(req.body.username || '').trim();
  if (!username) return res.status(400).json({ error: 'Username khali nahi ho sakta' });
  if (username.length > 100) return res.status(400).json({ error: 'Username 100 characters se chota rakho' });
  try {
    await pool.query('INSERT INTO contacts (username) VALUES (?)', [username]);
    res.status(201).json({ message: 'Contact add ho gaya', username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Contact save nahi ho saka' });
  }
});

app.get('/api/contacts', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'Database abhi ready nahi hai, thori dair baad try karo' });
  try {
    const [rows] = await pool.query('SELECT id, username, created_at FROM contacts ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Contacts load nahi ho sake' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Contact App listening on port ${PORT}`));
connectWithRetry();
