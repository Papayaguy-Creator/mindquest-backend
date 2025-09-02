# 🚀 Railway Deployment Guide for MindQuest Backend

## 📋 Pre-Deployment Checklist
✅ Files updated for Railway compatibility
✅ Health check endpoint configured
✅ Environment variables documented

## 🔧 Deployment Steps

### 1. Create GitHub Repository
1. Go to [github.com](https://github.com) and create a new repository
2. Name it: `mindquest-backend`
3. Make it **Public** (required for Railway free tier)
4. Upload all files from the `backend/` folder

### 2. Deploy on Railway
1. In Railway, click **"GitHub Repo"**
2. Connect your GitHub account if not already connected
3. Select your `mindquest-backend` repository
4. Railway will auto-detect Node.js and deploy

### 3. Add Environment Variables
In Railway dashboard, go to Variables tab and add:

```
STRIPE_SECRET_KEY=sk_live_your_actual_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret
JWT_SECRET=your-super-secret-jwt-key-here
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production
```

### 4. Get Your URLs
- **API Base URL:** `https://your-app-name.railway.app`
- **Webhook URL:** `https://your-app-name.railway.app/api/webhooks/stripe`
- **Health Check:** `https://your-app-name.railway.app/health`

## 🔗 Update Stripe Webhook
1. Go to Stripe Dashboard → Webhooks
2. Update webhook URL to: `https://your-app-name.railway.app/api/webhooks/stripe`
3. Ensure these events are selected:
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## 🎯 Next Steps After Deployment
1. Test health endpoint: `https://your-app.railway.app/health`
2. Update frontend API calls to use new Railway URL
3. Test Stripe webhook integration
4. Add OpenAI API integration

## 💡 Railway Benefits
- ✅ **Free Tier:** 500 hours/month
- ✅ **Auto HTTPS:** SSL certificates included
- ✅ **Auto Scaling:** Handles traffic spikes
- ✅ **GitHub Integration:** Auto-deploy on push
- ✅ **Environment Variables:** Secure config management