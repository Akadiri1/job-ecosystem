/**
 * =============================================================================
 * PAYMENT CONTROLLER - Stripe Integration
 * =============================================================================
 */

// Plan configurations
const PLANS = {
    free: {
        name: 'Free',
        price: 0,
        job_posts: 3,
        team_members: 5,
        ai_features: false
    },
    starter: {
        name: 'Starter',
        price: 29,
        priceId: process.env.STRIPE_STARTER_PRICE_ID,
        job_posts: 10,
        team_members: 20,
        ai_features: true
    },
    pro: {
        name: 'Pro',
        price: 79,
        priceId: process.env.STRIPE_PRO_PRICE_ID,
        job_posts: -1, // Unlimited
        team_members: 50,
        ai_features: true
    },
    enterprise: {
        name: 'Enterprise',
        price: 199,
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
        job_posts: -1,
        team_members: -1,
        ai_features: true
    }
};

/**
 * GET /api/billing/plans
 * Get available plans
 */
exports.getPlans = async (req, res) => {
    res.json({
        success: true,
        plans: Object.entries(PLANS).map(([key, plan]) => ({
            id: key,
            ...plan,
            priceId: undefined // Don't expose price IDs
        }))
    });
};

/**
 * GET /api/billing/subscription
 * Get current subscription
 */
exports.getSubscription = async (req, res) => {
    try {
        const { Subscription, Company } = req.db_models;
        const userId = req.user.id;
        
        // Get user's company
        const company = await Company.findOne({ where: { owner_id: userId } });
        if (!company) {
            return res.json({ success: true, subscription: null, plan: 'free' });
        }
        
        const subscription = await Subscription.findOne({ where: { company_id: company.id } });
        
        res.json({
            success: true,
            subscription,
            plan: subscription?.plan || 'free',
            limits: PLANS[subscription?.plan || 'free']
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/billing/create-checkout
 * Create Stripe checkout session
 */
exports.createCheckout = async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const { Subscription, Company } = req.db_models;
        const { plan } = req.body;
        const userId = req.user.id;
        
        if (!PLANS[plan] || plan === 'free') {
            return res.status(400).json({ success: false, message: 'Invalid plan' });
        }
        
        const company = await Company.findOne({ where: { owner_id: userId } });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }
        
        // Get or create Stripe customer
        let subscription = await Subscription.findOne({ where: { company_id: company.id } });
        let customerId = subscription?.stripe_customer_id;
        
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                metadata: {
                    company_id: company.id,
                    user_id: userId
                }
            });
            customerId = customer.id;
            
            if (!subscription) {
                subscription = await Subscription.create({
                    company_id: company.id,
                    user_id: userId,
                    stripe_customer_id: customerId,
                    plan: 'free'
                });
            } else {
                subscription.stripe_customer_id = customerId;
                await subscription.save();
            }
        }
        
        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: PLANS[plan].priceId,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.BASE_URL}/dashboard/employer/billing?success=true`,
            cancel_url: `${process.env.BASE_URL}/dashboard/employer/billing?cancelled=true`,
            metadata: {
                company_id: company.id,
                plan: plan
            }
        });
        
        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/billing/create-portal
 * Create Stripe customer portal session
 */
exports.createPortal = async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const { Subscription, Company } = req.db_models;
        const userId = req.user.id;
        
        const company = await Company.findOne({ where: { owner_id: userId } });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }
        
        const subscription = await Subscription.findOne({ where: { company_id: company.id } });
        if (!subscription?.stripe_customer_id) {
            return res.status(404).json({ success: false, message: 'No subscription found' });
        }
        
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${process.env.BASE_URL}/dashboard/employer/billing`
        });
        
        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error('Portal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/billing/webhook
 * Stripe webhook handler
 */
exports.webhook = async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    
    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    const { Subscription, Payment } = req.db_models;
    
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const companyId = session.metadata.company_id;
            const plan = session.metadata.plan;
            
            await Subscription.update({
                plan,
                status: 'active',
                stripe_subscription_id: session.subscription,
                job_posts_limit: PLANS[plan].job_posts,
                team_members_limit: PLANS[plan].team_members,
                ai_features_enabled: PLANS[plan].ai_features
            }, { where: { company_id: companyId } });
            
            console.log(`[BILLING] Company ${companyId} upgraded to ${plan}`);
            break;
        }
        
        case 'invoice.paid': {
            const invoice = event.data.object;
            const customerId = invoice.customer;
            
            const subscription = await Subscription.findOne({ 
                where: { stripe_customer_id: customerId } 
            });
            
            if (subscription) {
                await Payment.create({
                    company_id: subscription.company_id,
                    user_id: subscription.user_id,
                    subscription_id: subscription.id,
                    amount: invoice.amount_paid / 100,
                    currency: invoice.currency.toUpperCase(),
                    status: 'succeeded',
                    stripe_invoice_id: invoice.id,
                    invoice_url: invoice.hosted_invoice_url,
                    receipt_url: invoice.receipt_url,
                    description: `Subscription - ${subscription.plan}`
                });
            }
            break;
        }
        
        case 'customer.subscription.updated': {
            const sub = event.data.object;
            await Subscription.update({
                status: sub.status,
                current_period_start: new Date(sub.current_period_start * 1000),
                current_period_end: new Date(sub.current_period_end * 1000),
                cancel_at_period_end: sub.cancel_at_period_end
            }, { where: { stripe_subscription_id: sub.id } });
            break;
        }
        
        case 'customer.subscription.deleted': {
            const sub = event.data.object;
            await Subscription.update({
                status: 'inactive',
                plan: 'free',
                job_posts_limit: PLANS.free.job_posts,
                team_members_limit: PLANS.free.team_members,
                ai_features_enabled: false
            }, { where: { stripe_subscription_id: sub.id } });
            break;
        }
    }
    
    res.json({ received: true });
};

/**
 * GET /api/billing/payments
 * Get payment history
 */
exports.getPayments = async (req, res) => {
    try {
        const { Payment, Company } = req.db_models;
        const userId = req.user.id;
        
        const company = await Company.findOne({ where: { owner_id: userId } });
        if (!company) {
            return res.json({ success: true, payments: [] });
        }
        
        const payments = await Payment.findAll({
            where: { company_id: company.id },
            order: [['createdAt', 'DESC']],
            limit: 20
        });
        
        res.json({ success: true, payments });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/billing/downgrade
 * Downgrade to free plan
 */
exports.downgrade = async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const { Subscription, Company } = req.db_models;
        const userId = req.user.id;
        
        const company = await Company.findOne({ where: { owner_id: userId } });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }
        
        const subscription = await Subscription.findOne({ where: { company_id: company.id } });
        if (!subscription || subscription.plan === 'free') {
            return res.json({ success: true, message: 'Already on free plan' });
        }
        
        // Cancel at period end
        if (subscription.stripe_subscription_id) {
            await stripe.subscriptions.update(subscription.stripe_subscription_id, {
                cancel_at_period_end: true
            });
        }
        
        subscription.cancel_at_period_end = true;
        await subscription.save();
        
        res.json({ 
            success: true, 
            message: 'Subscription will be cancelled at end of billing period' 
        });
    } catch (error) {
        console.error('Downgrade error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports.PLANS = PLANS;
