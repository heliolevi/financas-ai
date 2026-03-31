/**
 * =============================================================================
 * FINANÇAS AI - LUMI GOLD (FRONTEND)
 * =============================================================================
 * Script principal do frontend - Gerencia toda a interface do usuário.
 * Inclui: autenticação, dashboard, transações, chat com IA, gráficos,
 * importação de extratos e exportação de relatórios.
 * 
 * ESTRUTURA DO CÓDIGO:
 * 1. Constantes e Configuração (API_URL, TOKEN, username)
 * 2. Seleção de Elementos DOM
 * 3. Inicialização (DOMContentLoaded)
 * 4. Autenticação (login, register, logout)
 * 5. Navegação (tabs, sidebar, bottom nav)
 * 6. Dashboard (loadDashboardData, loadDashboardStats)
 * 7. Transações (form, list, delete, import)
 * 8. IA/Lumi (chat, send message)
 * 9. Gráficos (Chart.js)
 * 10. Utilitários
 * =============================================================================
 */

const API_URL = '/api';
let TOKEN = localStorage.getItem('token');
let USERNAME = localStorage.getItem('username');

// ==========================================
// SEGURANÇA: PREVENÇÃO DE XSS
// ==========================================

/**
 * Escapa caracteres HTML para prevenir XSS.
 * Usado em qualquer texto que venha do usuário.
 * 
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto seguro para exibir
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Renderiza HTML seguro em um elemento.
 * 
 * @param {HTMLElement} element - Elemento destino
 * @param {string} html - HTML a ser renderizado
 */
function safeInnerHTML(element, html) {
    element.innerHTML = html;
}

// ==========================================
// SELEÇÃO DE ELEMENTOS DOM
// ==========================================

// Seção de autenticação
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const authBtn = document.getElementById('auth-btn');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');

// Elementos potencialmente ausentes na UI simplificada
const upgradeBtn = document.getElementById('upgrade-btn');
const proFeaturesBar = document.getElementById('pro-features-bar');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportExcelBtn = document.getElementById('export-excel-btn');

// Log de elementos faltantes (debug)
if (!upgradeBtn) console.log('upgradeBtn não existe (simplified UI)');
if (!proFeaturesBar) console.log('proFeaturesBar não existe (simplified UI)');
if (!exportPdfBtn) console.log('exportPdfBtn não existe');
if (!exportExcelBtn) console.log('exportExcelBtn não existe');

// Formulário e lista de transações
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');

