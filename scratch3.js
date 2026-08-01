const { pool } = require('./src/config/database');
pool.query("ALTER TABLE wa_sessions ADD COLUMN summary_time VARCHAR(5) DEFAULT '20:00'")
  .then(() => { console.log('OK - summary_time column added'); process.exit(0); })
  .catch(e => {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists, skipping.');
    } else {
      console.error('Error:', e.message);
    }
    process.exit(0);
  });
