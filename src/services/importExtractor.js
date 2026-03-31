const Transaction = require('../models/Transaction');
const { categorize } = require('./categorizer');

function parseAmount(value) {
    if (!value || typeof value !== 'string') return 0;
    let cleaned = value.replace(/[R$.\s]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/\.(?=\d{3})/g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

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

async function parseCSV(csvContent, userId) {
    const transactions = [];
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return [];
    
    const header = lines[0].toLowerCase();
    let dateIndex = 0, descIndex = 1, amountIndex = 2;
    
    const headers = header.split(/[;,]/).map(h => h.trim());
    dateIndex = headers.findIndex(h => h.includes('data') || h.includes('date'));
    descIndex = headers.findIndex(h => h.includes('desc') || h.includes('nome') || h.includes('historic'));
    amountIndex = headers.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('value'));
    
    if (amountIndex === -1) amountIndex = 2;
    if (descIndex === -1) descIndex = 1;
    
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/"/g, ''));
        if (cols.length < 2) continue;
        
        let dateStr = cols[dateIndex] || '';
        let description = cols[descIndex] || 'Importado';
        let amount = parseAmount(cols[amountIndex]);
        
        if (!amount || isNaN(amount)) continue;
        
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

async function importTransactions(userId, fileContent, fileType) {
    let transactions;
    
    if (fileType === 'ofx' || fileContent.includes('<OFX>')) {
        transactions = await parseOFX(fileContent, userId);
    } else {
        transactions = await parseCSV(fileContent, userId);
    }
    
    const imported = [];
    for (const t of transactions) {
        try {
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
