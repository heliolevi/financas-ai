/**
 * =============================================================================
 * CONTROLADOR DE RELATÓRIOS
 * =============================================================================
 * Responsável por: Exportação de dados em PDF e Excel.
 * Usa jsPDF para PDF e ExcelJS para planilhas.
 * =============================================================================
 */

const Transaction = require('../models/Transaction');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable');
const ExcelJS = require('exceljs');

/**
 * Gera um PDF com o histórico de transações.
 * Inclui: cabeçalho com branding Lumi Gold, tabela com dados,
 * e informações de geração.
 * 
 * @param {Object} req - query: { month, year }
 * @param {Object} res - PDF binary
 */
exports.exportPDF = async (req, res) => {
    try {
        const userId = req.userId;
        const { month, year } = req.query;
        let query = { user_id: userId };
        
        if (month && year) {
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);
            const start = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
            const lastDay = new Date(yearNum, monthNum, 0).getDate();
            const end = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
            query.date = { $gte: start, $lte: end };
        }

        const transactions = await Transaction.find(query).sort({ date: -1 });

        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(22);
        doc.setTextColor(217, 119, 6); // Cor Ouro Lumi
        doc.text('Lumi Gold - Extrato Premium', 14, 20);
        
        // Data da geração
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

        // Tabela de dados
        const tableColumn = ["Data", "Descrição", "Categoria", "Valor", "Pagamento"];
        const tableRows = [];

        transactions.forEach(t => {
            const rowData = [
                new Date(t.date).toLocaleDateString('pt-BR'),
                t.description,
                t.category,
                `R$ ${t.amount.toFixed(2)}`,
                t.payment_method
            ];
            tableRows.push(rowData);
        });

        // Usando a função direta do autocable para Node.js
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [217, 119, 6] } // Cabeçalho Dourado
        });

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_lumi.pdf');
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        res.status(500).json({ message: 'Erro ao gerar PDF: ' + err.message });
    }
};

/**
 * Gera um Excel com o histórico de transações.
 */
exports.exportExcel = async (req, res) => {
    try {
        const userId = req.userId;
        const { month, year } = req.query;
        let query = { user_id: userId };
        
        if (month && year) {
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);
            const start = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
            const lastDay = new Date(yearNum, monthNum, 0).getDate();
            const end = `${yearNum}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
            query.date = { $gte: start, $lte: end };
        }

        const transactions = await Transaction.find(query).sort({ date: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transações');

        worksheet.columns = [
            { header: 'Data', key: 'date', width: 15 },
            { header: 'Descrição', key: 'description', width: 30 },
            { header: 'Categoria', key: 'category', width: 20 },
            { header: 'Valor (R$)', key: 'amount', width: 15 },
            { header: 'Forma de Pagamento', key: 'payment_method', width: 20 },
            { header: 'Lumi Gold Concierge', key: 'brand', width: 25 }
        ];

        transactions.forEach(t => {
            worksheet.addRow({
                date: new Date(t.date).toLocaleDateString('pt-BR'),
                description: t.description,
                category: t.category,
                amount: t.amount,
                payment_method: t.payment_method,
                brand: '💎 Lumi Gold Pro'
            });
        });

        // Estilização do cabeçalho
        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_lumi.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('Erro ao gerar Excel:', err);
        res.status(500).json({ message: 'Erro ao gerar Excel' });
    }
};
