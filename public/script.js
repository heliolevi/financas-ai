const API_URL = '/api';
let TOKEN = localStorage.getItem('token');
let USERNAME = localStorage.getItem('username');

// UI Elements
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

// Init
if (TOKEN) {
    showDashboard();
}

// Auth Tabs
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

// Auth Submit
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
        alert('Erro na conexão.');
    }
});

function showDashboard() {
    authSection.classList.remove('active');
    dashboardSection.classList.add('active');
    userDisplay.innerText = USERNAME;
    loadTransactions();
}

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    location.reload();
});

// Transactions
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
            loadTransactions();
        } else {
            alert('Erro ao salvar transação.');
        }
    } catch (err) {
        alert('Erro na conexão.');
    }
});

async function loadTransactions() {
    try {
        const res = await fetch(API_URL + '/transactions', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        transactionList.innerHTML = '';
        if (data.length === 0) {
            transactionList.innerHTML = '<p class="empty-msg">Nenhuma transação registrada.</p>';
            return;
        }

        data.forEach(t => {
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
    } catch (err) {
        console.error(err);
    }
}

window.deleteTransaction = async (id) => {
    if (!confirm('Deseja apagar esta transação?')) return;
    try {
        await fetch(API_URL + `/transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        loadTransactions();
    } catch (err) {
        alert('Erro ao apagar.');
    }
}

// AI Chat
sendBtn.addEventListener('click', sendToAI);
aiInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendToAI(); });

async function sendToAI() {
    const message = aiInput.value.trim();
    if (!message) return;

    // Add user message to chat
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
        } else {
            addChatMessage('Erro ao obter resposta da IA. Verifique sua chave API do Groq.', 'ai');
        }
    } catch (err) {
        addChatMessage('Erro na conexão com a IA.', 'ai');
    }
}

function addChatMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = sender === 'ai' ? 'ai-msg' : 'user-msg';
    msg.innerText = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
