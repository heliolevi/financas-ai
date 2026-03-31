/**
 * =============================================================================
 * SERVIÇO DE IMPORTAÇÃO DE EXTRATOS
 * =============================================================================
 * Responsável por: Parsear arquivos CSV, OFX e XML de extratos bancários.
 * Detecta duplicatas via hash para evitar importações repetidas.
 * =============================================================================
 */

const Transaction = require('../models/Transaction');
const { categorize } = require('./categorizer');

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Converte string de valor para número float.
 * Tratamento de formatos brasileiros (1.234,56) e americanos (1234.56).
 * 
 * @param {string} value - Valor em string
 * @returns {number} Valor numérico
 */
function parseAmount(value) {
    if (!value || typeof value !== 'string') return 0;
    let cleaned = value.replace(/[R$.\s]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // Formato brasileiro: 1.234,56 → 1234.56
        cleaned = cleaned.replace(/\.(?=\d{3})/g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        // Apenas vírgula: 1234,56 → 1234.56
        cleaned = cleaned.replace(',', '.');
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Parseia arquivo XML do banco (formato OFX/XML brasileiro).
 * Procura tags <transacao>, <data>, <valor>, <descricao>.
 * 
 * @param {string} xmlContent - Conteúdo do arquivo XML
 * @param {string} userId - ID do usuário
 * @returns {Array} Array de transações parseadas
 */
async function parseXML(xmlContent, userId) {
    const transactions = [];
    const transactionsMatch = xmlContent.match(/<transacao>([\s\S]*?)<\/transacao>/g);
    
    if (!transactionsMatch) return transactions;
    
    for (const transBlock of transactionsMatch) {
        let dateMatch = transBlock.match(/<data>(\d{2})\/(\d{2})\/(\d{4})/);
        let amountMatch = transBlock.match(/<valor>([^<]+)/);
        let descMatch = transBlock.match(/<descricao>([^<]+)/) || transBlock.match(/<historico>([^<]+)/);
        
        if (dateMatch && amountMatch) {
            const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            const amount = parseAmount(amountMatch[1]);
            const description = descMatch ? descMatch[1].trim() : 'Importado';
            
            // Hash para detecção de duplicatas
            const hash = `${userId}-${date}-${Math.abs(amount)}-${description.substring(0, 20)}`;
            transactions.push({
                user_id: userId,
                amount: Math.abs(amount),
                category: categorize(description),
                description: description,
                payment_method: amount < 0 ? 'Cartão de Crédito' : 'Dinheiro',
                date: date,
                installments: 1,
                installment_index: 1,
                group_id: null,
                imported: true,
                importHash: hash
            });
        }
    }
    
    return transactions;
}

/**
 * Parseia arquivo OFX (Open Financial Exchange).
 * Formato texto usado por muitos bancos.
 * 
 * @param {string} ofxContent - Conteúdo do arquivo OFX
 * @param {string} userId - ID do usuário
 * @returns {Array} Array de transações parseadas
 */
async function parseOFX(ofxContent, userId) {
    const transactions = [];
    const lines = ofxContent.split('\n');
    
    let inTransaction = false;
    let currentTransaction = {};
    
    for (const line of lines) {
        if (line.includes('<STMTTRN>')) {
            inTransaction = true;
            currentTransaction = {};
        } else if (line.includes('</STMTTRN>')) {
            inTransaction = false;
            if (currentTransaction.amount && currentTransaction.date) {
                const amount = parseAmount(currentTransaction.amount);
                transactions.push({
                    user_id: userId,
                    amount: Math.abs(amount),
                    category: categorize(currentTransaction.description || ''),
                    description: currentTransaction.description || 'Importado',
                    payment_method: amount < 0 ? 'Cartão de Crédito' : 'Dinheiro',
                    date: currentTransaction.date,
                    installments: 1,
                    installment_index: 1,
                    group_id: null,
                    imported: true,
                    importHash: `${userId}-${currentTransaction.date}-${Math.abs(amount)}-${(currentTransaction.description || 'Importado').substring(0, 20)}`
                });
            }
        } else if (inTransaction) {
            // Extrai campos relevantes
            if (line.includes('<DTPOSTED>')) {
                const dateStr = line.replace('<DTPOSTED>', '').trim().slice(0, 8);
                if (dateStr.length >= 8) {
                    const year = dateStr.slice(0, 4);
                    const month = dateStr.slice(4, 6);
                    const day = dateStr.slice(6, 8);
                    currentTransaction.date = `${year}-${month}-${day}`;
                }
            } else if (line.includes('<TRNAMT>')) {
                currentTransaction.amount = line.replace('<TRNAMT>', '').trim();
            } else if (line.includes('<NAME>')) {
                currentTransaction.description = line.replace('<NAME>', '').trim();
            } else if (line.includes('<MEMO>')) {
                currentTransaction.description = (currentTransaction.description || '') + ' ' + line.replace('<MEMO>', '').trim();
            }
        }
    }
    
    return transactions;
}

/**
 * Parseia arquivo CSV genérico.
 * Detecta colunas automaticamente por cabeçalhos (data, desc, valor).
 * 
 * @param {string} csvContent - Conteúdo do arquivo CSV
 * @param {string} userId - ID do usuário
 * @returns {Array} Array de transações parseadas
 */
async function parseCSV(csvContent, userId) {
    const transactions = [];
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];
    
    const header = lines[0].toLowerCase();
    let dateIndex = 0, descIndex = 1, amountIndex = 2;
    
    // Detecta colunas pelo cabeçalho
    const headers = header.split(/[;,]/).map(h => h.trim());
    dateIndex = headers.findIndex(h => h.includes('data') || h.includes('date'));
    descIndex = headers.findIndex(h => h.includes('desc') || h.includes('nome') || h.includes('historic'));
    amountIndex = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('value'));
    
    if (amountIndex === -1) amountIndex = 2;
    if (descIndex === -1) descIndex = 1;
    
    // Processa cada linha
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/"/g, ''));
        if (cols.length < 2) continue;
        
        let dateStr = cols[dateIndex] || '';
        let description = cols[descIndex] || 'Importado';
        let amount = parseAmount(cols[amountIndex]);
        
        if (!amount || isNaN(amount)) continue;
        
        // Parse da data
        let date = new Date();
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            date = `${y || new Date().getFullYear()}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else if (dateStr.includes('-')) {
            date = dateStr.slice(0, 10);
        }
        
        const isExpense = amount < 0;
        const hash = `${userId}-${date}-${Math.abs(amount)}-${description.substring(0, 20)}`;
        transactions.push({
            user_id: userId,
            amount: Math.abs(amount),
            category: categorize(description),
            description: description,
            payment_method: isExpense ? 'Cartão de Crédito' : 'Dinheiro',
            date: date,
            installments: 1,
            installment_index: 1,
            group_id: null,
            imported: true,
            importHash: hash
        });
    }
    
    return transactions;
}

/**
 * Função principal: importa transações de qualquer formato.
 * Detecta formato automaticamente e evita duplicatas.
 * 
 * @param {string} userId - ID do usuário
 * @param {string} fileContent - Conteúdo do arquivo
 * @param {string} fileType - Tipo forçado (opcional): 'csv', 'ofx', 'xml'
 * @returns {Array} Array de transações importadas
 */
async function importTransactions(userId, fileContent, fileType) {
    let transactions;
    
    // Detecção automática do formato
    if (fileType === 'xml' || fileContent.trim().startsWith('<?xml') || fileContent.includes('<extrato>')) {
        transactions = await parseXML(fileContent, userId);
    } else if (fileType === 'ofx' || fileContent.includes('<OFX>')) {
        transactions = await parseOFX(fileContent, userId);
    } else {
        // Default: tenta CSV
        transactions = await parseCSV(fileContent, userId);
    }
    
    // Importa cada transação (verificando duplicatas)
    const imported = [];
    for (const t of transactions) {
        try {
            // Verifica se já existe via importHash
            const existing = await Transaction.findOne({ importHash: t.importHash });
            if (existing) continue;
            
            const { importHash, ...transactionData } = t;
            const newT = new Transaction(transactionData);
            await newT.save();
            imported.push(t);
        } catch (e) {
            console.error('Erro ao importar transação:', e.message);
        }
    }
    
    return imported;
}

module.exports = {
    importTransactions,
    parseOFX,
    parseCSV
};
