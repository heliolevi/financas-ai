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
const upgradeBtn = document.getElementById('upgrade-btn');
const proFeaturesBar = document.getElementById('pro-features-bar');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportExcelBtn = document.getElementById('export-excel-btn');
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const aiInput = document.getElementById('ai-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const installmentGroup = document.getElementById('t-installments-group');
const tPayment = document.getElementById('t-payment');

const mainDashboard = document.getElementById('main-dashboard');
const mainProfile = document.getElementById('main-profile');
const mainGoals = document.getElementById('main-goals');
const navDashboard = document.getElementById('nav-dashboard');
const navProfile = document.getElementById('nav-profile');
const navGoals = document.getElementById('nav-goals');

let isLogin = true;

// Charts
let expensesChart = null;
let savingsChart = null;

// Estado da visualização do histórico (Fatura)
let currentViewDate = new Date();
let viewMonth = currentViewDate.getMonth() + 1; // 1-12
let viewYear = currentViewDate.getFullYear();

let currentTransactions = []; // Armazena transações do mês atual para o delete/cache

// --- INICIALIZAÇÃO SEGURA ---
window.addEventListener('DOMContentLoaded', () => {
    // Define data padrão de hoje no formulário
    const tDate = document.getElementById('t-date');
    if (tDate) tDate.valueAsDate = new Date();

    // Verifica se o usuário já tem um token salvo para pular o login
    if (TOKEN && TOKEN !== 'null' && TOKEN !== 'undefined') {
        showDashboard();
    }
});

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

    const originalBtnText = authBtn.innerText;

    try {
        authBtn.disabled = true;
        authBtn.innerText = 'Processando...';

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
                localStorage.setItem('subscriptionStatus', data.subscriptionStatus);
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
    } finally {
        authBtn.disabled = false;
        authBtn.innerText = originalBtnText;
    }
});

/**
 * Alterna a visualização para o painel principal.
 */
function showDashboard() {
    console.log('--- showDashboard Iniciado ---');
    try {
        if (!authSection || !dashboardSection) {
            console.error('Erro: Seções de Auth/Dashboard não encontradas no DOM');
            return;
        }
        
        authSection.classList.remove('active');
        dashboardSection.classList.add('active');
        console.log('Sessões alternadas com sucesso');

        if (userDisplay) userDisplay.innerText = USERNAME || 'Usuário';

        updateSubscriptionUI(); 
        updateMonthDisplay(); 
        fetchProactiveInsight(USERNAME);
        loadDashboardData();
        console.log('Funções de carga disparadas');
    } catch (e) {
        console.error('CRASH no showDashboard:', e);
    }
}

// Navigation
navDashboard.addEventListener('click', () => {
    mainDashboard.style.display = 'block';
    mainProfile.style.display = 'none';
    mainGoals.style.display = 'none';
    navDashboard.classList.add('active');
    navProfile.classList.remove('active');
    navGoals.classList.remove('active');
});

navProfile.addEventListener('click', () => {
    mainDashboard.style.display = 'none';
    mainProfile.style.display = 'block';
    mainGoals.style.display = 'none';
    navDashboard.classList.remove('active');
    navProfile.classList.add('active');
    navGoals.classList.remove('active');
    loadProfile();
});

navGoals.addEventListener('click', () => {
    mainDashboard.style.display = 'none';
    mainProfile.style.display = 'none';
    mainGoals.style.display = 'block';
    navDashboard.classList.remove('active');
    navProfile.classList.remove('active');
    navGoals.classList.add('active');
    loadGoals();
});

