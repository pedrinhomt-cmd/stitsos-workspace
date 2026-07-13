# Guia de Integração SSO (StitsOS e Gestor-Nex)

Este documento explica como funciona a arquitetura de Single Sign-On (SSO) entre a central de identidades StitsOS e o ecossistema de apps (ex: Gestor-Nex).

## Arquitetura: Integração de API Direta (Invisível)
Para não confundir o usuário do ERP e manter o layout corporativo (Whitelabel), o login de aplicativos descentralizados ocorre de forma imperceptível:

1. **Acesso:** O usuário acessa a página de login original do app (Ex: Gestor-Nex).
2. **Requisição Frontend:** O app parceiro não aciona o backend dele. Ele faz uma requisição POST diretamente para a API pública deste **StitsOS Auth** (`https://stitsos.fidycard.com.br/api/auth/login`).
3. **Validação StitsOS:** O nosso `server.ts` verifica a senha no banco Prisma. Se correta, gera um Token JWT que inclui no Payload os campos cruciais: `userId`, `sub`, e `email`.
4. **Login Transparente:** O Frontend do parceiro recebe este Token, guarda na memória e libera a tela.
5. **Comunicação Segura:** O parceiro valida os acessos lendo a assinatura do Token usando a mesma senha `JWT_SECRET`.

## Regras de Ouro (Checklist de Manutenção)

### 1. `JWT_SECRET` Sincronizado
Para a integração funcionar, o arquivo `.env` do StitsOS Auth **DEVE** possuir a mesma exata chave `JWT_SECRET` que está no `.env` do Gestor-Nex ou demais parceiros federados. Sem isso, os serviços externos rejeitarão os logins feitos aqui.

### 2. Payload do Token (Obrigatório)
O `server.ts` deste projeto *precisa* incluir o `email` e o `sub` na hora de assinar o Token JWT. Softwares legados como o Gestor-Nex utilizam o `email` para mapear de qual Tenant (Empresa) aquele usuário é no banco de dados local.
Portanto: Nunca remova o campo `email` do token gerado pela rota `/api/auth/login`!

### 3. Fim do Cadastro Local
Nenhum app parceiro deve ter tabelas de senha. Todas as senhas da Holding devem ser criadas e testadas apenas pelas rotas desta API.
