// scripts/createSuperAdmin.js
/**
 * Script de création d'un compte Super Admin
 * USAGE: node scripts/createSuperAdmin.js
 * 
 * Ce script doit être exécuté UNIQUEMENT en ligne de commande
 * JAMAIS via une route API publique
 */

const readline = require('readline');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BCRYPT_ROUNDS = 12;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createSuperAdmin() {
  console.log('');
  console.log('===========================================');
  console.log('🔐 CRÉATION D\'UN COMPTE SUPER ADMIN');
  console.log('===========================================');
  console.log('');

  try {
    // Connexion à la base de données
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'saas_vendor_db'
    });

    console.log('✅ Connexion à la base de données réussie\n');

    // Demander les informations
    const email = await question('📧 Email du Super Admin: ');
    const password = await question('🔑 Mot de passe (min 8 caractères): ');
    const confirmPassword = await question('🔑 Confirmer le mot de passe: ');
    const businessName = await question('🏢 Nom (ex: Admin Principal): ');

    // Validations
    if (!email || !email.includes('@')) {
      throw new Error('Email invalide');
    }

    if (password.length < 8) {
      throw new Error('Le mot de passe doit faire au moins 8 caractères');
    }

    if (password !== confirmPassword) {
      throw new Error('Les mots de passe ne correspondent pas');
    }

    // Vérifier si l'email existe déjà
    const [existing] = await connection.execute(
      'SELECT id, role FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      if (existing[0].role === 'SUPER_ADMIN') {
        throw new Error('Un Super Admin avec cet email existe déjà');
      } else {
        throw new Error('Cet email est déjà utilisé par un vendeur');
      }
    }

    console.log('\n⏳ Création du compte en cours...\n');

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Créer le Super Admin
    await connection.execute(
      `INSERT INTO users 
       (email, password_hash, business_name, role, account_status, is_active, store_slug)
       VALUES (?, ?, ?, 'SUPER_ADMIN', 'active', TRUE, ?)`,
      [email, passwordHash, businessName, `admin-${Date.now()}`]
    );

    console.log('===========================================');
    console.log('✅ SUPER ADMIN CRÉÉ AVEC SUCCÈS !');
    console.log('===========================================');
    console.log('');
    console.log(`📧 Email: ${email}`);
    console.log(`🏢 Nom: ${businessName}`);
    console.log(`🔐 Rôle: SUPER_ADMIN`);
    console.log('');
    console.log('⚠️  IMPORTANT:');
    console.log('   - Conservez ces identifiants en lieu sûr');
    console.log('   - Ne partagez jamais ce compte');
    console.log('   - Utilisez ce compte uniquement pour l\'administration');
    console.log('');

    await connection.end();
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.log('');
    rl.close();
    process.exit(1);
  }
}

// Confirmation avant exécution
async function main() {
  console.log('⚠️  Vous êtes sur le point de créer un compte Super Admin.');
  console.log('Ce compte aura un accès total à la plateforme.\n');
  
  const confirm = await question('Voulez-vous continuer ? (oui/non): ');
  
  if (confirm.toLowerCase() === 'oui' || confirm.toLowerCase() === 'o') {
    await createSuperAdmin();
  } else {
    console.log('\n❌ Opération annulée');
    rl.close();
    process.exit(0);
  }
}

main();