async function loadProfile() {
    try {
        const res = await fetch(API_URL + '/profile', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const user = await res.json();
        
        document.getElementById('p-gross-income').value = user.grossIncome || '';
        document.getElementById('p-net-income').value = user.netIncome || '';
        document.getElementById('p-bank-name').value = user.bankName || '';
        document.getElementById('p-bank-balance').value = user.bankBalance || '';
        document.getElementById('p-cc-limit').value = user.creditCardLimit || '';
        document.getElementById('p-cc-used').value = user.creditCardUsed || '';
        document.getElementById('p-cc-bill').value = user.creditCardBill || '';
        document.getElementById('p-cc-due').value = user.creditCardDueDate || '';
        document.getElementById('p-monthly-budget').value = user.monthlyBudget || '';
        document.getElementById('p-savings-goal').value = user.savingsGoal || '';
        document.getElementById('p-savings-current').value = user.savingsCurrent || '';
        
        renderFixedExpenses(user.fixedExpenses || []);
    } catch (e) {
        console.error('Erro ao carregar perfil:', e);
    }
}

function renderFixedExpenses(expenses) {
    const container = document.getElementById('fixed-expenses-list');
    container.innerHTML = '';
    expenses.forEach((exp, index) => {
        const div = document.createElement('div');
        div.className = 'fixed-expense-item';
        div.innerHTML = `
            <span>${exp.name}: R$ ${exp.amount.toFixed(2)} (Dia ${exp.dueDate})</span>
            <button type="button" onclick="removeFixedExpense(${index})" class="danger-btn">×</button>
        `;
        container.appendChild(div);
    });
}

document.getElementById('add-fixed-expense').addEventListener('click', () => {
    const name = prompt('Nome da despesa (ex: Aluguel, Internet):');
    if (!name) return;
    const amount = parseFloat(prompt('Valor:'));
    if (!amount) return;
    const dueDate = parseInt(prompt('Dia de vencimento (1-31):'));
    if (!dueDate) return;
    
    const container = document.getElementById('fixed-expenses-list');
    const expenses = [];
    container.querySelectorAll('.fixed-expense-item').forEach(item => {
        const text = item.querySelector('span').innerText;
        const match = text.match(/^(.+): R\$ ([\d.,]+) \(Dia (\d+)\)/);
        if (match) {
            expenses.push({
                name: match[1],
                amount: parseFloat(match[2].replace(',', '.')),
                dueDate: parseInt(match[3])
            });
        }
    });
    expenses.push({ name, amount, dueDate });
    renderFixedExpenses(expenses);
});

window.removeFixedExpense = function(index) {
    const container = document.getElementById('fixed-expenses-list');
    const expenses = [];
    container.querySelectorAll('.fixed-expense-item').forEach(item => {
        const text = item.querySelector('span').innerText;
        const match = text.match(/^(.+): R\$ ([\d.,]+) \(Dia (\d+)\)/);
        if (match) {
            expenses.push({
                name: match[1],
                amount: parseFloat(match[2].replace(',', '.')),
                dueDate: parseInt(match[3])
            });
        }
    });
    expenses.splice(index, 1);
    renderFixedExpenses(expenses);
};

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const container = document.getElementById('fixed-expenses-list');
    const expenses = [];
    container.querySelectorAll('.fixed-expense-item').forEach(item => {
        const text = item.querySelector('span').innerText;
        const match = text.match(/^(.+): R\$ ([\d.,]+) \(Dia (\d+)\)/);
        if (match) {
            expenses.push({
                name: match[1],
                amount: parseFloat(match[2].replace(',', '.')),
                dueDate: parseInt(match[3])
            });
        }
    });
    
    const payload = {
        grossIncome: parseFloat(document.getElementById('p-gross-income').value) || 0,
        netIncome: parseFloat(document.getElementById('p-net-income').value) || 0,
        bankName: document.getElementById('p-bank-name').value,
        bankBalance: parseFloat(document.getElementById('p-bank-balance').value) || 0,
        creditCardLimit: parseFloat(document.getElementById('p-cc-limit').value) || 0,
        creditCardUsed: parseFloat(document.getElementById('p-cc-used').value) || 0,
        creditCardBill: parseFloat(document.getElementById('p-cc-bill').value) || 0,
        creditCardDueDate: parseInt(document.getElementById('p-cc-due').value) || 0,
        fixedExpenses: expenses,
        monthlyBudget: parseFloat(document.getElementById('p-monthly-budget').value) || 0,
        savingsGoal: parseFloat(document.getElementById('p-savings-goal').value) || 0,
        savingsCurrent: parseFloat(document.getElementById('p-savings-current').value) || 0
    };
    
    try {
        const res = await fetch(API_URL + '/profile', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            alert('Perfil salvo com sucesso!');
        } else {
            const data = await res.json();
            alert(data.error || 'Erro ao salvar perfil');
        }
    } catch (err) {
        alert('Erro ao salvar perfil');
    }
});

