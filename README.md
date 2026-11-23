# Night Market — E-commerce de peças de PC

Loja de peças de computador com tema cyberpunk. Frontend em HTML/CSS/JS puro e backend em Node.js + Express + Sequelize + MySQL, com autenticação JWT (bcrypt para as senhas).

## Acesso de administrador

Não há credenciais de administrador padrão. Configure `ADMIN_*` no arquivo `.env`
e rode `npm run seed:admin` dentro de `backend/` (detalhes na seção 4).

## Sumário

1. [Estrutura](#1-estrutura)
2. [Requisitos](#2-requisitos)
3. [Como rodar](#3-como-rodar)
4. [Acesso de administrador](#4-acesso-de-administrador)
5. [Funcionalidades](#5-funcionalidades)
6. [Desconto nas compras](#6-desconto-nas-compras)
7. [Rotas da API](#7-rotas-da-api)
8. [Segurança](#8-segurança)
9. [Testes de integração](#9-testes-de-integração)
10. [Deploy](#10-deploy)
11. [Catálogo e imagens](#11-catálogo-e-imagens)

## 1. Estrutura

```
frontend/
├── index.html            vitrine pública
├── css/                  style.css (design system) e perfil.css
├── js/                   config.js (API_URL), auth.js, cart.js, produtos.js, carrinho.js,
│                         login.js, cadastro.js, perfil.js, pedidos.js, admin.js, validaCpf.js ...
├── html/                 produtos, carrinho, login, cadastro, perfil, pedidos, admin
└── img/produtos/         imagens do catálogo
backend/
├── index.js              rotas e servidor
├── controller/ models/ middleware/ utils/ db/
├── assets/admin.jpg      foto do admin
├── seed.js               categorias e produtos
├── seed-admin.js         usuário admin com foto
├── sync.js               cria as tabelas
├── migrate-avatar.sql    coluna da foto de perfil
├── migrate-desconto.sql  coluna do desconto
└── rest_client.http      testes de integração
```

## 2. Requisitos

- Node.js 18+
- MySQL em execução

## 3. Como rodar

### 3.1 Backend

```
cd backend
npm install
cp .env.example .env
```

Edite o `.env`:

```
DB_NAME=dc_pecas
DB_USER=root
DB_PASS=sua_senha
DB_HOST=localhost
DB_PORT=3306
JWT_SECRET=troque_por_um_segredo_forte
PORT=3000
```

Crie o banco `dc_pecas` (ou o nome definido em `DB_NAME`) no MySQL e rode:

```
npm run sync          # cria as tabelas (APAGA todos os dados existentes)
node seed.js          # cadastra categorias e produtos
npm run seed:admin    # cria o usuário admin com foto
npm start             # API em http://localhost:3000
```

**Banco que já tem dados:** não rode `npm run sync`. Aplique só as colunas novas e depois o admin:

```
mysql -u root -p dc_pecas < migrate-avatar.sql
mysql -u root -p dc_pecas < migrate-desconto.sql
npm run seed:admin
npm start
```

(`ALTER TABLE usuarios ADD COLUMN avatar LONGTEXT NULL;` e
`ALTER TABLE pedidos ADD COLUMN valorDesconto DECIMAL(10,2) NOT NULL DEFAULT 0;`)

### 3.2 Frontend

Sirva a pasta `frontend/` (Live Server no VS Code ou `npx serve frontend`) e abra `index.html`. Não abra o arquivo direto em `file://`, pois isso pode quebrar o `fetch`.

A URL da API fica em `frontend/js/config.js` (`API_URL`, padrão `http://localhost:3000`).

## 4. Acesso de administrador

O sistema não vem com nenhuma conta de admin pronta: você define a sua. Preencha no `backend/.env`:

```
ADMIN_NOME=
ADMIN_EMAIL=
ADMIN_SENHA=        (mínimo 8 caracteres)
ADMIN_CPF=          (CPF válido)
ADMIN_CEP=
ADMIN_NUMERO=
```

Depois rode `npm run seed:admin`. O script cria o admin com a foto `backend/assets/admin.jpg` e busca o endereço pelo CEP.

1. Abra o site e vá em Login (`html/login.html`).
2. Entre com o e-mail e a senha que você definiu no `.env`.
3. O menu mostra "Movimentação de Vendas" e "Cadastro de Produtos", e o Perfil aparece com a foto do admin.

Se o e-mail já existir, o script redefine a senha para a de cima, atualiza a foto e garante o tipo ADMIN. Por isso, se aparecer "E-mail ou senha inválidos", rode `npm run seed:admin` de novo.

- Trocar a foto do admin: substitua `backend/assets/admin.jpg` e rode `npm run seed:admin` de novo.
- Promover uma conta existente a admin, no MySQL: `UPDATE usuarios SET tipo='ADMIN' WHERE email='seu@email.com';`
- Depois de criar o admin, remova `ADMIN_SENHA` do `.env`.

## 5. Funcionalidades

**Rotas públicas (sem login):** vitrine, catálogo com busca por nome e filtro por categoria, carrinho (localStorage), login e cadastro com autocompletar de endereço (ViaCEP) e validação matemática do CPF.

**Rotas privadas (JWT):** checkout, perfil, histórico de pedidos e painel admin. O token é enviado como `Authorization: Bearer <token>`, e qualquer resposta 401 desloga o usuário (`Auth.authFetch`).

**Carrinho e estoque:** não permite adicionar item com estoque zerado nem acima da quantidade disponível. Ao finalizar o pedido, o estoque é deduzido e a entrega é criada.

**Página de perfil** (`html/perfil.html`, estilo GitHub), aberta após o login:
- *Visão geral:* compras recentes, mapa de atividade de pedidos no último ano e linha do tempo.
- *Itens comprados:* produtos comprados, com quantidade, última compra e total gasto (pedidos cancelados não contam).
- *Pedidos:* histórico completo com status, rastreio e desconto.
- *Configurações:* editar nome, e-mail, CEP, número e senha, enviar ou remover a foto.

A foto é redimensionada no navegador e salva no campo `avatar` do usuário (jpeg, png ou webp, até ~700 KB). Ao alterar o CEP, o backend busca rua, bairro, cidade e UF no ViaCEP.

**Painel admin** (`html/admin.html`): abas Produtos, Vendas (todos os pedidos, com busca pelo nome do cliente), Categorias, Estoque, Entregas e Relatórios. Os 2 relatórios usam Chart.js: vendas por categoria (barras) e faturamento mensal (linha).

## 6. Desconto nas compras

O PDF do desafio não detalha as regras de desconto, então foram adotadas estas faixas sobre o subtotal do pedido:

| Subtotal             | Desconto |
|----------------------|----------|
| a partir de R$ 1.000 | 5%       |
| a partir de R$ 5.000 | 10%      |

O cálculo é feito no backend (`backend/utils/desconto.js`, basta editar `FAIXAS`) e gravado no pedido (`valorDesconto`). O carrinho mostra subtotal, desconto e quanto falta para a próxima faixa, e o histórico mostra o desconto aplicado. As faixas são servidas em `GET /descontos`.

O faturamento mensal já considera o desconto; as vendas por categoria somam o preço cheio dos itens.

## 7. Rotas da API

**Públicas:** `POST /login`, `POST /usuarios`, `GET /produtos`, `GET /produtos/buscar?nome=`, `GET /produtos/:id`, `GET /categorias`, `GET /categorias/buscar?nome=`, `GET /categorias/:id`, `GET /descontos`.

**Usuário logado:** `GET /usuarios/perfil`, `GET /usuarios/:id` (o próprio usuário), `PUT` e `PATCH /usuarios/:id` (o próprio usuário), `POST /pedidos`, `GET /pedidos/meus-pedidos`, `GET /pedidos/:id` (o próprio pedido), `GET /entregas/:id`.

**Somente admin:**
- Usuários: `GET /usuarios`, `GET /usuarios/buscar?nome=`, `GET /usuarios/:id`, `DELETE /usuarios/:id`.
- Pedidos: `GET /pedidos`, `GET /pedidos/buscar?nome=` (nome do cliente), `PUT`, `PATCH` e `DELETE /pedidos/:id`.
- Entregas: `GET /entregas`, `GET /entregas/buscar?nome=` (nome do cliente), `POST`, `PUT`, `PATCH` e `DELETE`.
- Catálogo: `POST`, `PUT`, `PATCH` e `DELETE` em `/produtos` e `/categorias`.
- Estoque: `GET /estoque`, `GET /estoque/buscar?nome=`, `GET /estoque/:id`, `POST`, `PUT`, `PATCH` e `DELETE`.
- Relatórios: `GET /relatorios/vendas`, `GET /relatorios/estoque`.

## 8. Segurança

- Senhas com bcrypt; rotas privadas com JWT (token inválido, ausente ou expirado retorna 401).
- `PUT`/`PATCH /usuarios/:id`: o cliente só edita o próprio perfil e apenas nome, e-mail, senha, CEP, número e foto. `tipo` e CPF só podem ser alterados por admin.
- `POST /usuarios` com `tipo: "ADMIN"` só funciona com token de admin ou quando ainda não existe nenhum admin no banco.
- `GET /pedidos/:id`: o cliente só vê os próprios pedidos; admin vê todos.
- O `.env` contém segredos: não o publique em repositório público.

## 9. Testes de integração

`backend/rest_client.http` (extensão REST Client do VS Code) percorre o fluxo completo: login, categorias, produtos, estoque, pedido, entrega, relatórios, perfil e as checagens de segurança (401 e 403). Rode antes `npm run seed:admin` e preencha `@adminEmail` e `@adminSenha` no topo do arquivo.

## 10. Deploy

**Railway (backend):** crie um MySQL no projeto e configure no serviço do backend as variáveis `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT` e `JWT_SECRET`. O backend também lê as variáveis padrão do plugin MySQL do Railway (`MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLHOST`, `MYSQLPORT`). A API escuta em `0.0.0.0` e usa a `PORT` do Railway. Para popular o banco, rode `npm run sync`, `node seed.js` e `npm run seed:admin` apontando para o banco do Railway.

**Vercel (frontend):** publique a pasta `frontend/` e troque `API_URL` em `frontend/js/config.js` pela URL pública do Railway. O backend usa `cors()` liberado, então não precisa de configuração extra de CORS.

## 11. Catálogo e imagens

O catálogo é dinâmico (vem da API); o `seed.js` cadastra categorias e peças de exemplo, e o Painel Admin permite cadastrar mais. Categorias: Placas de Vídeo, Processadores, Placas-mãe, Memória RAM, Armazenamento, Fontes, Gabinetes e Coolers.

- JPGs em `frontend/img/produtos/` (26 ilustrações, 4:3).
- Catálogo local em `frontend/data/produtos.json` (campo `imagem` = `/img/produtos/<arquivo>.jpg`).
- Imagens também embutidas em data URI em `frontend/img/produtos/imagens.json` e `frontend/js/imagens-produtos.js`, para aparecerem mesmo abrindo o HTML direto, sem servidor.
- Sem backend, o site usa `data/produtos.json` / `js/mock-produtos.js`.
