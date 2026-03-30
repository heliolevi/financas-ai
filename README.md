# Finanças AI (Lumi Gold) 💎 - Projeto / Contexto para IA

Este repositório contém o **Finanças AI**, um assistente financeiro de altíssimo padrão com inteligência artificial integrada (Lumi).
Este `README.md` serve como a **memória central e guia de arquitetura** para que agentes de IA compreendam totalmente a base de código, as regras de negócios e os padrões de UI do projeto antes de fazerem modificações.

## 🧠 1. Arquitetura e Stack
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript.
- **Backend / API**: Node.js + Express.js.
- **Banco de Dados**: MongoDB (utilizando `mongoose`). *(Anteriormente documentado como SQLite, mas migrado para Mongoose).*
- **Segurança**: Senhas em `bcryptjs` e sessões gerenciadas por `JWT`.
- **Inteligência Artificial**: API do **Groq** via `groq-sdk` rodando modelos Llama-3.
- **Pagamentos**: Integração com a **Stripe API** para processamento de upgrades e assinaturas (Plano Lumi Gold Pro).

## 👁️ 2. UI / Front-end Patterns
- **Diretriz de CSS Mobile-first/Isolada**:
  - Todos os consertos ou ajustes direcionados a mobile **NÃO** podem quebrar a visão do desktop.
  - A responsividade para dispositivos móveis é gerida estritamente pelas media queries `@media (max-width: 768px)` dentro de `public/style.css`.
- **Gatilhos Visuais e Tema**:
  - O tema do aplicativo é apelidado de *Midnight & Gold Premium* (Fundo escuro `--bg-midnight` e tipografia branca misturada com degrade de `--accent-gold`).
  - O uso de *Glassmorphism* (cartões translúcidos baseados em *backdrop-filter*) impera em toda a aplicação.
- **Tela de Upgrade (Premium Conversions)**:
  - O arquivo `public/upgrade.html` não pode ter seus textos e estrutura HTML alterados, os gatilhos visuais são operados exclusivamente por CSS. Esta área usa animações altamente engajadoras (ex: *Light Sweep Animations, Orbs Pulse*).

## 🤖 3. Inteligência Artificial: A Persona "Lumi"
- **Comportamento e Instruções (System Prompts)**: 
  - A IA foi configurada em `src/controllers/aiController.js` não como uma atendente comum, mas como uma **Wealth Manager / Concierge Exclusiva**.
  - Ela possui regras explícitas para **Proatividade** e **Educação Afiada** (podendo questionar com elegância os gastos supérfluos, como excesso em iFood).
- **Contexto Dinâmico Contínuo**:
  - Em cada request para a API do Groq, o sistema varre o banco de dados e injeta silenciosamente um `dynamicContext` com os saldos atuais, limite do cartão de crédito (alertando se passa de 60%) e fatias de gastos daquele usuário em tempo real.

## 💾 4. Estrutura do Banco de Dados / Models
As tabelas principais mapeadas em MongoDB são:
- `User`: Armazena dados de autenticação e tipo da conta (`active` para pagantes do stripe ou isentos pelo criador).
- `Transaction`: Transações cadastradas (Ganhos, despesas e parcelas lógicas).
- `Message`: Memória do chat do usuário com a IA.

## 🚀 5. Deploy e Infraestrutura
- O projeto conta com deploy contínuo integrado via envio de commit para a branch `main` no repositório do Github.
- O código roda online na **Render**, o que exige cuidado redobrado com variáveis de ambiente (URL do Frontend x Servidor). Qualquer modificação que falhar e não subir prejudicará o link no ar (ex: https://financas-ai-qnh6.onrender.com/).

---
*(Desenvolvedores e Agentes de Inteligência Artificial: Ao iniciarem uma nova task, analisem estas regras estritas primeiramente!)*
