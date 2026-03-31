/**
 * =============================================================================
 * CONTROLADOR DE PAGAMENTOS (STRIPE)
 * =============================================================================
 */

const User = require('../models/User');

let stripe = null;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        console.log('✅ Stripe inicializado com sucesso');
    } else {
        console.warn('⚠️ STRIPE_SECRET_KEY não configurada');
    }
} catch (err) {
    console.error('❌ Erro ao inicializar Stripe:', err.message);
}

// Armazenamento em memória para idempotência
const processedEvents = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of processedEvents) {
        if (now - timestamp > 24 * 60 * 60 * 1000) {
            processedEvents.delete(key);
        }
    }
}, 60 * 60 * 1000);

/**
 * Webhook raw para receber eventos do Stripe
 */
const webhookRaw = async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe não configurado' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erro Webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const eventKey = `${event.type}-${event.data.object.id}-${event.request?.id || ''}`;
    if (processedEvents.has(eventKey)) {
        return res.json({ received: true, skipped: true });
    }

    try {
        await processStripeEvent(event);
        processedEvents.set(eventKey, Date.now());
    } catch (err) {
        console.error('Erro ao processar evento:', err);
        return res.status(500).json({ error: 'Erro ao processar evento' });
    }

    res.json({ received: true });
};

async function processStripeEvent(event) {
    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            await User.findOneAndUpdate(
                { stripeCustomerId: subscription.customer },
                { 
                    subscriptionStatus: subscription.status,
                    subscriptionId: subscription.id,
                    subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000)
                }
            );
            break;
        }
        case 'customer.subscription.deleted': {
            const deletedSub = event.data.object;
            await User.findOneAndUpdate(
                { stripeCustomerId: deletedSub.customer },
                { subscriptionStatus: 'inactive', subscriptionId: null }
            );
            break;
        }
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object;
            await User.findOneAndUpdate(
                { stripeCustomerId: invoice.customer },
                { 
                    subscriptionStatus: 'active',
                    subscriptionCurrentPeriodEnd: new Date(invoice.period_end * 1000)
                }
            );
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            await User.findOneAndUpdate(
                { stripeCustomerId: invoice.customer },
                { subscriptionStatus: 'past_due' }
            );
            break;
        }
    }
}

/**
 * Cria sessão de checkout - VERSÃO SIMPLES E DIRETA
 */
const createCheckoutSession = async (req, res) => {
    console.log('📦 createCheckoutSession chamado');
    console.log('   userId:', req.userId);
    console.log('   STRIPE_PRICE_ID:', process.env.STRIPE_PRICE_ID);
    
    if (!stripe) {
        console.error('❌ Stripe não está inicializado');
        return res.status(503).json({ message: 'Stripe não configurado no servidor' });
    }

    try {
        const userId = req.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            console.error('❌ Usuário não encontrado:', userId);
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        console.log('   usuário:', user.username);

        // Cria cliente no Stripe se não existir
        let customerId = user.stripeCustomerId;
        
        if (!customerId) {
            console.log('   criando customer no Stripe...');
            const customer = await stripe.customers.create({
                name: user.username,
                metadata: { userId: user._id.toString() }
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
            console.log('   customer criado:', customerId);
        }

        // Cria sessão de checkout
        console.log('   criando sessão de checkout...');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: process.env.STRIPE_PRICE_ID,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${frontendUrl}/index.html?payment=success`,
            cancel_url: `${frontendUrl}/index.html?payment=cancel`
        });

        console.log('   ✅ sessão criada:', session.url);
        res.json({ url: session.url });
        
    } catch (err) {
        console.error('❌ ERRO NO CHECKOUT:', err);
        console.error('   stack:', err.stack);
        res.status(500).json({ message: 'Erro ao criar sessão: ' + err.message });
    }
};

module.exports = { createCheckoutSession, webhookRaw };