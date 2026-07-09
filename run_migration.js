const fs = require('fs');
const path = require('path');
const { pool } = require('./src/config/database');

async function runMigration() {
  try {
    console.log('Lecture du fichier SQL...');
    const sqlFile = path.join(__dirname, 'migrations', '009_otp_and_features.sql');
    let sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Remove comments
    sqlContent = sqlContent.replace(/--.*$/gm, '');
    
    // Remplacer IF NOT EXISTS pour l'ALTER TABLE (non supporté sur certains MySQL)
    sqlContent = sqlContent.replace(/ADD COLUMN IF NOT EXISTS/g, 'ADD COLUMN');

    // Split statements by semicolon
    const statements = sqlContent.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.toUpperCase() !== 'COMMIT');

    console.log(`Exécution de ${statements.length} requêtes...`);

    const connection = await pool.getConnection();
    try {
      for (const statement of statements) {
        if (statement) {
          console.log(`Execution: ${statement.substring(0, 50).replace(/\n/g, ' ')}...`);
          try {
            await connection.execute(statement);
          } catch (err) {
            // Ignorer l'erreur si la colonne existe déjà (ER_DUP_FIELDNAME)
            if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
              console.log('Colonne déjà existante, ignorée.');
            } else if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.errno === 1050) {
              console.log('Table déjà existante, ignorée.');
            } else {
              console.error('Erreur SQL:', err.message);
              // On continue quand même l'exécution pour créer le reste
            }
          }
        }
      }
      console.log('Migration 009 terminée avec succès !');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Erreur générale:', err);
  } finally {
    process.exit(0);
  }
}

runMigration();
