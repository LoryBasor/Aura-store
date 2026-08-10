const fs = require('fs');
const path = require('path');
const { pool } = require('./src/config/database');

async function runMigration016() {
  try {
    console.log('📦 Migration 016 — wa_outbound_jobs');
    const sqlFile = path.join(__dirname, 'migrations', '016_whatsapp_outbound_queue.sql');
    let sqlContent = fs.readFileSync(sqlFile, 'utf8');

    sqlContent = sqlContent.replace(/--.*$/gm, '');

    const statements = sqlContent.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !['COMMIT', 'USE AURA_STORE_DB', 'USE DEFAULTDB'].includes(s.toUpperCase().trim()));

    console.log(`Exécution de ${statements.length} requêtes...`);

    const connection = await pool.getConnection();
    try {
      for (const statement of statements) {
        console.log(`→ ${statement.substring(0, 70).replace(/\n/g, ' ')}...`);
        try {
          await connection.execute(statement);
          console.log('  ✅ OK');
        } catch (err) {
          if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.errno === 1050) {
            console.log('  ⚠️  Table déjà existante, ignorée.');
          } else {
            console.error('  ❌ Erreur SQL:', err.message);
          }
        }
      }
      console.log('\n✅ Migration 016 terminée avec succès !');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ Erreur générale:', err);
  } finally {
    process.exit(0);
  }
}

runMigration016();