// Chat com Lumi
const aiInput = document.getElementById('ai-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

// Elementos de formulário removidos na UI simplificada
const installmentGroup = document.getElementById('t-installments-group');
const tPayment = document.getElementById('t-payment');
if (!installmentGroup) console.log('installmentGroup não existe (simplified UI)');
if (!tPayment) console.log('tPayment não existe (simplified UI)');

// Abas/Tabs principais
const mainDashboard = document.getElementById('main-dashboard');
const mainProfile = document.getElementById('main-profile');
const mainGoals = document.getElementById('main-goals');
const mainAnalytics = document.getElementById('main-analytics');
const navDashboard = document.getElementById('nav-dashboard');
const navProfile = document.getElementById('nav-profile');
const navGoals = document.getElementById('nav-goals');
const navAnalytics = document.getElementById('nav-analytics');

let isLogin = true;

// Charts
let expensesChart = null;
let savingsChart = null;
let predictionChart = null;

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

// Analytics Functions
async function loadAnalytics() {
    loadPrediction();
    loadSubscriptions();
    loadAchievements();
}

async function loadPrediction() {
    try {
        const res = await fetch(API_URL + '/analytics/predict', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        document.getElementById('pred-avg').innerText = `R$ ${(data.prediction.expectedMonthly || 0).toFixed(2)}`;
        document.getElementById('pred-projected').innerText = `R$ ${(data.prediction.projectedCurrentMonth || 0).toFixed(2)}`;
        document.getElementById('pred-total').innerText = `R$ ${(data.prediction.totalProjected || 0).toFixed(2)}`;
        
        const surplusEl = document.getElementById('pred-surplus');
        const surplus = data.prediction.surplusDeficit || 0;
        surplusEl.innerText = `R$ ${Math.abs(surplus).toFixed(2)}`;
        surplusEl.className = surplus >= 0 ? 'pred-value positive' : 'pred-value negative';
        surplusEl.innerText = (surplus >= 0 ? '+' : '-') + surplusEl.innerText.slice(2);
        
        const insightsDiv = document.getElementById('prediction-insights');
        insightsDiv.innerHTML = '';
        (data.insights || []).forEach(insight => {
            const div = document.createElement('div');
            div.className = `pred-insight ${escapeHtml(insight.type)}`;
            div.innerHTML = `<span>${insight.type === 'warning' ? '⚠️' : insight.type === 'success' ? '🎉' : 'ℹ️'}</span> ${escapeHtml(insight.text)}`;
            insightsDiv.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar previsão:', e);
    }
}

async function loadSubscriptions() {
    try {
        const res = await fetch(API_URL + '/analytics/subscriptions', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        const list = document.getElementById('subscriptions-list');
        list.innerHTML = '';
        
        (data.subscriptions || []).forEach(sub => {
            const div = document.createElement('div');
            div.className = 'subs-item';
            div.innerHTML = `
                <div>
                    <div class="subs-name">${escapeHtml(sub.name)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-dim)">${escapeHtml(sub.category)} • ${escapeHtml(sub.frequency)}</div>
                </div>
                <div class="subs-amount">R$ ${sub.avgAmount.toFixed(2)}</div>
            `;
            list.appendChild(div);
        });
        
        document.getElementById('subs-total').innerText = `R$ ${(data.summary.monthlyTotal || 0).toFixed(2)}`;
        document.getElementById('subs-yearly').innerText = `R$ ${(data.summary.yearlyEstimate || 0).toFixed(2)}`;
    } catch (e) {
        console.error('Erro ao carregar assinaturas:', e);
    }
}

const achievements = [
    { id: 'first_expense', name: 'Primeiro Passo', desc: 'Registre sua 1ª despesa', icon: '🎯' },
    { id: 'ten_expenses', name: 'Começando Bem', desc: '10 despesas', icon: '📝' },
    { id: 'fifty_expenses', name: 'Organizado', desc: '50 despesas', icon: '🏆' },
    { id: 'hundred_expenses', name: 'Mestre Financeiro', desc: '100 despesas', icon: '👑' },
    { id: 'goal_25', name: 'Quarto do caminho', desc: '25% da meta', icon: '🎯' },
    { id: 'goal_50', name: 'Metade do caminho', desc: '50% da meta', icon: '🚀' },
    { id: 'goal_100', name: 'Missão Cumprida', desc: '100% da meta', icon: '🏅' },
    { id: 'under_budget', name: 'Within Limits', desc: 'No orçamento', icon: '✅' },
    { id: 'low_card', name: 'Cartão Controlado', desc: '<30% cartão', icon: '💳' },
    { id: 'import_data', name: 'Importador', desc: 'Importe extrato', icon: '📥' }
];

async function loadAchievements() {
    try {
        const res = await fetch(API_URL + '/profile/dashboard', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        const unlocked = [];
        if ((data.stats.transactionCount || 0) >= 1) unlocked.push('first_expense');
        if ((data.stats.transactionCount || 0) >= 10) unlocked.push('ten_expenses');
        if ((data.stats.transactionCount || 0) >= 50) unlocked.push('fifty_expenses');
        if ((data.stats.transactionCount || 0) >= 100) unlocked.push('hundred_expenses');
        if ((data.stats.savingsProgress || 0) >= 25) unlocked.push('goal_25');
        if ((data.stats.savingsProgress || 0) >= 50) unlocked.push('goal_50');
        if ((data.stats.savingsProgress || 0) >= 100) unlocked.push('goal_100');
        if ((data.stats.budgetUsed || 0) <= 100) unlocked.push('under_budget');
        if ((data.stats.creditUsage || 0) < 30) unlocked.push('low_card');
        
        const progress = (unlocked.length / achievements.length) * 100;
        
        document.getElementById('achievement-badge').innerText = `${Math.round(progress)}%`;
        document.getElementById('achievement-count').innerText = `${unlocked.length} de ${achievements.length} conquistas`;
        document.getElementById('achievement-fill').style.width = `${progress}%`;
        
        const grid = document.getElementById('achievements-grid');
        grid.innerHTML = '';
        achievements.forEach(a => {
            const isUnlocked = unlocked.includes(a.id);
            const div = document.createElement('div');
            div.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
            div.innerHTML = `
                <div class="achievement-icon">${a.icon}</div>
                <div class="achievement-name">${a.name}</div>
                <div class="achievement-desc">${a.desc}</div>
            `;
            grid.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar conquistas:', e);
    }
}

// Import Functions
document.getElementById('import-btn')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        document.getElementById('import-result').innerHTML = 'Selecione um arquivo primeiro!';
        document.getElementById('import-result').className = 'error';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target.result;
            let fileType = 'csv';
            if (file.name.endsWith('.ofx')) fileType = 'ofx';
            else if (file.name.endsWith('.xml')) fileType = 'xml';
            else if (content.includes('<OFX>')) fileType = 'ofx';
            else if (content.trim().startsWith('<?xml') || content.includes('<extrato>')) fileType = 'xml';
            
            const res = await fetch(API_URL + '/transactions/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({ fileContent: content, fileType })
            });
            
            const data = await res.json();
            
            const importResult = document.getElementById('import-result');
            importResult.innerHTML = escapeHtml(data.message || `${data.imported} transações importadas!`);
            importResult.className = 'success';
            
            loadTransactions();
            loadDashboardStats();
        } catch (err) {
            const importResult = document.getElementById('import-result');
            importResult.innerHTML = 'Erro ao importar: ' + escapeHtml(err.message);
            importResult.className = 'error';
        }
    };
    reader.readAsText(file);
});

document.getElementById('refresh-prediction')?.addEventListener('click', loadPrediction);

// --- AUTENTICAÇÃO ---
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
        loadDashboardData();
        loadDashboardStats();
        loadDailySummary();
        loadTransactions();
        fetchProactiveInsight(USERNAME);
        console.log('Funções de carga disparadas');
    } catch (e) {
        console.error('CRASH no showDashboard:', e);
    }
}

// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const headerNav = document.getElementById('header-nav');

// Tab navigation system
const tabs = ['dashboard', 'transactions', 'profile', 'goals', 'analytics'];

function switchTab(tabName) {
    tabs.forEach(t => {
        const mainEl = document.getElementById(`main-${t}`);
        if (mainEl) mainEl.classList.remove('active');
        
        const sidebarBtn = document.querySelector(`#nav-${t}`);
        if (sidebarBtn) sidebarBtn.classList.remove('active');
        
        const bottomBtn = document.querySelector(`.bottom-nav-item[data-tab="${t}"]`);
        if (bottomBtn) bottomBtn.classList.remove('active');
    });
    
    const activeMain = document.getElementById(`main-${tabName}`);
    if (activeMain) activeMain.classList.add('active');
    
    const activeSidebar = document.querySelector(`#nav-${tabName}`);
    if (activeSidebar) activeSidebar.classList.add('active');
    
    const activeBottom = document.querySelector(`.bottom-nav-item[data-tab="${tabName}"]`);
    if (activeBottom) activeBottom.classList.add('active');
    
    if (tabName === 'dashboard') {
        loadDashboardStats();
        loadDailySummary();
    } else if (tabName === 'profile') {
        loadProfile();
    } else if (tabName === 'goals') {
        loadGoals();
    } else if (tabName === 'analytics') {
        loadAnalytics();
    }
}

// Sidebar navigation
document.getElementById('nav-dashboard')?.addEventListener('click', () => switchTab('dashboard'));
document.getElementById('nav-transactions')?.addEventListener('click', () => switchTab('transactions'));
document.getElementById('nav-profile')?.addEventListener('click', () => switchTab('profile'));
document.getElementById('nav-goals')?.addEventListener('click', () => switchTab('goals'));
document.getElementById('nav-analytics')?.addEventListener('click', () => switchTab('analytics'));

// Bottom navigation (mobile)
document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('active');
    });
}

