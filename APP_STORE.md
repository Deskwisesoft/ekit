# Publicar a eKit na App Store (mantendo o site)

O site (GitHub Pages) e a app iOS usam **o mesmo código**. A app é um invólucro nativo (Capacitor) que leva os ficheiros dentro do pacote, por isso funciona sem internet desde a instalação.

## 1. O que é preciso (não se faz em Windows)

- Um **Mac** com Xcode recente e Node.js 20 ou superior.
- Conta no **Apple Developer Program** (99 €/ano). Recomendação: inscrever como **organização** (precisa de número D-U-N-S), porque a app trata dados de saúde e de emergência e transmite mais confiança.
- Um **identificador da app** num domínio que controle. Está `io.github.deskwisesoft.ekit` em `capacitor.config.json`; troque se tiver domínio próprio (não se pode mudar depois de publicar).
- Preencher `[nome da entidade responsável]` e `[email de contacto]` em `privacidade.html`.

## 2. Gerar o projeto iOS (no Mac)

```bash
npm install
npx cap add ios
npm run ios
```

`npm run ios` copia o site para `www/`, sincroniza e abre o Xcode. Depois de qualquer alteração ao site, basta `npm run sync`.

No Xcode, em `ios/App/App/Info.plist`, acrescente:

| Chave | Valor |
|---|---|
| `NSLocationWhenInUseUsageDescription` | A eKit usa a sua localização só no dispositivo, para mostrar a distância aos pontos de encontro. |
| `LSApplicationQueriesSchemes` | lista com `bitchat` |
| `ITSAppUsesNonExemptEncryption` | ver ponto 5 |

Ícone: arraste `icons/icon-1024.png` para *AppIcon* em `Assets.xcassets`.

## 3. Testar num iPhone real antes de submeter

- Lembretes de validade (pedem permissão e aparecem com a app fechada).
- "Onde estou" e mapa; ligar 112 (abre o ecrã de confirmação e depois o marcador).
- Partilhar e importar um grupo; chat e sincronização entre dois iPhones.
- "Abrir bitchat" e "Enviar pelo bitchat" com o bitchat instalado.

## 4. App Store Connect

- **Nome**: eKit – Kit de Emergência · **Subtítulo**: Preparar a família para emergências
- **Categoria**: Utilidades (secundária: Estilo de vida) · **Idade**: 4+ (o chat é só entre membros convidados)
- **URL de privacidade**: https://deskwisesoft.github.io/ekit/privacidade.html
- **URL de suporte**: https://github.com/Deskwisesoft/ekit/issues
- **Capturas**: iPhone 6,9" (obrigatório); iPad só se ativar suporte a iPad.

### "Privacidade da app" (rótulos)

O programador não recolhe dados: tudo fica no dispositivo e o que sai vai cifrado de ponta a ponta para relays que não o conseguem ler. A resposta prevista é **"Dados não recolhidos"**. Confirme com a definição atual da Apple antes de submeter.

## 5. Cifra (exportação)

A app usa cifra padrão (AES-GCM, SHA-256, assinaturas Schnorr) para proteger os dados do utilizador. Responda ao questionário de exportação em App Store Connect. Em geral, apps que só usam algoritmos padrão para proteger dados do utilizador ficam isentas de documentação, mas a distribuição em França pode exigir declaração. Verifique as regras em vigor.

## 6. Notas para a revisão da Apple (copiar para "Notes")

> A eKit é uma ferramenta cívica e gratuita para preparar famílias para emergências, segundo a recomendação europeia de autonomia de 72 horas. Não é um serviço oficial e di-lo claramente. O botão 112 abre sempre um ecrã de confirmação e depois o marcador do sistema: nunca liga automaticamente.
>
> Funcionalidades nativas: lembretes locais de validade agendados no sistema, localização no dispositivo (distância a pontos de encontro, sem rede), funcionamento integral offline e folha de partilha.
>
> O chat é privado entre membros convidados de um grupo (chave partilhada por ficheiro cifrado). Não há perfis públicos nem descoberta de utilizadores. Cada pessoa pode bloquear um remetente, e o dono do grupo pode retirar acesso criando uma nova chave. Contacto para denúncias: [email de contacto].
>
> Não há contas nem início de sessão.

## 7. Riscos de rejeição e como responder

- **4.2 (funcionalidade mínima)**: a app não é um site embrulhado. Tem lembretes nativos, offline completo, GPS e partilha. Se for pedido, acrescentar widgets ou atalhos de Siri.
- **1.2 (conteúdo gerado por utilizadores)**: o bloqueio de remetentes e o contacto para denúncias já existem. Se a Apple pedir mais, acrescentar "Denunciar", que abre um email para o contacto.
- **5.1.1 (dados)**: há política de privacidade, consentimento explícito para dados de saúde e não há contas.

## 8. Manter o site

Nada muda: cada `git push` para `main` atualiza o GitHub Pages. Para a app, `npm run sync` no Mac e nova versão no Xcode (aumente *Version/Build*).
