/**
 * =============================================================================
 * CONTROLADOR DE PAGAMENTOS (STRIPE)
 * =============================================================================
 * Responsável por: Checkout session, Webhook de eventos do Stripe,
 * e atualização do status de assinatura do usuário.
 * =============================================================================
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

// Armazenamento em memória para idempotência (em produção, usar Redis ou DB)
const processedEvents = new Map();
const IDEMPOTENCY_WINDOW = 24 * 60 * 60 * 1000; // 24 horas

// Limpa eventos antigos a cada hora
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of processedEvents) {
        if (now - timestamp > IDEMPOTENCY_WINDOW) {
            processedEvents.delete(key);
        }
    }
}, 60 * 60 * 1000);

/**
 * Webhook raw (sem verificação de auth) para receber eventos do Stripe.
 * IMPORTANTE: Rota configurada no app.js ANTES do express.json()
 * Usa raw body para validar assinatura do Stripe.
 * Implementa idempotência para evitar processamento duplicado.
 * 
 * @param {Object} req - Body raw com evento do Stripe
 * @param {Object} res - Confirmação de recebimento
 */
const webhookRaw = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erro no Webhook Signature:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotência: verifica se o evento já foi processado
    const eventKey = `${event.type}-${event.data.object.id}-${event.request?.id || ''}`;
    if (processedEvents.has(eventKey)) {
        console.log(`Evento ${eventKey} já processado, ignorando.`);
        return res.json({ received: true, skipped: true });
    }

    try {
        await processStripeEvent(event);
        processedEvents.set(eventKey, Date.now());
        console.log(`Evento ${event.type} processado com sucesso.`);
    } catch (err) {
        console.error('Erro ao processar evento do Stripe:', err);
        return res.status(500).json({ error: 'Erro ao processar evento' });
    }

    res.json({ received: true });
};

/**
 * Processa eventos do Stripe e atualiza o status da assinatura.
 * Eventos tratados:
 * - customer.subscription.created/updated → Status atualizado
 * - customer.subscription.deleted → Assinatura cancelada
 * - invoice.payment_succeeded → Pagamento confirmado
 * - invoice.payment_failed → Pagamento falhou
 * 
 * @param {Object} event - Evento do Stripe
 */
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
                { 
                    subscriptionStatus: 'inactive',
                    subscriptionId: null
                }
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
 * Cria sessão de checkout do Stripe para assinatura Lumi Pro.
 * Cria customer no Stripe se ainda não existir.
 * 
 * @param {Object} req - userId do middleware
 * @param {Object} res - { url: string } (URL do checkout Stripe)
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

module.exports = { createCheckoutSession, webhook: createCheckoutSession, webhookRaw };
