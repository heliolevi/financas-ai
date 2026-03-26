# Finanças AI 🚀

Um assistente financeiro pessoal inteligente construído com **Node.js**, **Express**, **SQLite** e a **API do Groq**.

## ✨ Funcionalidades

- **🔒 Autenticação Robusta**: Registro e Login de usuários com senhas criptografadas (bCrypt) e tokens JWT.
- **💰 Gestão de Gastos**: Registro completo de transações (valor, categoria, forma de pagamento, data e descrição).
- **🤖 Inteligência Artificial**: Chat integrado com a IA do Groq que analisa seu histórico financeiro e dá dicas em Português.
- **🎨 Design Moderno**: Interface premium com efeito *glassmorphism*, dark mode e totalmente responsiva.

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js, Express.js
- **Banco de Dados**: SQLite3
- **IA**: Groq SDK (Llama 3)
- **Segurança**: JSON Web Token (JWT), bCryptJS
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript

## 🚀 Como Rodar o Projeto

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/SEU_USUARIO/financas-ai.git
    cd financas-ai
    ```

2.  **Instale as dependências**:
    ```bash
    npm install
    ```

3.  **Configuração de API**:
    - Crie um arquivo `.env` na raiz do projeto (se não existir).
    - Adicione sua chave do Groq:
      ```env
      GROQ_API_KEY=sua_chave_aqui
      JWT_SECRET=uma_chave_secreta_qualquer
      PORT=3000
      ```

4.  **Inicie o servidor**:
    ```bash
    npm start
    ```

5.  **Acesse**: `http://localhost:3000`

---
Desenvolvido com ❤️ para organização pessoal.
