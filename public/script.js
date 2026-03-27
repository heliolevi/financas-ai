const API_URL = '/api';
let TOKEN = localStorage.getItem('token');
let USERNAME = localStorage.getItem('username');

// --- ELEMENTOS DA INTERFACE (DOM) ---
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const authBtn = document.getElementById('auth-btn');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const aiInput = document.getElementById('ai-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

let isLogin = true;

// --- INICIALIZAÇÃO ---
// Verifica se o usuário já tem um token salvo para pular o login
if (TOKEN) {
    showDashboard();
}

// Alterna entre abas de Login e Cadastro
loginTab.addEventListener('click', () => {
    isLogin = true;
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    authBtn.innerText = 'Entrar';
});

registerTab.addEventListener('click', () => {
    isLogin = false;
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    authBtn.innerText = 'Criar Conta';
});

// --- AUTENTICAÇÃO ---
/**
 * Lida com o envio do formulário de login/registro.
 * Dica: Armazenamos o Token no localStorage para persistir a sessão.
 */
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
        const res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            if (isLogin) {
                TOKEN = data.token;
                USERNAME = data.username;
                localStorage.setItem('token', TOKEN);
                localStorage.setItem('username', USERNAME);
                showDashboard();
            } else {
                alert('Conta criada! Agora faça o login.');
                loginTab.click();
            }
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Erro na conexão com o servidor.');
    }
});

/**
 * Alterna a visualização para o painel principal.
 */
function showDashboard() {
    authSection.classList.remove('active');
    dashboardSection.classList.add('active');
    userDisplay.innerText = USERNAME;
    loadTransactions();
}

/**
 * Limpa o token e recarrega a página.
 */
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    location.reload();
});

// --- TRANSAÇÕES (MÉTODOS MANUAIS) ---

/**
 * Cadastra um novo gasto via formulário manual.
 */
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        amount: parseFloat(document.getElementById('t-amount').value),
        date: document.getElementById('t-date').value,
        category: document.getElementById('t-category').value,
        payment_method: document.getElementById('t-payment').value,
        description: document.getElementById('t-description').value
    };

    try {
        const res = await fetch(API_URL + '/transactions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            transactionForm.reset();
            loadTransactions(); // Recarrega a lista e o dashboard
        } else {
            alert('Erro ao salvar transação de forma manual.');
        }
    } catch (err) {
        alert('Erro na conexão.');
    }
});

/**
 * Busca a lista de transações e renderiza na tela (Histórico).
 * Dica: Chamamos o dashboard aqui para garantir que os números estejam sempre síncronos.
 */
async function loadTransactions() {
    try {
        const res = await fetch(API_URL + '/transactions', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        let total = 0;
        transactionList.innerHTML = '';
        if (data.length === 0) {
            transactionList.innerHTML = '<p class="empty-msg">Nenhuma transação registrada.</p>';
            document.getElementById('total-amount').innerText = 'R$ 0,00';
            loadDashboardStats(); 
            return;
        }

        data.forEach(t => {
            total += t.amount;
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <div class="t-info">
                    <h4>${t.category}</h4>
                    <span>${t.description || ''} • ${t.date} • ${t.payment_method}</span>
                </div>
                <div class="t-details">
                    <div class="t-amount">R$ ${t.amount.toFixed(2)}</div>
                    <button class="t-delete" onclick="deleteTransaction(${t.id})">Apagar</button>
                </div>
            `;
            transactionList.appendChild(item);
        });

        document.getElementById('total-amount').innerText = `R$ ${total.toFixed(2)}`;
        loadDashboardStats(); // Atualiza os cards coloridos e os alertas
    } catch (err) {
        console.error(err);
    }
}

// --- DASHBOARD E ANÁLISE ---

/**
 * Coleta os dados agregados para atualizar os cards de estatísticas.
 * Lida com o cálculo do "Perigo" no cartão de crédito.
 */
async function loadDashboardStats() {
    try {
        const res = await fetch(API_URL + '/transactions/stats', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();

        // Atualiza Cards de Resumo
        document.getElementById('stat-total').innerText = `R$ ${data.total.toFixed(2)}`;
        
        const topCat = data.categories.length > 0 ? data.categories[0].category : '-';
        document.getElementById('stat-top-cat').innerText = topCat;

        // Lógica de Alerta de Perigo no Crédito (> 60% do total)
        const creditData = data.payments.find(p => p.payment_method === 'Cartão de Crédito');
        const creditAmount = creditData ? creditData.amount : 0;
        const creditPct = data.total > 0 ? (creditAmount / data.total) * 100 : 0;
        
        const creditEl = document.getElementById('stat-credit-pct');
        creditEl.innerText = `${creditPct.toFixed(0)}%`;
        
        const dangerZone = document.getElementById('danger-zone');
        if (creditPct > 60) {
            creditEl.className = 'stat-value danger';
            dangerZone.classList.add('active'); // Mostra a faixa vermelha
        } else {
            creditEl.className = 'stat-value safe';
            dangerZone.classList.remove('active'); // Oculta a faixa
        }

        // Renderiza as Barras de Progresso por Categoria
        const categoryList = document.getElementById('category-list');
        categoryList.innerHTML = '';
        data.categories.forEach(cat => {
            const pct = (cat.amount / data.total) * 100;
            const row = document.createElement('div');
            row.className = 'category-row';
            row.innerHTML = `
                <div class="category-info">
                    <span>${cat.category}</span>
                    <span>R$ ${cat.amount.toFixed(2)} (${pct.toFixed(0)}%)</span>
                </div>
                <div class="progress-bg">
                    <div class="progress-fill" style="width: ${pct}%"></div>
                </div>
            `;
            categoryList.appendChild(row);
        });

    } catch (err) {
        console.error('Erro ao carregar estatísticas do dashboard:', err);
    }
}

/**
 * Função global para apagar transação (chamada pelos botões na lista).
 */
window.deleteTransaction = async (id) => {
    if (!confirm('Deseja apagar esta transação?')) return;
    try {
        await fetch(API_URL + `/transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        loadTransactions();
    } catch (err) {
        alert('Erro ao apagar registro.');
    }
}

// --- CHAT COM A IA (LUMI) ---

sendBtn.addEventListener('click', sendToAI);
aiInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendToAI(); });

/**
 * Envia a mensagem para a Lumi e processa a resposta.
 * Dica: Se a Lumi salvar/deletar algo, o flag 'transactionAdded' virá como true.
 */
async function sendToAI() {
    const message = aiInput.value.trim();
    if (!message) return;

    addChatMessage(message, 'user');
    aiInput.value = '';

    try {
        const res = await fetch(API_URL + '/ai/analyze', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ message })
        });
        const data = await res.json();
        
        if (res.ok) {
            addChatMessage(data.response, 'ai');
            // Recarrega tudo se a IA tiver alterado dados do banco
            if (data.transactionAdded) {
                loadTransactions();
            }
        } else {
            addChatMessage('Erro ao obter resposta da IA. Verifique sua chave API do Groq.', 'ai');
        }
    } catch (err) {
        addChatMessage('Erro na conexão com a IA financeira.', 'ai');
    }
}

/**
 * Adiciona balões na caixa de conversa.
 */
function addChatMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = sender === 'ai' ? 'ai-msg' : 'user-msg';
    msg.innerText = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
}
