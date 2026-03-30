const categoryRules = {
    'Alimentação': [
        'ifood', 'uber eats', 'rapper', 'delivery', 'restaurante', 'lanchonete', 'pizza', 'hamburger',
        'burger', 'sushi', 'padaria', 'café', 'cafeteria', 'supermercado', 'mercado', 'carrefour',
        'extra', 'pão', 'açougue', 'frutas', 'verduras', 'hortifruti', 'diper', 'danone', 'nestlé',
        'ambev', 'coca cola', 'pepsi', 'refrigerante', 'suco', 'chocolate', 'biscoito',
        'laticínios', 'leite', 'queijo', 'iogurte', 'manteiga', 'ovo', 'arroz', 'feijão', 'macarrão',
        'mc donalds', 'burger king', 'subway', 'kfc', 'babbo', 'giraffas', 'outback', 'shimeji'
    ],
    'Transporte': [
        'uber', '99', 'cabify', 'taxi', 'ônibus', 'metrô', 'trem', 'van', 'combustível', 'gasolina',
        'álcool', 'diesel', 'etanol', 'posto', 'shell', 'petrobras', 'ipiranga', 'auto posto',
        'lubrax', 'vale tudo', 'estacionamento', 'pedágio', 'seguro veicular', 'ipva', 'detran',
        'carro', 'moto', 'bicicleta', 'locação', 'aluguel de carro', 'hertz', 'localiza', 'unidas',
        'wm', 'fly', 'latam', 'gol', 'azul', 'passagem', 'bird', 'lime', 'tembici'
    ],
    'Lazer': [
        'netflix', 'spotify', 'disney', 'hbo', 'amazon prime', 'apple tv', 'youtube', 'twitch',
        'cinema', 'teatro', 'show', 'banda', 'concerto', 'estádio', 'futebol', 'ingresso',
        'parque', 'praia', 'viagem', 'hotel', 'pousada', 'airbnb', 'booking', 'viação',
        'bar', 'balada', 'boteco', 'pub', 'karaokê', 'jogo', 'steam', 'playstation', 'xbox', 'nintendo',
        'globoplay', 'paramount', 'deezer', 'twitch', 'live', 'ticket'
    ],
    'Moradia': [
        'aluguel', 'condomínio', 'luz', 'energia elétrica', 'água', 'saneamento', 'gás', 'internet',
        'vivo', 'tim', 'claro', 'oi', 'net', 'sky', 'telefone', 'iptu', 'seguro residencial',
        'mudança', 'móveis', 'decoração', 'cama', 'colchão', 'sofá', 'geladeira', 'fogão',
        'máquina de lavar', 'secadora', 'aspirador', 'ferro de passar', 'televisor', 'ar condicionado',
        'mobly', 'magalu', 'casa show', 'leroy merlin'
    ],
    'Saúde': [
        'farmácia', 'drogaria', 'pague menos', 'raia', 'droga raia', 'sanofi', 'medicamento',
        'remédio', 'receita', 'consulta', 'médico', 'dentista', 'psicólogo', 'fisioterapeuta',
        'hospital', 'laboratório', 'exame', 'raio x', 'ultrassom', 'cirurgia', 'plano de saúde',
        'unimed', 'bradesco saúde', 'amil', 'sulamerica', 'odontológico', 'convênio', 'vacina',
        'óculos', 'lente', 'contato', 'academia', 'musculação', 'yoga', 'pilates', 'crossfit',
        'smartfit', 'bio Ritmo', 'gympass'
    ],
    'Educação': [
        'curso', 'escola', 'universidade', 'faculdade', 'graduação', 'mestrado', 'doutorado',
        'livro', 'estante', 'amazon', 'cultura', 'livraria', 'papelaria', 'material escolar',
        'uniforme', 'bolsa', 'estágio', 'idioma', 'inglês', 'espanhol', 'francês', 'alemanão',
        'cursinho', 'preparatório', 'enem', 'vestibular', 'udemy', 'coursera', 'linkedin learning',
        'alura', 'rocketseat', 'devops', 'programação', 'tech', 'certificate', 'certificação',
        'cultura df', 'pearson', 'book'
    ],
    'Outros': []
};

function categorize(description) {
    if (!description) return 'Outros';
    
    const descLower = description.toLowerCase();
    let matchFound = null;
    let longestMatch = 0;
    
    for (const [category, keywords] of Object.entries(categoryRules)) {
        for (const keyword of keywords) {
            if (descLower.includes(keyword.toLowerCase())) {
                if (keyword.length > longestMatch) {
                    longestMatch = keyword.length;
                    matchFound = category;
                }
            }
        }
    }
    
    return matchFound || 'Outros';
}

function suggestCategory(description) {
    const category = categorize(description);
    return {
        suggested: category,
        confidence: category === 'Outros' ? 0.5 : 0.9,
        alternatives: getAlternatives(description)
    };
}

function getAlternatives(description) {
    const descLower = description.toLowerCase();
    const alternatives = [];
    
    if (descLower.includes('pizza') || descLower.includes('burger')) {
        alternatives.push('Lazer');
    }
    if (descLower.includes('farmácia') || descLower.includes('remédio')) {
        alternatives.push('Alimentação');
    }
    
    return alternatives;
}

module.exports = {
    categorize,
    suggestCategory,
    categoryRules
};
