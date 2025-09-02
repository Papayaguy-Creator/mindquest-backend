const express = require('express');
const stripe = require('stripe');
const { authenticateToken } = require('./auth');
const db = require('../database');

const router = express.Router();
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Get user subscription status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const subscription = await db.getUserSubscription(req.user.userId);
    
    if (!subscription) {
      return res.json({
        status: 'free',
        plan_type: 'free',
        current_period_end: null,
        stripe_customer_id: null
      });
    }

    res.json({
      status: subscription.status,
      plan_type: subscription.plan_type,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      payment_status: subscription.payment_status,
      stripe_customer_id: subscription.stripe_customer_id
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Stripe checkout session
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has a Stripe customer ID
    let customerId;
    const existingSubscription = await db.getUserSubscription(req.user.userId);
    
    if (existingSubscription && existingSubscription.stripe_customer_id) {
      customerId = existingSubscription.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/subscription?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/subscription?canceled=true`,
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
        metadata: {
          userId: user.id
        }
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Stripe customer portal session
router.post('/create-portal-session', authenticateToken, async (req, res) => {
  try {
    const subscription = await db.getUserSubscription(req.user.userId);
    
    if (!subscription || !subscription.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/subscription`,
    });

    res.json({ url: portalSession.url });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const subscription = await db.getUserSubscription(req.user.userId);
    
    if (!subscription || !subscription.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel at period end
    await stripeClient.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    res.json({ message: 'Subscription will be canceled at the end of the current period' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;