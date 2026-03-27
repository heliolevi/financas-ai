const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

/**
 * Cria uma sessão de Checkout do Stripe para assinatura.
 */
const createCheckoutSession = async (req, res) => {
    const userId = req.userId;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

        // Cria ou recupera o cliente no Stripe
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                name: user.username,
                metadata: { userId: user._id.toString() }
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
        }

        // Cria a sessão de checkout
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: process.env.STRIPE_PRICE_ID, // ID do Preço de R$ 20 no Stripe Dashboard
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/index.html?payment=success`,
            cancel_url: `${process.env.FRONTEND_URL}/index.html?payment=cancel`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('ERRO DETALHADO DO STRIPE:', err.message);
        res.status(500).json({ message: 'Erro ao iniciar pagamento: ' + err.message });
    }
};

/**
 * Webhook para receber eventos do Stripe (Aprovação, Cancelamento, etc.)
 */
const webhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // No Render, precisamos do raw body para verificar a assinatura
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erro no Webhook Signature:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lógica por tipo de evento
    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            const subscription = event.data.object;
            await User.findOneAndUpdate(
                { stripeCustomerId: subscription.customer },
                { subscriptionStatus: subscription.status }
            );
            break;
        case 'customer.subscription.deleted':
            const deletedSub = event.data.object;
            await User.findOneAndUpdate(
                { stripeCustomerId: deletedSub.customer },
                { subscriptionStatus: 'inactive' }
            );
            break;
    }

    res.json({ received: true });
};

module.exports = { createCheckoutSession, webhook };
