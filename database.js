const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'mindquest.db');

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('📊 Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // User subscriptions table
      `CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT UNIQUE,
        status TEXT DEFAULT 'free' CHECK (status IN ('free', 'active', 'canceled', 'past_due', 'trialing')),
        plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'premium')),
        current_period_start DATETIME,
        current_period_end DATETIME,
        last_payment_date DATETIME,
        payment_status TEXT DEFAULT 'active' CHECK (payment_status IN ('active', 'failed', 'pending')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // User usage table
      `CREATE TABLE IF NOT EXISTS user_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        feature_type TEXT NOT NULL CHECK (feature_type IN ('assessment', 'journal_entry', 'habit_tracking', 'ai_insights')),
        usage_count INTEGER DEFAULT 0,
        last_reset_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, feature_type)
      )`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription ON user_subscriptions(stripe_subscription_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_usage_feature_type ON user_usage(feature_type)`
    ];

    for (const query of queries) {
      await this.run(query);
    }

    console.log('✅ Database tables created successfully');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // User methods
  async createUser(email, passwordHash, name) {
    const id = uuidv4();
    await this.run(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
      [id, email, passwordHash, name]
    );
    return this.getUserById(id);
  }

  async getUserById(id) {
    return this.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async getUserByEmail(email) {
    return this.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  // Subscription methods
  async updateUserSubscription(userId, subscriptionData) {
    const existing = await this.get('SELECT * FROM user_subscriptions WHERE user_id = ?', [userId]);
    
    if (existing) {
      const updates = Object.keys(subscriptionData).map(key => `${key} = ?`).join(', ');
      const values = Object.values(subscriptionData);
      values.push(userId);
      
      return this.run(
        `UPDATE user_subscriptions SET ${updates} WHERE user_id = ?`,
        values
      );
    } else {
      const id = uuidv4();
      const columns = ['id', 'user_id', ...Object.keys(subscriptionData)];
      const placeholders = columns.map(() => '?').join(', ');
      const values = [id, userId, ...Object.values(subscriptionData)];
      
      return this.run(
        `INSERT INTO user_subscriptions (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
    }
  }

  async updateSubscriptionByStripeId(stripeSubscriptionId, subscriptionData) {
    const updates = Object.keys(subscriptionData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(subscriptionData);
    values.push(stripeSubscriptionId);
    
    return this.run(
      `UPDATE user_subscriptions SET ${updates} WHERE stripe_subscription_id = ?`,
      values
    );
  }

  async getSubscriptionByStripeId(stripeSubscriptionId) {
    return this.get('SELECT * FROM user_subscriptions WHERE stripe_subscription_id = ?', [stripeSubscriptionId]);
  }

  async getUserSubscription(userId) {
    return this.get('SELECT * FROM user_subscriptions WHERE user_id = ?', [userId]);
  }

  // Usage methods
  async incrementUsage(userId, featureType) {
    const existing = await this.get(
      'SELECT * FROM user_usage WHERE user_id = ? AND feature_type = ?',
      [userId, featureType]
    );

    if (existing) {
      await this.run(
        'UPDATE user_usage SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND feature_type = ?',
        [userId, featureType]
      );
      return existing.usage_count + 1;
    } else {
      const id = uuidv4();
      await this.run(
        'INSERT INTO user_usage (id, user_id, feature_type, usage_count) VALUES (?, ?, ?, 1)',
        [id, userId, featureType]
      );
      return 1;
    }
  }

  async getUserUsage(userId) {
    return this.all('SELECT * FROM user_usage WHERE user_id = ?', [userId]);
  }

  async resetUserUsage(userId) {
    return this.run(
      'UPDATE user_usage SET usage_count = 0, last_reset_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );
  }

  async resetAllUsage() {
    return this.run(
      'UPDATE user_usage SET usage_count = 0, last_reset_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP'
    );
  }
}

module.exports = new Database();