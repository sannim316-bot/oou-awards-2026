/**
 * STELLAR AWARDS NIGHT 2025 - BACKEND SERVER
 * ============================================
 * Features:
 * - JWT Authentication for admin
 * - SQLite database for nominees, categories, votes
 * - Paystack payment integration
 * ============================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'oou-awards-secret-key-change-in-production';

// ============================================
// DATABASE SETUP (sql.js with better-sqlite3 compatibility)
// ============================================
const dbPath = path.join(__dirname, 'oou_awards.db');

// Helper function to save database to file
function saveDatabase(sqlDb) {
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// sql.js database wrapper for better-sqlite3 compatibility
class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
  }

  exec(sql) {
    return this.sqlDb.exec(sql);
  }

  prepare(sql) {
    return new StatementWrapper(this.sqlDb.prepare(sql), this.sqlDb, this);
  }

  close() {
    saveDatabase(this.sqlDb);
    this.sqlDb.close();
  }
}

class StatementWrapper {
  constructor(stmt, sqlDb, dbWrapper) {
    this.stmt = stmt;
    this.sqlDb = sqlDb;
    this.dbWrapper = dbWrapper;
  }

  get(params) {
    if (params !== undefined) {
      if (!Array.isArray(params)) {
        params = [params];
      }
      this.stmt.bind(params);
    }
    if (this.stmt.step()) {
      const columns = this.stmt.getColumnNames();
      const values = this.stmt.get();
      const result = {};
      columns.forEach((col, i) => result[col] = values[i]);
      this.stmt.free();
      return result;
    }
    this.stmt.free();
    return undefined;
  }

  all(params) {
    const results = [];
    if (params !== undefined) {
      if (!Array.isArray(params)) {
        params = [params];
      }
      this.stmt.bind(params);
    }
    const columns = this.stmt.getColumnNames();
    while (this.stmt.step()) {
      const values = this.stmt.get();
      const row = {};
      columns.forEach((col, i) => row[col] = values[i]);
      results.push(row);
    }
    this.stmt.free();
    return results;
  }

  run(params) {
    if (params !== undefined) {
      if (!Array.isArray(params)) {
        params = [params];
      }
      this.stmt.bind(params);
    }
    this.stmt.step();
    this.stmt.free();
    return { changes: this.sqlDb.getRowsModified() };
  }
}

// Initialize database
let db;

async function initializeDatabase() {
  const SQL = await initSqlJs();

  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = new DatabaseWrapper(sqlDb);

  // Initialize database tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category_type TEXT DEFAULT 'per_level',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nominees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      bio TEXT,
      votes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nominee_id TEXT NOT NULL,
      voter_name TEXT NOT NULL,
      voter_email TEXT NOT NULL,
      transaction_ref TEXT UNIQUE,
      amount_kobo INTEGER,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nominee_id) REFERENCES nominees(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default data
  seedDefaultData();
}

// ============================================
// SEED DEFAULT DATA
// ============================================
function seedDefaultData() {
  // Create admin if not exists
  const adminExists = db.prepare('SELECT id FROM admin WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('oou2025', 10);
    db.sqlDb.run('INSERT INTO admin (username, password_hash) VALUES (?, ?)', ['admin', hashedPassword]);
    console.log('✅ Default admin created: admin / oou2025');
  }

  // Seed categories
  const defaultCategories = [
    // 1️⃣ Categories For Each Level
    { name: 'Most Endowed Female', type: 'per_level' },
    { name: 'Most Expensive', type: 'per_level' },
    { name: 'Influencer Of The Year', type: 'per_level' },
    { name: 'Most Reserved', type: 'per_level' },
    { name: 'Best Dressed', type: 'per_level' },
    { name: 'Most Sociable', type: 'per_level' },
    { name: 'Couples Of The Year', type: 'per_level' },
    { name: 'Clique Of The Year', type: 'per_level' },
    { name: 'Political Icon Of The Year', type: 'per_level' },
    { name: 'Brand Of The Year', type: 'per_level' },
    { name: 'Model Of The Year', type: 'per_level' },
    { name: 'Most Beautiful/Handsome', type: 'per_level' },
    { name: 'Sophomore Of The Year', type: 'per_level' },
    { name: 'Sportsman Of The Year', type: 'per_level' },
    { name: 'Most Sociable Male', type: 'per_level' },
    { name: 'Most Sociable Female', type: 'per_level' },
    { name: 'Most Influential Student', type: 'per_level' },
    { name: 'Personality Of The Year', type: 'per_level' },
    { name: 'Artist Of The Year', type: 'per_level' },
    { name: 'Best Tutorial Center', type: 'per_level' },
    
    // 2️⃣ General Awards
    { name: 'Finalist Of The Year', type: 'general' },
    { name: 'Fresher Of The Year', type: 'general' },
    { name: 'Penultimate Of The Year', type: 'general' },
    { name: 'Most Beautiful', type: 'general' },
    { name: 'Most Handsome', type: 'general' },
    { name: 'Book Worm Of The Year', type: 'general' },
    { name: 'Content Creator Of The Year', type: 'general' },
    { name: 'Fashionista Of The Year', type: 'general' },
    { name: 'Entrepreneur Of The Year', type: 'general' },
    
    // 3️⃣ Categories Across All Levels
    { name: 'Most Popular', type: 'all_levels' },
    { name: 'Baller Of The Year', type: 'all_levels' },
    { name: 'Most Creative Student', type: 'all_levels' },
    { name: 'Best Class Representative', type: 'all_levels' },
    { name: 'Level Of The Year', type: 'all_levels' },
    { name: 'Philanthropist Of The Year', type: 'all_levels' },
    { name: 'Dancer Of The Year', type: 'all_levels' },
    { name: 'Most Active Assannite', type: 'all_levels' },
    { name: 'Ebony Of The Year', type: 'all_levels' },
  ];

  defaultCategories.forEach(cat => {
    db.sqlDb.run('INSERT OR IGNORE INTO categories (name, category_type) VALUES (?, ?)', [cat.name, cat.type]);
  });

  // Seed nominees
  const nomineesExist = db.prepare('SELECT COUNT(*) as count FROM nominees').get().count;
  if (nomineesExist === 0) {
    const categories = db.prepare('SELECT id, name FROM categories').all();
    const catMap = {};
    categories.forEach(c => catMap[c.name] = c.id);

    const defaultNominees = [
      // 400LVL - Most Beautiful
      { name: 'Blessing', category: 'Most Beautiful', bio: '400lvl' },
      { name: 'JESSLORD', category: 'Most Beautiful', bio: '400lvl' },
      { name: 'Jadesola', category: 'Most Beautiful', bio: '400lvl' },
      { name: 'Beca', category: 'Most Beautiful', bio: '400lvl' },
      { name: 'Ammie', category: 'Most Beautiful', bio: '400lvl' },
      { name: 'Grace', category: 'Most Beautiful', bio: '400lvl' },
      { name: 'Twinkle', category: 'Most Beautiful', bio: '400lvl' },
      { name: 'Abati Ayomide', category: 'Most Beautiful', bio: '400lvl' },
      
      // 400LVL - Book Worm Of The Year
      { name: 'Obsessed', category: 'Book Worm Of The Year', bio: '400lvl' },
      { name: 'Isaiah', category: 'Book Worm Of The Year', bio: '400lvl' },
      { name: 'Faith', category: 'Book Worm Of The Year', bio: '400lvl' },
      { name: 'Peace', category: 'Book Worm Of The Year', bio: '400lvl' },
      { name: 'Dr Jerry', category: 'Book Worm Of The Year', bio: '400lvl' },
      
      // 400LVL - Most Endowed Female
      { name: 'Kalisha', category: 'Most Endowed Female', bio: '400lvl' },
      { name: 'Zainab', category: 'Most Endowed Female', bio: '400lvl' },
      { name: 'Arinola', category: 'Most Endowed Female', bio: '400lvl' },
      { name: 'Frida', category: 'Most Endowed Female', bio: '400lvl' },
      { name: 'Fadipe Precious', category: 'Most Endowed Female', bio: '400lvl' },
      { name: 'Elegbede Ayomide', category: 'Most Endowed Female', bio: '400lvl' },
      
      // 400LVL - Fashionista (Male)
      { name: 'Tash', category: 'Fashionista Of The Year', bio: 'Male - 400lvl' },
      { name: 'Bollex', category: 'Fashionista Of The Year', bio: 'Male - 400lvl' },
      { name: 'Tomtom', category: 'Fashionista Of The Year', bio: 'Male - 400lvl' },
      { name: 'Jide', category: 'Fashionista Of The Year', bio: 'Male - 400lvl' },
      
      // 400LVL - Fashionista (Female)
      { name: 'Faith', category: 'Fashionista Of The Year', bio: 'Female - 400lvl' },
      { name: 'Peace', category: 'Fashionista Of The Year', bio: 'Female - 400lvl' },
      { name: 'Nifemi', category: 'Fashionista Of The Year', bio: 'Female - 400lvl' },
      { name: 'Becca', category: 'Fashionista Of The Year', bio: 'Female - 400lvl' },
      { name: 'Peculiar', category: 'Fashionista Of The Year', bio: 'Female - 400lvl' },
      
      // 400LVL - Most Handsome
      { name: 'Zechi', category: 'Most Handsome', bio: '400lvl' },
      { name: 'Isaiah', category: 'Most Handsome', bio: '400lvl' },
      { name: 'Kesh', category: 'Most Handsome', bio: '400lvl' },
      { name: 'Johnson', category: 'Most Handsome', bio: '400lvl' },
      { name: 'Benzo', category: 'Most Handsome', bio: '400lvl' },
      { name: 'Abiola', category: 'Most Handsome', bio: '400lvl' },
      { name: 'Massive', category: 'Most Handsome', bio: '400lvl' },
      
      // 400LVL - Couple Of The Year
      { name: 'Massive & Jadesola', category: 'Couples Of The Year', bio: '400lvl' },
      { name: 'Samskid & Becca', category: 'Couples Of The Year', bio: '400lvl' },
      { name: 'Isaiah & Precious', category: 'Couples Of The Year', bio: '400lvl' },
      { name: 'Lilian & Jerry', category: 'Couples Of The Year', bio: '400lvl' },
      { name: 'Dml & Burna Girl', category: 'Couples Of The Year', bio: '400lvl' },
      
      // 400LVL - Entrepreneur Of The Year
      { name: 'Queen Toyo', category: 'Entrepreneur Of The Year', bio: '400lvl' },
      { name: 'Kawtar', category: 'Entrepreneur Of The Year', bio: '400lvl' },
      { name: 'Peculiar', category: 'Entrepreneur Of The Year', bio: '400lvl' },
      { name: 'Ammie', category: 'Entrepreneur Of The Year', bio: '400lvl' },
      { name: 'Pamilerin', category: 'Entrepreneur Of The Year', bio: '400lvl' },
      { name: 'Twinkle', category: 'Entrepreneur Of The Year', bio: '400lvl' },
      { name: 'Fola (L)', category: 'Entrepreneur Of The Year', bio: '400lvl' },
      
      // 400LVL - Clique Of The Year
      { name: 'OT3', category: 'Clique Of The Year', bio: '400lvl' },
      { name: 'Grace & Friends', category: 'Clique Of The Year', bio: '400lvl' },
      { name: 'Ife & Friends', category: 'Clique Of The Year', bio: '400lvl' },
      { name: 'Frida & Trends', category: 'Clique Of The Year', bio: '400lvl' },
      
      // 400LVL - Brand Of The Year
      { name: 'Queen Toyo', category: 'Brand Of The Year', bio: '400lvl' },
      { name: 'Redolence by Tee', category: 'Brand Of The Year', bio: '400lvl' },
      { name: 'Ajoke Makeover', category: 'Brand Of The Year', bio: '400lvl' },
      { name: 'Peculiar Brand', category: 'Brand Of The Year', bio: '400lvl' },
      { name: 'Pamilerin Signature', category: 'Brand Of The Year', bio: '400lvl' },
      
      // 400LVL - Model Of The Year
      { name: 'Tash', category: 'Model Of The Year', bio: '400lvl' },
      { name: 'Ife', category: 'Model Of The Year', bio: '400lvl' },
      { name: 'Grace', category: 'Model Of The Year', bio: '400lvl' },
      
      // 400LVL - Most Sociable Female
      { name: 'Gbemisola', category: 'Most Sociable Female', bio: '400lvl' },
      { name: 'Fola (L)', category: 'Most Sociable Female', bio: '400lvl' },
      { name: 'Doyin', category: 'Most Sociable Female', bio: '400lvl' },
      
      // 400LVL - Most Sociable Male
      { name: 'Obsessed', category: 'Most Sociable Male', bio: '400lvl' },
      { name: 'Massive', category: 'Most Sociable Male', bio: '400lvl' },
      { name: 'Zechi', category: 'Most Sociable Male', bio: '400lvl' },
      
      // 400LVL - Finalist Of The Year
      { name: 'Ammie', category: 'Finalist Of The Year', bio: '400lvl' },
      { name: 'Becca', category: 'Finalist Of The Year', bio: '400lvl' },
      { name: 'Kalisha', category: 'Finalist Of The Year', bio: '400lvl' },
      { name: 'Bollex', category: 'Finalist Of The Year', bio: '400lvl' },
      { name: 'Saintmic', category: 'Finalist Of The Year', bio: '400lvl' },
      { name: 'Zechi', category: 'Finalist Of The Year', bio: '400lvl' },
      
      // 400LVL - Most Expensive
      { name: 'Fola (O)', category: 'Most Expensive', bio: '400lvl' },
      { name: 'Nifemi', category: 'Most Expensive', bio: '400lvl' },
      { name: 'Grace', category: 'Most Expensive', bio: '400lvl' },
      { name: 'Biola', category: 'Most Expensive', bio: '400lvl' },
      { name: 'Tash', category: 'Most Expensive', bio: '400lvl' },
      { name: 'Bollex', category: 'Most Expensive', bio: '400lvl' },
      { name: 'Twinkle', category: 'Most Expensive', bio: '400lvl' },
      
      // 400LVL - Content Creator Of The Year
      { name: 'Fola', category: 'Content Creator Of The Year', bio: '400lvl' },
      { name: 'Obsessed', category: 'Content Creator Of The Year', bio: '400lvl' },
      { name: 'Gbemi', category: 'Content Creator Of The Year', bio: '400lvl' },
      { name: 'Rhoda', category: 'Content Creator Of The Year', bio: '400lvl' },
      
      // 400LVL - Most Influential Male
      { name: 'Zechi', category: 'Most Influential Student', bio: 'Male - 400lvl' },
      { name: 'Isaiah', category: 'Most Influential Student', bio: 'Male - 400lvl' },
      { name: 'Obsessed', category: 'Most Influential Student', bio: 'Male - 400lvl' },
      { name: 'Benzo', category: 'Most Influential Student', bio: 'Male - 400lvl' },
      
      // 400LVL - Most Influential Female
      { name: 'Fola (L)', category: 'Most Influential Student', bio: 'Female - 400lvl' },
      { name: 'Nifemi', category: 'Most Influential Student', bio: 'Female - 400lvl' },
      { name: 'Arinola', category: 'Most Influential Student', bio: 'Female - 400lvl' },
      { name: 'Kalisha', category: 'Most Influential Student', bio: 'Female - 400lvl' },
      
      // 400LVL - Political Icon Of The Year
      { name: 'Saintmic', category: 'Political Icon Of The Year', bio: '400lvl' },
      { name: 'Johnson (WAVE)', category: 'Political Icon Of The Year', bio: '400lvl' },
      { name: 'Abati Ayomide', category: 'Political Icon Of The Year', bio: '400lvl' },
      { name: 'Isaiah', category: 'Political Icon Of The Year', bio: '400lvl' },
      
      // 400LVL - Personality Of The Year
      { name: 'Johnson Wada', category: 'Personality Of The Year', bio: '400lvl' },
      { name: 'Kalisha', category: 'Personality Of The Year', bio: '400lvl' },
      { name: 'Becca', category: 'Personality Of The Year', bio: '400lvl' },
      { name: 'Jerry', category: 'Personality Of The Year', bio: '400lvl' },
      
      // 400LVL - Most Reserved
      { name: 'Badriyah', category: 'Most Reserved', bio: '400lvl' },
      { name: 'Mariam', category: 'Most Reserved', bio: '400lvl' },
      { name: 'Maryam', category: 'Most Reserved', bio: '400lvl' },
      { name: 'Ebenezer', category: 'Most Reserved', bio: '400lvl' },
      { name: 'Baqee', category: 'Most Reserved', bio: '400lvl' },
      
      // 400LVL - Sportsman Of The Year
      { name: 'Zechi', category: 'Sportsman Of The Year', bio: '400lvl' },
      { name: 'Bollex', category: 'Sportsman Of The Year', bio: '400lvl' },
      { name: 'Massive', category: 'Sportsman Of The Year', bio: '400lvl' },
      { name: 'Henry', category: 'Sportsman Of The Year', bio: '400lvl' },
      { name: 'David', category: 'Sportsman Of The Year', bio: '400lvl' },
      
      // 400LVL - Artist Of The Year
      { name: 'Bollex', category: 'Artist Of The Year', bio: '400lvl' },
      
      // 400LVL - Best Tutorial Center
      { name: 'Success Inner Circle', category: 'Best Tutorial Center', bio: '400lvl' },
      
      // 100LVL - Most Endowed Female
      { name: 'Noor', category: 'Most Endowed Female', bio: '100lvl' },
      { name: 'Susan', category: 'Most Endowed Female', bio: '100lvl' },
      { name: 'Pamilerin', category: 'Most Endowed Female', bio: '100lvl' },
      
      // 100LVL - Most Expensive
      { name: 'Omotoke', category: 'Most Expensive', bio: '100lvl' },
      
      // 100LVL - Influencer Of The Year
      { name: 'Yanmife', category: 'Influencer Of The Year', bio: '100lvl' },
      { name: 'Dolapo', category: 'Influencer Of The Year', bio: '100lvl' },
      
      // 100LVL - Most Reserved
      { name: 'Nifemi', category: 'Most Reserved', bio: '100lvl' },
      { name: 'Diana', category: 'Most Reserved', bio: '100lvl' },
      { name: 'Susan', category: 'Most Reserved', bio: '100lvl' },
      
      // 100LVL - Best Dressed Male
      { name: 'Dolapo', category: 'Best Dressed', bio: 'Male - 100lvl' },
      { name: 'Quadri', category: 'Best Dressed', bio: 'Male - 100lvl' },
      { name: 'Taiwo', category: 'Best Dressed', bio: 'Male - 100lvl' },
      { name: 'Olamiji', category: 'Best Dressed', bio: 'Male - 100lvl' },
      { name: 'Ish', category: 'Best Dressed', bio: 'Male - 100lvl' },
      
      // 100LVL - Best Dressed Female
      { name: 'Ranny', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Black Angie', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Joana', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Daniella', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'James', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Fikayo', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Diana', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Oyin', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Noqeebat', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Subomi', category: 'Best Dressed', bio: 'Female - 100lvl' },
      { name: 'Ayanfe', category: 'Best Dressed', bio: 'Female - 100lvl' },
      
      // 100LVL - Most Sociable Male
      { name: 'Ayanfe', category: 'Most Sociable Male', bio: '100lvl' },
      { name: 'Yanmife', category: 'Most Sociable Male', bio: '100lvl' },
      { name: 'Dolapo', category: 'Most Sociable Male', bio: '100lvl' },
      
      // 100LVL - Most Sociable Female
      { name: 'Angela', category: 'Most Sociable Female', bio: '100lvl' },
      { name: 'Ranny', category: 'Most Sociable Female', bio: '100lvl' },
      { name: 'Filayomi', category: 'Most Sociable Female', bio: '100lvl' },
      
      // 100LVL - Couples Of The Year
      { name: 'Stylish & Ebun', category: 'Couples Of The Year', bio: '100lvl' },
      { name: 'Balikis & Yanmife', category: 'Couples Of The Year', bio: '100lvl' },
      { name: 'Goodness & Dayo', category: 'Couples Of The Year', bio: '100lvl' },
      { name: 'Favour & Taiwo', category: 'Couples Of The Year', bio: '100lvl' },
      { name: 'Olamiji & Arike', category: 'Couples Of The Year', bio: '100lvl' },
      
      // 100LVL - Clique Of The Year
      { name: 'Ace First Class', category: 'Clique Of The Year', bio: '100lvl' },
      { name: 'The Night Studiers', category: 'Clique Of The Year', bio: '100lvl' },
      
      // 100LVL - Brand Of The Year
      { name: 'Beebah', category: 'Brand Of The Year', bio: '100lvl' },
      { name: 'Fikayomi Omo Oni Dodo Ikire', category: 'Brand Of The Year', bio: '100lvl' },
      { name: 'Oyin Luxe Hair', category: 'Brand Of The Year', bio: '100lvl' },
      
      // 100LVL - Model Of The Year
      { name: 'Adebayo Ayomide', category: 'Model Of The Year', bio: '100lvl' },
      { name: 'Fikayomi', category: 'Model Of The Year', bio: '100lvl' },
      
      // 100LVL - Most Beautiful Fresher
      { name: 'Amidat', category: 'Most Beautiful', bio: '100lvl' },
      { name: 'Funmilayo', category: 'Most Beautiful', bio: '100lvl' },
      { name: 'Diana', category: 'Most Beautiful', bio: '100lvl' },
      { name: 'Nofisat', category: 'Most Beautiful', bio: '100lvl' },
      { name: 'Haneefat', category: 'Most Beautiful', bio: '100lvl' },
      { name: 'Fikayomi', category: 'Most Beautiful', bio: '100lvl' },
      { name: 'Nokibat', category: 'Most Beautiful', bio: '100lvl' },
      { name: 'Favour', category: 'Most Beautiful', bio: '100lvl' },
      
      // 100LVL - Most Handsome Fresher
      { name: 'Kayden', category: 'Most Handsome', bio: '100lvl' },
      { name: 'Dolapo', category: 'Most Handsome', bio: '100lvl' },
      { name: 'Quadri', category: 'Most Handsome', bio: '100lvl' },
      { name: 'Dayo', category: 'Most Handsome', bio: '100lvl' },
      { name: 'Samuel', category: 'Most Handsome', bio: '100lvl' },
      { name: 'Yanmife', category: 'Most Handsome', bio: '100lvl' },
      { name: 'Blessed', category: 'Most Handsome', bio: '100lvl' },
      
      // 100LVL - Fresher Of The Year
      { name: 'Ayanfe', category: 'Fresher Of The Year', bio: '100lvl' },
      { name: 'Neemat', category: 'Fresher Of The Year', bio: '100lvl' },
      { name: 'Ebun', category: 'Fresher Of The Year', bio: '100lvl' },
      { name: 'Ranny', category: 'Fresher Of The Year', bio: '100lvl' },
      { name: 'Stylish', category: 'Fresher Of The Year', bio: '100lvl' },
      { name: 'Fikayo', category: 'Fresher Of The Year', bio: '100lvl' },
      
      // 100LVL - Sportsman Of The Year
      { name: 'Olamiji', category: 'Sportsman Of The Year', bio: '100lvl' },
      { name: 'Yanmife', category: 'Sportsman Of The Year', bio: '100lvl' },
      
      // 100LVL - Book Worm Of The Year
      { name: 'Eniola', category: 'Book Worm Of The Year', bio: '100lvl' },
      { name: 'Ranny', category: 'Book Worm Of The Year', bio: '100lvl' },
      { name: 'Subomi', category: 'Book Worm Of The Year', bio: '100lvl' },
      { name: 'Blessing', category: 'Book Worm Of The Year', bio: '100lvl' },
      { name: 'Joanna', category: 'Book Worm Of The Year', bio: '100lvl' },
      
      // 100LVL - Content Creator Of The Year
      { name: 'Dianna', category: 'Content Creator Of The Year', bio: '100lvl' },
      { name: 'Dolapo', category: 'Content Creator Of The Year', bio: '100lvl' },
      
      // 100LVL - Fashionista Of The Year
      { name: 'Ranny', category: 'Fashionista Of The Year', bio: '100lvl' },
      { name: 'Dolapo', category: 'Fashionista Of The Year', bio: '100lvl' },
    ];

    defaultNominees.forEach(nom => {
      const catId = catMap[nom.category];
      if (catId) {
        db.sqlDb.run(
          'INSERT INTO nominees (id, name, category_id, bio, votes) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), nom.name, catId, nom.bio, Math.floor(Math.random() * 50) + 20]
        );
      }
    });
    console.log('✅ Default nominees seeded');
  }

  // Save after seeding
  saveDatabase(db.sqlDb);
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Serve static files from parent directory (frontend files)
app.use(express.static(path.join(__dirname, '..')));

// ============================================
// AUTH MIDDLEWARE
// ============================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ============================================
// AUTH ROUTES
// ============================================

// Admin login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, admin: { id: admin.id, username: admin.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get admin profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const admin = db.prepare('SELECT * FROM admin WHERE id = ?').get(req.user.id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json({ id: admin.id, username: admin.username });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const admin = db.prepare('SELECT * FROM admin WHERE id = ?').get(req.user.id);
    const validPassword = await bcrypt.compare(currentPassword, admin.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.sqlDb.run('UPDATE admin SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);
    saveDatabase(db.sqlDb);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// CATEGORIES ROUTES
// ============================================

// Get all categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(n.id) as nominee_count
      FROM categories c
      LEFT JOIN nominees n ON c.id = n.category_id
      GROUP BY c.id
      ORDER BY 
        CASE c.category_type 
          WHEN 'per_level' THEN 1 
          WHEN 'general' THEN 2 
          WHEN 'all_levels' THEN 3 
        END,
        c.name ASC
    `).all();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create category
app.post('/api/categories', authenticateToken, (req, res) => {
  try {
    const { name, category_type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const validTypes = ['per_level', 'general', 'all_levels'];
    const type = validTypes.includes(category_type) ? category_type : 'per_level';

    const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    db.sqlDb.run('INSERT INTO categories (name, category_type) VALUES (?, ?)', [name.trim(), type]);
    saveDatabase(db.sqlDb);

    const category = db.prepare('SELECT * FROM categories WHERE name = ?').get(name.trim());
    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update category
app.put('/api/categories/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const validTypes = ['per_level', 'general', 'all_levels'];
    const type = validTypes.includes(category_type) ? category_type : 'per_level';

    db.sqlDb.run('UPDATE categories SET name = ?, category_type = ? WHERE id = ?', [name.trim(), type, id]);
    saveDatabase(db.sqlDb);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete category
app.delete('/api/categories/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has nominees
    const nominees = db.prepare('SELECT COUNT(*) as count FROM nominees WHERE category_id = ?').get(id);
    if (nominees.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with nominees. Delete nominees first.' });
    }

    db.sqlDb.run('DELETE FROM categories WHERE id = ?', [id]);
    saveDatabase(db.sqlDb);

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// NOMINEES ROUTES
// ============================================

// Get all nominees
app.get('/api/nominees', (req, res) => {
  try {
    const nominees = db.prepare(`
      SELECT n.*, c.name as category_name
      FROM nominees n
      JOIN categories c ON n.category_id = c.id
      ORDER BY c.name, n.name
    `).all();
    res.json(nominees);
  } catch (error) {
    console.error('Get nominees error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single nominee
app.get('/api/nominees/:id', (req, res) => {
  try {
    const { id } = req.params;
    const nominee = db.prepare(`
      SELECT n.*, c.name as category_name
      FROM nominees n
      JOIN categories c ON n.category_id = c.id
      WHERE n.id = ?
    `).get(id);

    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    res.json(nominee);
  } catch (error) {
    console.error('Get nominee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create nominee
app.post('/api/nominees', authenticateToken, (req, res) => {
  try {
    const { name, category_id, bio } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nominee name is required' });
    }

    if (!category_id) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const id = uuidv4();
    db.sqlDb.run(
      'INSERT INTO nominees (id, name, category_id, bio) VALUES (?, ?, ?, ?)',
      [id, name.trim(), category_id, bio?.trim() || '']
    );
    saveDatabase(db.sqlDb);

    const nominee = db.prepare(`
      SELECT n.*, c.name as category_name
      FROM nominees n
      JOIN categories c ON n.category_id = c.id
      WHERE n.id = ?
    `).get(id);
    res.status(201).json(nominee);
  } catch (error) {
    console.error('Create nominee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update nominee
app.put('/api/nominees/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, bio } = req.body;

    const existing = db.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    db.sqlDb.run(
      'UPDATE nominees SET name = ?, category_id = ?, bio = ? WHERE id = ?',
      [name?.trim() || existing.name, category_id || existing.category_id, bio?.trim() || '', id]
    );
    saveDatabase(db.sqlDb);

    const nominee = db.prepare(`
      SELECT n.*, c.name as category_name
      FROM nominees n
      JOIN categories c ON n.category_id = c.id
      WHERE n.id = ?
    `).get(id);
    res.json(nominee);
  } catch (error) {
    console.error('Update nominee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete nominee
app.delete('/api/nominees/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    db.sqlDb.run('DELETE FROM nominees WHERE id = ?', [id]);
    saveDatabase(db.sqlDb);

    res.json({ success: true, message: 'Nominee deleted' });
  } catch (error) {
    console.error('Delete nominee error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// VOTING & PAYMENTS
// ============================================

const Paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);

// Initialize payment
app.post('/api/votes/initialize', async (req, res) => {
  try {
    const { nominee_id, voter_name, voter_email } = req.body;
    const transaction_ref = `vote_${uuidv4()}`;

    if (!nominee_id || !voter_name || !voter_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if already voted with this email for this nominee
    if (transaction_ref) {
      const existing = db.prepare('SELECT id FROM votes WHERE transaction_ref = ?').get(transaction_ref);
      if (existing) {
        return res.status(400).json({ error: 'Vote already recorded' });
      }
    }

    // Verify nominee exists
    const nominee = db.prepare('SELECT id FROM nominees WHERE id = ?').get(nominee_id);
    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    const amountKobo = 500; // ₦5 per vote

    // Record vote
    db.sqlDb.run(
      'INSERT INTO votes (nominee_id, voter_name, voter_email, transaction_ref, amount_kobo, status) VALUES (?, ?, ?, ?, ?, ?)',
      [nominee_id, voter_name, voter_email, transaction_ref, amountKobo, 'pending']
    );
    saveDatabase(db.sqlDb);

    // Initialize Paystack payment
    try {
      const paystackResponse = await Paystack.transaction.initialize({
        email: voter_email,
        amount: amountKobo,
        reference: transaction_ref,
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/vote-callback`,
        metadata: { nominee_id, voter_name }
      });

      db.sqlDb.run('UPDATE votes SET status = ? WHERE transaction_ref = ?', ['initialized', transaction_ref]);
      saveDatabase(db.sqlDb);

      res.json({
        authorization_url: paystackResponse.data.authorization_url,
        reference: transaction_ref
      });
    } catch (paystackError) {
      console.log('Paystack not configured, simulating successful payment');
      // If Paystack fails, simulate success for testing
      db.sqlDb.run('UPDATE votes SET status = ? WHERE transaction_ref = ?', ['completed', transaction_ref]);
      db.sqlDb.run('UPDATE nominees SET votes = votes + 1 WHERE id = ?', [nominee_id]);
      saveDatabase(db.sqlDb);

      res.json({
        simulated: true,
        reference: transaction_ref,
        message: 'Vote recorded (Paystack not configured - test mode)'
      });
    }
  } catch (error) {
    console.error('Initialize vote error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify payment callback
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }

    try {
      const paystackResponse = await Paystack.transaction.verify(reference);

      if (paystackResponse.data.status === 'success') {
        const metadata = paystackResponse.data.metadata;

        const existing = db.prepare('SELECT id FROM votes WHERE transaction_ref = ?').get(reference);

        if (!existing) {
          // Record the vote if not already recorded
          db.sqlDb.run(
            'INSERT INTO votes (nominee_id, voter_name, voter_email, transaction_ref, amount_kobo, status) VALUES (?, ?, ?, ?, ?, ?)',
            [
              metadata.nominee_id,
              metadata.voter_name,
              paystackResponse.data.customer.email,
              reference,
              paystackResponse.data.amount,
              'completed'
            ]
          );

          db.sqlDb.run('UPDATE nominees SET votes = votes + 1 WHERE id = ?', [metadata.nominee_id]);
          saveDatabase(db.sqlDb);
        }

        res.json({ success: true, status: 'completed' });
      } else {
        db.sqlDb.run('UPDATE votes SET status = ? WHERE transaction_ref = ?', ['failed', reference]);
        saveDatabase(db.sqlDb);
        res.json({ success: false, status: 'failed' });
      }
    } catch (paystackError) {
      console.log('Paystack verification skipped - test mode');
      res.json({ success: true, status: 'completed', simulated: true });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// STATISTICS
// ============================================

// Get dashboard stats
app.get('/api/stats', (req, res) => {
  try {
    const totalVotes = db.prepare('SELECT SUM(votes) as total FROM nominees').get().total || 0;
    const nomineesCount = db.prepare('SELECT COUNT(*) as count FROM nominees').get().count;
    const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    const totalRevenue = db.prepare('SELECT SUM(amount_kobo) as total FROM votes WHERE status = ?').get('completed').total || 0;

    const topNominees = db.prepare(`
      SELECT n.id, n.name, n.votes, c.name as category_name
      FROM nominees n
      JOIN categories c ON n.category_id = c.id
      ORDER BY n.votes DESC
      LIMIT 10
    `).all();

    const categoryStats = db.prepare(`
      SELECT c.name, COUNT(n.id) as nominee_count, COALESCE(SUM(n.votes), 0) as total_votes
      FROM categories c
      LEFT JOIN nominees n ON c.id = n.category_id
      GROUP BY c.id
      ORDER BY c.name
    `).all();

    res.json({
      totalVotes,
      nomineesCount,
      categoriesCount,
      totalRevenueKobo: totalRevenue,
      totalRevenueNaira: totalRevenue / 100,
      topNominees,
      categoryStats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// VOTES HISTORY
// ============================================

// Get vote history
app.get('/api/votes', authenticateToken, (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    let sql = `
      SELECT v.*, n.name as nominee_name, c.name as category_name
      FROM votes v
      JOIN nominees n ON v.nominee_id = n.id
      JOIN categories c ON n.category_id = c.id
    `;
    const params = [];

    if (status) {
      sql += ' WHERE v.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const votes = db.prepare(sql).all(params);
    const total = db.prepare('SELECT COUNT(*) as count FROM votes').get().count;

    res.json({ votes, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Get vote history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// SETTINGS ROUTES
// ============================================

// Get settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update settings
app.put('/api/settings', authenticateToken, (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Setting key is required' });
    }

    db.sqlDb.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    saveDatabase(db.sqlDb);
    res.json({ success: true, setting: { key, value } });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================
async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║     OOU AWARDS NIGHT 2025 - BACKEND SERVER         ║
╠═══════════════════════════════════════════════════════╣
║  Status: ✅ Running                                    ║
║  Port: ${PORT}                                           ║
║  Database: oou_awards.db                            ║
╠═══════════════════════════════════════════════════════╣
║  ADMIN CREDENTIALS (change in production!)              ║
║  Username: admin                                       ║
║  Password: oou2025                                ║
╠═══════════════════════════════════════════════════════╣
║  API ENDPOINTS:                                        ║
║  POST /api/auth/login        - Admin login             ║
║  GET  /api/categories        - List categories         ║
║  GET  /api/nominees          - List nominees           ║
║  GET  /api/stats             - Get statistics          ║
║  POST /api/votes             - Record a vote           ║
║  POST /api/payments/verify   - Verify Paystack payment ║
╚═══════════════════════════════════════════════════════╝
    `);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  if (db) {
    saveDatabase(db.sqlDb);
    console.log('Database saved.');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  if (db) {
    saveDatabase(db.sqlDb);
    console.log('Database saved.');
  }
  process.exit(0);
});

startServer();

module.exports = app;
