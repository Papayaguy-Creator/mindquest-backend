const express = require('express');
const { authenticateToken } = require('./auth');
const db = require('../database');

const router = express.Router();

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    assessment: 2,
    journal_entry: 5,
    habit_tracking: 3,
    ai_insights: 1
  },
  pro: {
    assessment: 10,
    journal_entry: 50,
    habit_tracking: 20,
    ai_insights: 10
  },
  premium: {
    assessment: -1, // unlimited
    journal_entry: -1,
    habit_tracking: -1,
    ai_insights: -1
  }
};

// Get user usage statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const usage = await db.getUserUsage(req.user.userId);
    const subscription = await db.getUserSubscription(req.user.userId);
    
    const planType = subscription ? subscription.plan_type : 'free';
    const limits = PLAN_LIMITS[planType];

    const usageStats = {};
    
    // Initialize all feature types
    Object.keys(PLAN_LIMITS.free).forEach(feature => {
      const userUsage = usage.find(u => u.feature_type === feature);
      usageStats[feature] = {
        used: userUsage ? userUsage.usage_count : 0,
        limit: limits[feature],
        unlimited: limits[feature] === -1,
        percentage: limits[feature] === -1 ? 0 : Math.min(100, ((userUsage ? userUsage.usage_count : 0) / limits[feature]) * 100)
      };
    });

    res.json({
      planType,
      usage: usageStats,
      lastResetDate: usage.length > 0 ? usage[0].last_reset_date : null
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user can use a feature
router.get('/can-use/:feature', authenticateToken, async (req, res) => {
  try {
    const { feature } = req.params;
    
    if (!PLAN_LIMITS.free[feature]) {
      return res.status(400).json({ error: 'Invalid feature type' });
    }

    const usage = await db.getUserUsage(req.user.userId);
    const subscription = await db.getUserSubscription(req.user.userId);
    
    const planType = subscription ? subscription.plan_type : 'free';
    const limits = PLAN_LIMITS[planType];
    
    const userUsage = usage.find(u => u.feature_type === feature);
    const currentUsage = userUsage ? userUsage.usage_count : 0;
    const limit = limits[feature];
    
    const canUse = limit === -1 || currentUsage < limit;
    
    res.json({
      canUse,
      currentUsage,
      limit,
      unlimited: limit === -1,
      planType
    });
  } catch (error) {
    console.error('Check feature usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Increment usage for a feature
router.post('/increment/:feature', authenticateToken, async (req, res) => {
  try {
    const { feature } = req.params;
    
    if (!PLAN_LIMITS.free[feature]) {
      return res.status(400).json({ error: 'Invalid feature type' });
    }

    // Check if user can use this feature
    const usage = await db.getUserUsage(req.user.userId);
    const subscription = await db.getUserSubscription(req.user.userId);
    
    const planType = subscription ? subscription.plan_type : 'free';
    const limits = PLAN_LIMITS[planType];
    
    const userUsage = usage.find(u => u.feature_type === feature);
    const currentUsage = userUsage ? userUsage.usage_count : 0;
    const limit = limits[feature];
    
    if (limit !== -1 && currentUsage >= limit) {
      return res.status(403).json({ 
        error: 'Usage limit exceeded',
        currentUsage,
        limit,
        planType
      });
    }

    // Increment usage
    const newUsage = await db.incrementUsage(req.user.userId, feature);
    
    res.json({
      success: true,
      newUsage,
      limit,
      unlimited: limit === -1,
      planType
    });
  } catch (error) {
    console.error('Increment usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset usage (admin endpoint)
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    // In a real app, you'd want to check if user is admin
    await db.resetUserUsage(req.user.userId);
    
    res.json({ message: 'Usage reset successfully' });
  } catch (error) {
    console.error('Reset usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;