async function loadGoals() {
    try {
        const res = await fetch(API_URL + '/profile/dashboard', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        document.getElementById('goal-monthly').innerText = `R$ ${(data.user.savingsGoal || 0).toFixed(2)}`;
        document.getElementById('goal-current').innerText = `R$ ${(data.user.savingsCurrent || 0).toFixed(2)}`;
        document.getElementById('goal-progress').innerText = `${(data.stats.savingsProgress || 0).toFixed(0)}%`;
        
        document.getElementById('indicator-commitment').style.width = `${Math.min(data.stats.commitmentRate || 0, 100)}%`;
        document.getElementById('indicator-commitment-val').innerText = `${(data.stats.commitmentRate || 0).toFixed(0)}%`;
        document.getElementById('indicator-commitment').style.background = data.stats.commitmentRate > 75 ? 'var(--danger)' : data.stats.commitmentRate > 50 ? 'var(--warning)' : 'var(--accent-gold)';
        
        document.getElementById('indicator-credit').style.width = `${Math.min(data.stats.creditUsage || 0, 100)}%`;
        document.getElementById('indicator-credit-val').innerText = `${(data.stats.creditUsage || 0).toFixed(0)}%`;
        document.getElementById('indicator-credit').style.background = data.stats.creditUsage > 70 ? 'var(--danger)' : data.stats.creditUsage > 50 ? 'var(--warning)' : 'var(--accent-gold)';
        
        document.getElementById('indicator-budget').style.width = `${Math.min(data.stats.budgetUsed || 0, 100)}%`;
        document.getElementById('indicator-budget-val').innerText = `${(data.stats.budgetUsed || 0).toFixed(0)}%`;
        document.getElementById('indicator-budget').style.background = data.stats.budgetUsed > 100 ? 'var(--danger)' : data.stats.budgetUsed > 80 ? 'var(--warning)' : 'var(--accent-gold)';
        
        updateSavingsChart(data.user.savingsGoal || 0, data.user.savingsCurrent || 0);
    } catch (e) {
        console.error('Erro ao carregar metas:', e);
    }
}

async function loadDashboardData() {
    try {
        const res = await fetch(API_URL + '/profile/dashboard', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        if (data.alerts && data.alerts.length > 0) {
            const dangerZone = document.getElementById('danger-zone');
            const dangerMsg = document.getElementById('danger-msg');
            dangerMsg.innerText = data.alerts[0].message;
            dangerZone.classList.add(data.alerts[0].type === 'danger' ? 'active' : '');
        }
    } catch (e) {
        console.error('Erro ao carregar dados do dashboard:', e);
    }
}

/**
 * Busca e exibe o "Oi de boas-vindas" inteligente da Lumi.
 */
async function fetchProactiveInsight(username) {
    try {
        const res = await fetch(API_URL + '/ai/proactive', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        if (data.insight) {
            // Pequeno delay para parecer que a Lumi está digitando após o login
            setTimeout(() => {
                addChatMessage(data.insight, 'ai');
            }, 1500);
        }
    } catch (e) {
        console.error('Erro ao buscar insight proativo:', e);
    }
}

/**
 * Atualiza a interface baseado no status da assinatura.
 */
async function updateSubscriptionUI() {
    const status = localStorage.getItem('subscriptionStatus');
    const username = (localStorage.getItem('username') || '').toLowerCase(); // Normaliza para comparação
    
    // Blindagem de status para o administrador e helio.vieira
    const isPro = status === 'active' || username === 'helio.vieira' || username === 'admin';
    const proBadge = document.querySelector('.pro-badge');

    if (isPro) {
        upgradeBtn.style.display = 'none';
        proFeaturesBar.style.display = 'block';
        if (proBadge) {
            proBadge.innerText = 'PRO';
            proBadge.style.background = 'var(--accent-gold)';
        }
    } else {
        upgradeBtn.style.display = 'block';
        proFeaturesBar.style.display = 'none';
        if (proBadge) {
            proBadge.innerText = 'FREE';
            proBadge.style.background = 'var(--text-dim)';
        }
    }
}

/**
 * --- NAVEGAÇÃO DE FATURAS (MESES) ---
 */
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function updateMonthDisplay() {
    console.log('updateMonthDisplay disparado');
    try {
        const monthDisplay = document.getElementById('current-month-display');
        if (monthDisplay) {
            monthDisplay.innerText = `${monthNames[viewMonth - 1]} ${viewYear}`;
            console.log('Display de mês atualizado para:', monthDisplay.innerText);
        } else {
            console.warn('Elemento current-month-display não encontrado');
        }
        loadTransactions(); 
    } catch (e) {
        console.error('Erro no updateMonthDisplay:', e);
    }
}

// Inicializa os botões de navegação
document.addEventListener('click', (e) => {
    if (e.target.closest('#prev-month')) {
        viewMonth--;
        if (viewMonth < 1) {
             viewMonth = 12;
             viewYear--;
        }
        updateMonthDisplay();
    }
    if (e.target.closest('#next-month')) {
        viewMonth++;
        if (viewMonth > 12) {
             viewMonth = 1;
             viewYear++;
        }
        updateMonthDisplay();
    }
});

/**
 * Funções de Exportação
 */
async function downloadReport(type) {
    try {
        const res = await fetch(`${API_URL}/reports/${type}?month=${viewMonth}&year=${viewYear}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (!res.ok) {
            const data = await res.json();
            return alert(data.message || 'Erro ao gerar relatório.');
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_lumi.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        alert('Erro ao baixar relatório.');
    }
}

exportPdfBtn.addEventListener('click', () => downloadReport('pdf'));
exportExcelBtn.addEventListener('click', () => downloadReport('excel'));

/**
 * Redireciona para a Landing Page de Upgrade (Efeito WOW).
 */
upgradeBtn.addEventListener('click', () => {
    window.location.href = 'upgrade.html';
});

// Verifica se voltou de um pagamento bem-sucedido
if (window.location.search.includes('payment=success')) {
    alert('Parabéns! Agora você é Lumi PRO! 🚀');
    // Força a atualização do status
    fetch(API_URL + '/auth/me', {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    }).then(res => res.json()).then(user => {
        localStorage.setItem('subscriptionStatus', user.subscriptionStatus);
        updateSubscriptionUI();
        // Limpa a URL
        window.history.replaceState({}, document.title, window.location.pathname);
    });
}

/**
 * Limpa o token e recarrega a página.
 */
logoutBtn.addEventListener('click', () => {
    localStorage.clear(); // Limpa tudo (token, username, status)
    window.location.href = 'index.html'; // Garante o redirecionamento limpo
});

// Alterna visibilidade do campo de parcelas
tPayment.addEventListener('change', () => {
    if (tPayment.value === 'Cartão de Crédito') {
        installmentGroup.style.display = 'block';
    } else {
        installmentGroup.style.display = 'none';
        document.getElementById('t-installments').value = 1;
    }
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
        installments: parseInt(document.getElementById('t-installments').value) || 1,
        description: document.getElementById('t-description').value
    };

    const submitBtn = transactionForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Salvando...';

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
            document.getElementById('t-date').valueAsDate = new Date(); // Reseta para hoje
            loadTransactions(); 
            document.getElementById('t-amount').focus(); // Foca no valor para novo registro rápido
        } else {
            const data = await res.json();
            alert(data.message || 'Erro ao salvar transação.');
            if (res.status === 401 || res.status === 403) {
                localStorage.clear();
                window.location.href = 'index.html';
            }
        }
    } catch (err) {
        alert('Erro na conexão com o servidor.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
});

/**
 * Busca a lista de transações e renderiza na tela (Histórico).
 * Dica: Chamamos o dashboard aqui para garantir que os números estejam sempre síncronos.
 */
async function loadTransactions() {
    console.log('loadTransactions iniciando para:', viewMonth, viewYear);
    try {
        const res = await fetch(`${API_URL}/transactions?month=${viewMonth}&year=${viewYear}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        console.log('Transações recebidas:', data.length);
        currentTransactions = data; 
        
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
                    <button class="t-delete" onclick="deleteTransaction('${t.id}')">Apagar</button>
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
        const res = await fetch(API_URL + `/transactions/stats?month=${viewMonth}&year=${viewYear}`, {
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

        // Update Chart
        updateExpensesChart(data.categories);

    } catch (err) {
        console.error('Erro ao carregar estatísticas do dashboard:', err);
    }
}

/**
 * Função global para apagar transação (chamada pelos botões na lista).
 */
window.deleteTransaction = async (id) => {
    // Busca os dados da transação na lista atual para checar se tem grupo
    const transaction = currentTransactions.find(t => t.id === id);
    let url = API_URL + `/transactions/${id}`;

    if (transaction && transaction.group_id) {
        const choice = confirm('Esta transação faz parte de uma compra parcelada. Deseja apagar TODAS as parcelas deste grupo?\n\n[OK] Sim, apagar todas\n[Cancelar] Apagar apenas esta');
        if (choice) {
            url += '?deleteAll=true';
        } else {
            // Se o usuário clicar em cancelar no confirm, mas ainda quiser apagar a individual?
            // O confirm padrão só tem 2 botões. Vamos mudar a lógica:
            const secondConfirm = confirm('Deseja apagar APENAS esta parcela específica?');
            if (!secondConfirm) return;
        }
    } else {
        if (!confirm('Deseja apagar esta transação?')) return;
    }

    try {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (res.ok) {
            loadTransactions();
            loadDashboardStats();
        } else {
            const err = await res.json();
            alert(err.message);
        }
    } catch (e) {
        console.error('Erro ao deletar:', e);
    }
};

// --- CHAT COM A IA (LUMI) ---

sendBtn.addEventListener('click', sendMessage);
aiInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

async function sendMessage() {
    const text = aiInput.value.trim();
    if (!text) return;

    addChatMessage(text, 'user');
    aiInput.value = '';
    
    // Animação do avatar - pensando
    const lumiAvatar = document.getElementById('lumi-avatar');
    const lumiStatus = document.getElementById('lumi-status');
    const lumiTyping = document.getElementById('lumi-typing');
    if (lumiAvatar) {
        lumiAvatar.classList.add('lumi-thinking');
        lumiAvatar.classList.remove('lumi-speaking');
    }
    if (lumiStatus) {
        lumiStatus.classList.add('thinking');
        lumiStatus.classList.remove('offline');
    }
    if (lumiTyping) {
        lumiTyping.style.display = 'flex';
    }
    
    // Indicador visual de carregamento
    const typingMsg = document.createElement('div');
    typingMsg.className = 'ai-msg';
    typingMsg.style.opacity = '0.7';
    typingMsg.innerText = 'Lumi está pensando...';
    chatMessages.appendChild(typingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const res = await fetch(API_URL + '/ai/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ message: text })
        });
        
        chatMessages.removeChild(typingMsg);

        if (!res.ok) throw new Error('Falha na resposta da IA');
        
        const data = await res.json();
        
        // Animação do avatar - falando
        if (lumiAvatar) {
            lumiAvatar.classList.remove('lumi-thinking');
            lumiAvatar.classList.add('lumi-speaking');
        }
        if (lumiStatus) {
            lumiStatus.classList.remove('thinking');
        }
        if (lumiTyping) {
            lumiTyping.style.display = 'none';
        }
        
        // Remove classe de fala após animação
        setTimeout(() => {
            if (lumiAvatar) {
                lumiAvatar.classList.remove('lumi-speaking');
            }
        }, 1000);
        
        addChatMessage(data.response, 'ai');

        if (data.dataChanged) {
            loadTransactions();
            loadDashboardStats();
        }
    } catch (e) {
        if (typingMsg.parentNode) chatMessages.removeChild(typingMsg);
        
        // Reset do avatar em caso de erro
        if (lumiAvatar) {
            lumiAvatar.classList.remove('lumi-thinking', 'lumi-speaking');
        }
        if (lumiStatus) {
            lumiStatus.classList.remove('thinking');
        }
        if (lumiTyping) {
            lumiTyping.style.display = 'none';
        }
        
        addChatMessage("Estou com uma pequena interferência na conexão, meu bem. Pode tentar de novo? ✨", 'ai');
        console.error('Erro AI:', e);
    }
}

/**
 * Adiciona balões na caixa de conversa.
 */
function addChatMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = sender === 'ai' ? 'ai-msg' : 'user-msg';
    
    // Simples renderizador de Markdown para negrito e quebras de linha
    const formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
        
    msg.innerHTML = formattedText;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Avatar interaction - clique para girar
const lumiAvatarWrapper = document.getElementById('lumi-avatar-wrapper');
const lumiAvatar = document.getElementById('lumi-avatar');

if (lumiAvatarWrapper) {
    lumiAvatarWrapper.addEventListener('click', () => {
        if (lumiAvatar) {
            lumiAvatar.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                lumiAvatar.style.transform = '';
            }, 500);
        }
    });
}

// Charts
const chartColors = [
    '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', 
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

function updateExpensesChart(categories) {
    const ctx = document.getElementById('expensesChart');
    if (!ctx) return;
    
    const labels = categories.map(c => c.category);
    const data = categories.map(c => c.amount);
    
    if (expensesChart) {
        expensesChart.destroy();
    }
    
    expensesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: chartColors.slice(0, categories.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff' }
                }
            }
        }
    });
}

function updateSavingsChart(goal, current) {
    const ctx = document.getElementById('savingsChart');
    if (!ctx) return;
    
    if (savingsChart) {
        savingsChart.destroy();
    }
    
    const remaining = Math.max(goal - current, 0);
    
    savingsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Economizado', 'Restante'],
            datasets: [{
                data: [current, remaining],
                backgroundColor: ['#10b981', '#374151'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#fff' }
                }
            }
        }
    });
}
