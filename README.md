# 💎 Finanças AI (Lumi Gold) - Assistente Financeiro com IA

> **Para Agentes de IA**: Este README é o guia completo do projeto. Leia todas as seções antes de fazer modificações.

---

## 📋 Índice

1. [Visão Geral](#-1-visão-geral)
2. [Arquitetura](#-2-arquitetura)
3. [Stack Tecnológico](#-3-stack-tecnológico)
4. [Estrutura de Pastas](#-4-estrutura-de-pastas)
5. [Entidades e Regras de Negócio](#-5-entidades-e-regras-de-negócio)
6. [API Endpoints](#-6-api-endpoints)
7. [Configuração do Ambiente](#-7-configuração-do-ambiente)
8. [Como Executar](#-8-como-executar)
9. [Testes](#-9-testes)
10. [Segurança](#-10-segurança)
11. [Inteligência Artificial](#-11-inteligência-artificial)
12. [Deploy](#-12-deploy)
13. [Boas Práticas](#-13-boas-práticas)

---

## 🏦 1. Visão Geral

O **Finanças AI (Lumi Gold)** é um assistente financeiro pessoal de alto padrão com inteligência artificial integrada. O app permite:

- ✅ Registro e categorização automática de transações
- ✅ Dashboard com estatísticas e gráficos
- ✅ Chat com IA (Lumi) para análise financeira
- ✅ Importação de extratos (CSV/OFX/XML)
- ✅ Sistema de metas e alertas proativos
- ✅ Assinatura premium via Stripe (Lumi Pro)

---

## 🏗️ 2. Arquitetura

### Clean Architecture (Camadas)

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION                         │
│    (Routes, Controllers, Middleware, Validators)        │
├─────────────────────────────────────────────────────────┤
│                    APPLICATION                          │
│              (Use Cases, Services)                      │
├─────────────────────────────────────────────────────────┤
│                      DOMAIN                              │
│           (Entities, Business Rules)                    │
├─────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE                        │
│     (Repositories, Database, External Services)         │
└─────────────────────────────────────────────────────────┘
```

### Princípios SOLID Aplicados

| Princípio | Aplicação no Projeto |
|-----------|---------------------|
| **S**ingle Responsibility | Cada controller/Use Case tem uma única responsabilidade |
| **O**pen/Closed | Entidades extensíveis sem modificar código existente |
| **L**iskov Substitution | Repositórios podem ser trocados sem alterar lógica |
| **I**nterface Segregation | Schemas de validação específicos por domínio |
| **D**ependency Inversion | Dependências injetadas, não instanciadas diretamente |

---

## 💻 3. Stack Tecnológico

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: JWT + bcryptjs

### Frontend
- **Tecnologia**: Vanilla HTML5, CSS3, JavaScript
- **Tema**: Midnight & Gold Premium (Glassmorphism)
- **Responsividade**: Mobile-first com Media Queries
- **Charts**: Chart.js

### Infraestrutura Externa
- **IA**: Groq API (Llama-3 models)
- **Pagamentos**: Stripe API

---

## 📁 4. Estrutura de Pastas

```
financas-ai/
├── public/                    # Frontend estático
│   ├── index.html             # SPA principal
│   ├── style.css              # Estilos (Glassmorphism)
│   ├── script.js              # Lógica do frontend
│   └── assets/                # Imagens e recursos
│
├── src/
│   ├── app.js                 # Configuração principal do Express
│   ├── server.js              # Entry point
│   │
│   ├── domain/                # 🧠 CAMADA DE DOMÍNIO (Clean Arch)
│   │   └── entities/         # Entidades com regras de negócio
│   │       ├── User.js        # Entidade Usuário
│   │       └── Transaction.js # Entidade Transação
│   │
│   ├── application/           # 🎯 CAMADA DE APLICAÇÃO
│   │   └── useCases/         # Casos de uso específicos
│   │       └── createTransaction.js
│   │
│   ├── infrastructure/        # 🔧 CAMADA DE INFRAESTRUTURA
│   │   └── repositories/     # Implementações de acesso a dados
│   │       └── baseRepository.js
│   │
│   ├── presentation/          # 🎨 CAMADA DE APRESENTAÇÃO
│   │   ├── controllers/      # Controllers (lógica HTTP)
│   │   ├── routes/           # Definição de rotas
│   │   ├── middleware/       # Middlewares (auth, validation)
│   │   └── validators/       # Schemas de validação (Joi)
│   │
│   ├── services/             # Serviços auxiliares
│   │   ├── categorizer.js    # Categorização automática
│   │   ├── proactiveAlerts.js # Sistema de alertas
│   │   └── gamification.js  # Sistema de conquistas
│   │
│   ├── models/               # Models Mongoose (legado - migrating)
│   │   ├── User.js
│   │   ├── Transaction.js
│   │   └── Message.js
│   │
│   ├── middleware/           # Middlewares globais
│   │   └── authMiddleware.js # Auth JWT
│   │
│   └── shared/               # Código compartilhado
│       ├── errors/          # Classes de erro customizadas
│       │   ├── AppError.js
│       │   └── errorHandler.js
│       └── utils/           # Utilitários
│           └── logger.js
│
├── tests/                    # 🧪 Testes TDD
│   ├── unit/                # Testes unitários
│   └── *.test.js
│
├── .env                     # Variáveis de ambiente
├── package.json
├── jest.config.js
└── README.md
```

---

## 🎯 5. Entidades e Regras de Negócio

### User Entity (`src/domain/entities/User.js`)

```javascript
class User {
    // Campos principais
    - username, password
    - grossIncome, netIncome (renda bruta/líquida)
    - bankName, bankBalance
    - creditCardLimit, creditCardUsed, creditCardBill
    - fixedExpenses[], monthlyBudget
    - savingsGoal, savingsCurrent
    - subscriptionStatus, stripeCustomerId

    // Métodos de negócio (Business Rules)
    - isPro()              // Verifica se é assinante ativo
    - canAccessPremium()  // Verifica acesso a recursos premium
    - getCommitmentRate() // % de comprometimento da renda
    - getFixedExpensesTotal()
    - getCreditUsage()    // % de uso do cartão
    - getSavingsProgress() // % da meta de economia
    - toJSON()            // Serialização segura (sem password)
}
```

### Transaction Entity (`src/domain/entities/Transaction.js`)

```javascript
class Transaction {
    // Campos principais
    - user_id, amount, category, description
    - payment_method, date
    - installments, installment_index, group_id
    - imported, autoCategorized

    // Métodos de negócio
    - isParcelada()       // Verifica se é compra parcelada
    - getParcelaAtual()   // "2/3" formato
    - isDespesa()         // Valor positivo = despesa
    - isReceita()         // Valor negativo = receita
    - toSummary()         // Resumo paradisplay
}
```

---

## 🔌 6. API Endpoints

### Autenticação (`/api/auth`)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/register` | Criar nova conta |
| POST | `/auth/login` | Login (retorna JWT) |
| GET | `/auth/me` | Dados do usuário atual |

### Transações (`/api/transactions`)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/transactions` | Listar (filtros: month, year, limit) |
| POST | `/transactions` | Criar transação |
| DELETE | `/transactions/:id` | Deletar (Query: ?deleteAll=true) |
| GET | `/transactions/stats` | Estatísticas do dashboard |
| POST | `/transactions/import` | Importar extrato |

### Perfil (`/api/profile`)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/profile` | Dados do perfil |
| PUT | `/profile` | Atualizar perfil |
| GET | `/profile/dashboard` | Dados agregados + alertas |
| GET | `/profile/alerts` | Alertas proativos |

### IA (`/api/ai`)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/ai/analyze` | Chat com Lumi |
| POST | `/ai/analyze-image` | Analisar nota fiscal (imagem) |
| GET | `/ai/proactive` | Insight proativo inicial |

---

## ⚙️ 7. Configuração do Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# OBRIGATÓRIAS
PORT=3000
JWT_SECRET=uma-chave-secreta-forte-aqui
MONGODB_URI=mongodb+srv://seu-usuario:sua-senha@cluster.mongodb.net/?retryWrites=true&w=majority

# IA (Groq) - Optional mas recomendado
GROQ_API_KEY=sua-chave-groq-aqui

# Stripe - Para pagamentos
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Opcional
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=info
```

---

## 🚀 8. Como Executar

### Instalação
```bash
# Clone o repositório
git clone https://github.com/heliolevi/financas-ai.git
cd financas-ai

# Instale dependências
npm install
```

### Desenvolvimento
```bash
# Iniciar servidor (desenvolvimento)
npm run dev

# O servidor estará em http://localhost:3000
```

### Produção
```bash
# Build (se necessário)
npm run build

# Iniciar em produção
npm start
```

---

## 🧪 9. Testes

```bash
# Executar todos os testes
npm test

# Executar com coverage
npm test -- --coverage

# Executar testes específicos
npm test -- --testPathPattern=userEntity
```

### Estrutura de Testes (TDD)
- **Unitários**: Entidades (`tests/unit/`)
- **Integração**: Controllers e rotas

---

## 🔒 10. Segurança

### Implementado
- ✅ **Helmet.js** - Headers de segurança
- ✅ **Rate Limiting** - Prevenção de ataques
  - Geral: 100 req/15min
  - Login: 5 req/15min (previne brute force)
  - AI: 20 req/min
- ✅ **JWT** - Autenticação stateless
- ✅ **bcryptjs** - Hash de senhas
- ✅ **Input Validation** - Joi schemas
- ✅ **Error Handling** - Middleware centralizado
- ✅ **XSS Protection** - escapeHtml no frontend

### Avisos de Segurança
- ⚠️ `JWT_SECRET` deve ser alterado em produção
- ⚠️ Não commitar `.env` com chaves reais
- ⚠️ Validar todas as entradas do usuário

---

## 🤖 11. Inteligência Artificial

### A Persona "Lumi"
A IA é configurada como uma **Wealth Manager / Concierge Exclusiva**:
- Não é uma atendente comum
- Pergunta sobre gastos supérfluos com elegância
- Dá insights proativos baseados em dados reais

### Contexto Dinâmico
A cada request, o sistema injeta:
- Saldo atual do usuário
- Limite do cartão (% usado)
- Gastos por categoria do mês

### Modelos utilizados
- **Llama-3.3-70b-versatile** - Análise e chat
- **Llama-3.2-90b-vision-preview** - Análise de imagens

---

## ☁️ 12. Deploy

O projeto está configurado para deploy na **Render**.

### URLs
- **Backend**: https://financas-ai-qnh6.onrender.com
- **Frontend**: Servido pelo próprio backend (SPA)

### Variáveis na Render
Configure as mesmas variáveis do `.env` no painel da Render.

---

## 📚 13. Boas Práticas

### Para Desenvolvedores
1. **Commits atomicos** - Cada commit deve fazer uma coisa
2. **Testes antes de modificar** - Use TDD
3. **Validar inputs** - Use os schemas Joi
4. **Tratar erros** - Use as classes de AppError
5. **Entidades primeiro** - Sempre starting pelo domain

### Para Agentes de IA
1. **Leia o README completo** antes de fazer alterações
2. **守 rules de Clean Architecture** - Mantenha a estrutura
3. **Use Entities** para regras de negócio, não controllers
4. **Valide inputs** - Não confunda no controller, use validators
5. **Teste suas alterações** - Execute `npm test`
6. **Não quebre o frontend** - Mantenha compatibilidade

---

## 📄 Licença

ISC License - Feel free to use!

---

*Última atualização: Março 2026*
*Para dúvidas, consulte as Issues do repositório ou a documentação do código.*