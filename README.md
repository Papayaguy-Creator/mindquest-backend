# 🚀 MindQuest Backend Server

A complete Node.js/Express backend for handling Stripe webhooks, user authentication, and subscription management.

## ✅ **FEATURES**

### **🔐 Authentication**
- User registration and login
- JWT token-based authentication
- Password hashing with bcrypt

### **💳 Stripe Integration**
- Webhook handling for all subscription events
- Checkout session creation
- Customer portal access
- Usage tracking and plan limits

### **📊 Database**
- SQLite database with automatic table creation
- User management
- Subscription tracking
- Usage monitoring

## **🚀 QUICK START**

### **1. Install Dependencies**
```bash
cd backend
npm install
```

### **2. Environment Setup**
```bash
cp .env.example .env
# Edit .env with your actual values
```

### **3. Start Development Server**
```bash
npm run dev
```

### **4. Production Start**
```bash
npm start
```

## **🌐 API ENDPOINTS**

### **Authentication**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### **Subscriptions**
- `GET /api/subscriptions/status` - Get subscription status
- `POST /api/subscriptions/create-checkout-session` - Create Stripe checkout
- `POST /api/subscriptions/create-portal-session` - Access billing portal
- `POST /api/subscriptions/cancel` - Cancel subscription

### **Usage Tracking**
- `GET /api/usage/stats` - Get usage statistics
- `GET /api/usage/can-use/:feature` - Check feature availability
- `POST /api/usage/increment/:feature` - Track feature usage
- `POST /api/usage/reset` - Reset usage counters

### **Webhooks**
- `POST /api/webhooks/stripe` - Stripe webhook endpoint

## **📋 PLAN LIMITS**

### **Free Plan**
- 2 assessments/month
- 5 journal entries/month
- 3 habit trackings/month
- 1 AI insight/month

### **Pro Plan ($9.99/month)**
- 10 assessments/month
- 50 journal entries/month
- 20 habit trackings/month
- 10 AI insights/month

### **Premium Plan ($29.99/month)**
- Unlimited everything

## **🔗 STRIPE WEBHOOK SETUP**

### **Your Webhook URL:**
```
https://your-domain.com/api/webhooks/stripe
```

### **Required Events:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## **📊 DATABASE SCHEMA**

### **Tables Created Automatically:**
- `users` - User accounts
- `user_subscriptions` - Subscription data
- `user_usage` - Feature usage tracking

## **🔒 SECURITY FEATURES**
- JWT token authentication
- Password hashing
- Stripe webhook signature verification
- CORS protection
- Helmet security headers

## **🚀 DEPLOYMENT**

### **Environment Variables Required:**
```bash
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-production-secret
```

### **Deploy to:**
- **Railway** - `railway up`
- **Heroku** - `git push heroku main`
- **DigitalOcean** - App Platform
- **AWS** - Elastic Beanstalk
- **VPS** - PM2 + Nginx

Your backend is ready for production! 🎉
