const Transaction = require('../models/Transaction');
const { categorize } = require('./categorizer');

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
                transactions.push({
                    user_id: userId,
                    amount: Math.abs(parseFloat(currentTransaction.amount)),
                    category: categorize(currentTransaction.description || ''),
                    description: currentTransaction.description || 'Importado',
                    payment_method: currentTransaction.amount < 0 ? 'Cartão de Crédito' : 'Dinheiro',
                    date: currentTransaction.date,
                    installments: 1,
                    installment_index: 1,
                    group_id: null,
                    imported: true
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
        let amount = parseFloat(cols[amountIndex]?.replace(/[R$.\s]/g, '').replace(',', '.'));
        
        if (!amount || isNaN(amount)) continue;
        
        let date = new Date();
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            date = `${y || new Date().getFullYear()}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else if (dateStr.includes('-')) {
            date = dateStr.slice(0, 10);
        }
        
        const isExpense = amount < 0;
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
            imported: true
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
            const newT = new Transaction(t);
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
