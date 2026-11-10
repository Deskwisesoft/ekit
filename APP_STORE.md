# Publicar a eKit na App Store (mantendo o site)

O site (GitHub Pages) e a app iOS usam **o mesmo código**. A app é um invólucro nativo (Capacitor) que leva os ficheiros dentro do pacote, por isso funciona sem internet desde a instalação.

## 1. O que é preciso

- Conta no **Apple Developer Program** (99 €/ano). Recomendação: inscrever como **organização** (precisa de número D-U-N-S), porque a app trata dados de saúde e de emergência e transmite mais confiança.
- Conta no **Codemagic**, ligada ao repositório `Deskwisesoft/ekit`. A app é compilada na cloud, por isso **não é preciso Mac**.
- Um **identificador da app** (Bundle ID). Está `io.github.deskwisesoft.ekit` em `capacitor.config.json` e `codemagic.yaml`; troque nos dois se tiver domínio próprio (não se pode mudar depois de publicar).
- Preencher `[nome da entidade responsável]` e `[email de contacto]` em `privacidade.html`.

## 2. Compilar com o Codemagic (sem Mac)

Uma vez só:

1. **developer.apple.com → Certificates, IDs & Profiles → Identifiers → "+"**: registar o App ID `io.github.deskwisesoft.ekit` (ativar *Push Notifications* não é necessário; os lembretes são locais).
2. **App Store Connect → Apps → "+" → Nova app**: plataforma iOS, nome "eKit – Kit de Emergência", idioma Português (Portugal), Bundle ID acima, SKU `ekit`.
3. **App Store Connect → Utilizadores e acesso → Integrações → App Store Connect API**: gerar uma chave com função *App Manager* e descarregar o ficheiro `.p8` (só pode ser descarregado uma vez).
4. **Codemagic → Team settings → Integrations → Developer Portal → Connect**: usar a chave já existente **`Convocado ASC`** (ou criar uma com outro nome e atualizar `codemagic.yaml`), colar o *Issuer ID*, o *Key ID* e carregar o `.p8`. A chave fica só no Codemagic; nunca a coloque no repositório.

Em cada versão (forma rápida): enviar uma etiqueta `ios-...` para o GitHub arranca a build sozinha:

```bash
git tag ios-1.0.0-3
git push origin ios-1.0.0-3
```

Ou à mão:

1. No Codemagic, abrir a app `ekit` e carregar em **Check for configuration files** (só da primeira vez).
2. **Start new build** → workflow *eKit iOS → TestFlight* → branch `main`.
3. A build (`codemagic.yaml`) instala o Capacitor, copia o site para `www/`, gera o projeto iOS, aplica o ícone e as permissões (localização, bitchat), assina automaticamente e envia para o **TestFlight**.
4. No iPhone, abrir a app **TestFlight** e instalar a eKit para testar.

Para mudar a versão visível (ex.: 1.1.0), altere `APP_VERSION` em `codemagic.yaml`. O número de build aumenta sozinho.

Se uma build falhar, os registos ficam em *Artifacts* (`xcodebuild_logs`).

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

Resposta dada na App Store Connect: **"Nenhum dos algoritmos indicados acima"**. A cifra dos dados (AES-256-GCM, PBKDF2) é feita pela WebCrypto do iOS; a biblioteca Nostr só faz assinaturas digitais e hashes, que são autenticação. O `codemagic.yaml` acrescenta `ITSAppUsesNonExemptEncryption = false` ao Info.plist, para a pergunta não se repetir em cada build. Se a app passar a usar cifra própria, esta declaração tem de ser revista.

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

Nada muda: cada `git push` para `main` atualiza o GitHub Pages. Para a app, inicie uma nova build no Codemagic depois do push.
