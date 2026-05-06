const { pool } = require('../src/config/database');

async function migrate() {
  try {
    console.log('Adding admin_disabled column to products...');
    await pool.execute('ALTER TABLE products ADD COLUMN admin_disabled BOOLEAN DEFAULT FALSE');
    console.log('Success!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
