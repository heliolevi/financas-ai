const Transaction = require('../models/Transaction');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const ExcelJS = require('exceljs');

/**
 * Gera um PDF com o histórico de transações.
 */
exports.exportPDF = async (req, res) => {
    try {
        const userId = req.userId;
        const transactions = await Transaction.find({ user_id: userId }).sort({ date: -1 });

        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(18);
        doc.text('Relatório Financeiro - Lumi', 14, 20);
        
        // Data da geração
        doc.setFontSize(11);
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

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] }
        });

        const pdfBuffer = doc.output('arraybuffer');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_lumi.pdf');
        res.send(Buffer.from(pdfBuffer));

    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        res.status(500).json({ message: 'Erro ao gerar PDF' });
    }
};

/**
 * Gera um Excel com o histórico de transações.
 */
exports.exportExcel = async (req, res) => {
    try {
        const userId = req.userId;
        const transactions = await Transaction.find({ user_id: userId }).sort({ date: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transações');

        worksheet.columns = [
            { header: 'Data', key: 'date', width: 15 },
            { header: 'Descrição', key: 'description', width: 30 },
            { header: 'Categoria', key: 'category', width: 20 },
            { header: 'Valor (R$)', key: 'amount', width: 15 },
            { header: 'Forma de Pagamento', key: 'payment_method', width: 20 }
        ];

        transactions.forEach(t => {
            worksheet.addRow({
                date: new Date(t.date).toLocaleDateString('pt-BR'),
                description: t.description,
                category: t.category,
                amount: t.amount,
                payment_method: t.payment_method
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