// Logout handled by doLogout() below

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
    if (!container) return;
    container.innerHTML = '';
    expenses.forEach((exp, index) => {
        const div = document.createElement('div');
        div.className = 'fixed-expense-item';
        div.innerHTML = `
            <span>${escapeHtml(exp.name)}: R$ ${exp.amount.toFixed(2)} (Dia ${exp.dueDate})</span>
            <button type="button" onclick="removeFixedExpense(${index})" class="danger-btn">×</button>
        `;
        container.appendChild(div);
    });
}

function removeFixedExpense(index) {
    const container = document.getElementById('fixed-expenses-list');
    const items = container.querySelectorAll('.fixed-expense-item');
    if (items[index]) {
        items[index].remove();
    }
}
window.removeFixedExpense = removeFixedExpense;

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

        loadProactiveAlerts();
    } catch (e) {
        console.error('Erro ao carregar dados do dashboard:', e);
    }
}

async function loadProactiveAlerts() {
    try {
        const res = await fetch(API_URL + '/profile/alerts', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const alerts = await res.json();
        
        const container = document.getElementById('proactive-alerts');
        if (!container) return;
        
        if (alerts.length > 0) {
            container.innerHTML = alerts.map(alert => `
                <div class="proactive-alert ${escapeHtml(alert.type)}" data-action="${escapeHtml(alert.action)}">
                    <div class="alert-icon">
                        ${alert.type === 'danger' ? '🚨' : alert.type === 'warning' ? '⚠️' : alert.type === 'success' ? '🎉' : 'ℹ️'}
                    </div>
                    <div class="alert-content">
                        <strong>${escapeHtml(alert.title)}</strong>
                        <span>${escapeHtml(alert.message)}</span>
                    </div>
                </div>
            `).join('');
            container.style.display = 'block';
            
            container.querySelectorAll('.proactive-alert').forEach(el => {
                el.addEventListener('click', () => {
                    const action = el.dataset.action;
                    if (action === 'view_card') {
                        document.getElementById('nav-profile')?.click();
                    } else if (action === 'view_budget') {
                        document.getElementById('nav-profile')?.click();
                    }
                });
            });
        } else {
            container.style.display = 'none';
        }
    } catch (e) {
        console.error('Erro ao carregar alertas proativos:', e);
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
    const username = (localStorage.getItem('username') || '').toLowerCase();
    
    const isPro = status === 'active' || username === 'helio.vieira' || username === 'admin';
    const proBadge = document.querySelector('.pro-badge');

    if (isPro) {
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        if (proFeaturesBar) proFeaturesBar.style.display = 'block';
        if (proBadge) {
            proBadge.innerText = 'PRO';
            proBadge.style.background = 'var(--accent-gold)';
        }
    } else {
        if (upgradeBtn) upgradeBtn.style.display = 'block';
        if (proFeaturesBar) proFeaturesBar.style.display = 'none';
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
function doLogout() {
    TOKEN = null;
    USERNAME = null;
    localStorage.clear();
    window.location.href = 'index.html';
}

logoutBtn.addEventListener('click', doLogout);

// Handle removed HTML elements gracefully
if (tPayment) {
    tPayment.addEventListener('change', () => {
        if (tPayment.value === 'Cartão de Crédito' && installmentGroup) {
            installmentGroup.style.display = 'block';
        } else if (installmentGroup) {
            installmentGroup.style.display = 'none';
        }
    });
}

// --- TRANSAÇÕES (MÉTODOS MANUAIS) ---

/**
 * Cadastra um novo gasto via formulário manual.
 */
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tAmount = document.getElementById('t-amount');
    const tCategory = document.getElementById('t-category');
    const tDescription = document.getElementById('t-description');
    const tPayment = document.getElementById('t-payment');
    const tDate = document.getElementById('t-date');
    
    const payload = {
        amount: parseFloat(tAmount.value),
        date: tDate ? tDate.value : new Date().toISOString().split('T')[0],
        category: tCategory ? tCategory.value : 'Outros',
        payment_method: tPayment ? tPayment.value : 'Cartão de Crédito',
        installments: 1,
        description: tDescription ? tDescription.value : ''
    };

    const submitBtn = transactionForm.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerText : 'Registrar';

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Salvando...';
        }

        const res = await fetch(API_URL + '/transactions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (tAmount) tAmount.value = '';
            if (tDescription) tDescription.value = '';
            loadTransactions(); 
            loadDashboardStats();
            loadDailySummary();
            
            if (tAmount) tAmount.focus();
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
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    }
});

/**
 * Busca a lista de transações e renderiza na tela (Histórico).
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
        const listEl = document.getElementById('transaction-list');
        const fullListEl = document.getElementById('transaction-list-full');
        
        if (!listEl) {
            console.warn('Elemento transaction-list não encontrado');
            return;
        }
        
        if (data.length === 0) {
            listEl.innerHTML = '<p class="empty-msg">Nenhuma transação registrada.</p>';
            if (fullListEl) fullListEl.innerHTML = '<p class="empty-msg">Nenhuma transação.</p>';
            loadDashboardStats(); 
            return;
        }

        listEl.innerHTML = '';
        if (fullListEl) fullListEl.innerHTML = '';

        data.forEach(t => {
            total += t.amount;
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <div class="t-info">
                    <h4>${escapeHtml(t.category)}</h4>
                    <span>${escapeHtml(t.description || '')} • ${escapeHtml(t.date)} • ${escapeHtml(t.payment_method)}</span>
                </div>
                <div class="t-details">
                    <div class="t-amount">R$ ${t.amount.toFixed(2)}</div>
                    <button class="t-delete" onclick="deleteTransaction('${escapeHtml(t.id)}')">Apagar</button>
                </div>
            `;
            listEl.appendChild(item);
            
            if (fullListEl) {
                const fullItem = item.cloneNode(true);
                fullListEl.appendChild(fullItem);
            }
        });

        loadDashboardStats();
    } catch (err) {
        console.error(err);
    }
}

// --- DASHBOARD E ANÁLISE ---

/**
 * Coleta os dados agregados para atualizar os cards de estatísticas.
 */
async function loadDashboardStats() {
    try {
        const res = await fetch(API_URL + `/transactions/stats?month=${viewMonth}&year=${viewYear}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();

        const total = data.total || 0;
        
        // Quick stats no topo (mini-stats)
        const miniToday = document.getElementById('mini-today');
        const miniMonth = document.getElementById('mini-month');
        const miniBudget = document.getElementById('mini-budget');
        
        if (miniMonth) miniMonth.innerText = `R$ ${total.toFixed(0)}`;
        
        if (miniBudget) {
            const userRes = await fetch(API_URL + '/profile', {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            const userData = await userRes.json();
            const budget = userData.monthlyBudget || 0;
            if (budget > 0) {
                const pct = (total / budget) * 100;
                miniBudget.innerText = `${pct.toFixed(0)}%`;
                miniBudget.style.color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';
            } else {
                miniBudget.innerText = '-';
            }
        }
        
        // Category list
        const categoryList = document.getElementById('category-list');
        if (categoryList) {
            categoryList.innerHTML = '';
            data.categories.forEach(cat => {
                const pct = total > 0 ? (cat.amount / total) * 100 : 0;
                const row = document.createElement('div');
                row.className = 'category-row';
                row.innerHTML = `
                    <div class="category-info">
                        <span>${escapeHtml(cat.category)}</span>
                        <span>R$ ${cat.amount.toFixed(0)} (${pct.toFixed(0)}%)</span>
                    </div>
                    <div class="progress-bg">
                        <div class="progress-fill" style="width: ${pct}%"></div>
                    </div>
                `;
                categoryList.appendChild(row);
            });
        }

        updateExpensesChart(data.categories);

    } catch (err) {
        console.error('Erro ao carregar estatísticas do dashboard:', err);
    }
}

async function loadDailySummary() {
    try {
        const res = await fetch(API_URL + '/transactions/daily-summary', {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        const card = document.getElementById('daily-summary-card');
        if (!card || !data.totalSpent) {
            if (card) card.style.display = 'none';
            return;
        }
        
        document.getElementById('summary-date').innerText = data.date;
        document.getElementById('summary-today').innerText = `R$ ${data.todaySpent.toFixed(2)}`;
        document.getElementById('summary-month').innerText = `R$ ${data.totalWithFixed.toFixed(2)}`;
        
        const budgetEl = document.getElementById('summary-budget');
        budgetEl.innerText = `${data.budgetUsed.toFixed(0)}%`;
        budgetEl.className = `value ${data.status === 'exceeded' ? 'danger' : data.status === 'warning' ? 'warning' : ''}`;
        
        card.style.display = 'block';
    } catch (err) {
        console.error('Erro ao carregar resumo diário:', err);
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

document.querySelectorAll('.quick-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.quick;
        if (action === 'gasto') {
            document.getElementById('nav-dashboard')?.click();
            setTimeout(() => document.getElementById('t-amount')?.focus(), 300);
        } else if (action === 'meta') {
            document.getElementById('nav-goals')?.click();
        } else if (action === 'resumo') {
            aiInput.value = 'Me dá um resumo das minhas finanças';
            sendMessage();
        }
    });
});

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
    
    const escapedText = escapeHtml(text);
    const formattedText = escapedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
        
    msg.innerHTML = formattedText;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Toggle Chat Lumi
function toggleChat() {
    const panel = document.getElementById('lumi-chat-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

// Avatar interaction - clique para abrir o chat
const lumiAvatarWrapper = document.getElementById('lumi-avatar-wrapper');
const lumiAvatar = document.getElementById('lumi-avatar');
const lumiStatus = document.getElementById('lumi-status');

if (lumiAvatarWrapper) {
    lumiAvatarWrapper.addEventListener('click', () => {
        toggleChat();
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            console.log('SW registered:', registration.scope);

            if (TOKEN && 'Notification' in window && Notification.permission === 'default') {
                requestNotificationPermission();
            }
        } catch (err) {
            console.error('SW registration failed:', err);
        }
    });
}

async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted');
        }
    } catch (err) {
        console.error('Notification permission error:', err);
    }
}

// Toggle Section (collapsible)
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.toggle('collapsed');
        const header = section.previousElementSibling;
        if (header && header.classList.contains('section-header')) {
            const icon = header.querySelector('.toggle-icon');
            if (icon) {
                icon.classList.toggle('rotated');
            }
        }
    }
}
window.toggleSection = toggleSection;
