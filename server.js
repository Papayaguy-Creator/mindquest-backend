const express = require('express');
const stripe = require('stripe');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./database');
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');
const usageRoutes = require('./routes/usage');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'MindQuest Backend API'
  });
});

// Stripe webhook endpoint (must be before body parser)
app.post('/api/webhooks/stripe', 
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Verify webhook signature
      event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Received Stripe event:', event.type);

    try {
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;
        
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionChange(event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Regular middleware for other routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/usage', usageRoutes);

// Webhook event handlers
async function handleCheckoutCompleted(session) {
  console.log('Checkout completed:', session.id);
  
  const customerEmail = session.customer_details?.email;
  const subscriptionId = session.subscription;
  
  if (!customerEmail) {
    console.error('No customer email found in checkout session');
    return;
  }

  try {
    // Find user by email
    const user = await db.getUserByEmail(customerEmail);
    if (!user) {
      console.error('User not found:', customerEmail);
      return;
    }

    // Update user subscription
    await db.updateUserSubscription(user.id, {
      stripe_customer_id: session.customer,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      updated_at: new Date().toISOString()
    });

    console.log('Subscription updated for user:', user.id);
  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

async function handleSubscriptionChange(subscription) {
  console.log('Subscription changed:', subscription.id, subscription.status);
  
  // Determine plan type based on price
  let planType = 'free';
  if (subscription.items?.data?.[0]?.price?.unit_amount) {
    const amount = subscription.items.data[0].price.unit_amount;
    if (amount === 999) planType = 'pro';
    else if (amount === 2999) planType = 'premium';
  }

  try {
    await db.updateSubscriptionByStripeId(subscription.id, {
      status: subscription.status,
      plan_type: planType,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  try {
    await db.updateSubscriptionByStripeId(subscription.id, {
      status: 'canceled',
      plan_type: 'free',
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded:', invoice.id);
  
  try {
    // Reset usage counters on successful payment
    await db.updateSubscriptionByStripeId(invoice.subscription, {
      last_payment_date: new Date().toISOString(),
      payment_status: 'active',
      updated_at: new Date().toISOString()
    });

    // Reset monthly usage for this user
    const subscription = await db.getSubscriptionByStripeId(invoice.subscription);
    if (subscription) {
      await db.resetUserUsage(subscription.user_id);
    }
  } catch (error) {
    console.error('Error updating payment status:', error);
  }
}

async function handlePaymentFailed(invoice) {
  console.log('Payment failed:', invoice.id);
  
  try {
    await db.updateSubscriptionByStripeId(invoice.subscription, {
      payment_status: 'failed',
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating payment failure:', error);
  }
}

// Initialize database and start server
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 MindQuest Backend Server running on port ${PORT}`);
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/api/webhooks/stripe`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

module.exports = app;