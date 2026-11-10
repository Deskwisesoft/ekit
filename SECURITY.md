# Segurança da eKit

Revisão feita a 10/11/2026 sobre o código completo (site e app). Abaixo, o que foi encontrado, o que foi corrigido e o que fica como risco conhecido.

## Modelo de ameaça

- Sem servidor nem contas: os dados vivem no dispositivo (`localStorage`).
- Dados vindos de fora e **não confiáveis**: ficheiros importados (grupo/cópia), estado e mensagens sincronizados por outros membros via relays Nostr, respostas do IPMA e do ArcGIS de Lisboa.
- Um membro de um grupo pode ser malicioso ou ter o dispositivo comprometido.

## Problemas encontrados e corrigidos

| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | Alta | Coordenadas de um grupo sincronizado eram inseridas sem escape em atributos `href` (links de navegação) → um membro malicioso podia injetar HTML/JS nos dispositivos dos outros. | Validação à entrada (`cleanGroup`): coordenadas só numéricas e dentro de ±90/±180; `navLinks` converte sempre para número. |
| 2 | Alta | Estado remoto de grupo e ficheiros importados aceitavam quaisquer campos (incluindo `__proto__`) e tipos. | Lista branca de campos por pessoa e por grupo, textos com limite de tamanho, tipos verificados (`cleanGroup`, `cleanMember`, `cleanState`). |
| 3 | Média | Números (quantidades, agregado, capacidade dos pontos) eram inseridos sem escape; um ficheiro de cópia adulterado podia injetar HTML. | Normalização de todo o estado no arranque e na importação; capacidade convertida para número. |
| 4 | Média | Um membro podia usar datas no futuro para que as suas edições ganhassem sempre a sincronização. | Datas de alteração limitadas a "agora + 5 min". |
| 5 | Média | Dados de saúde sem consentimento podiam chegar por sincronização ou ficheiro. | Descartados se o consentimento não estiver marcado. |
| 6 | Média | Sem política de segurança de conteúdo; Leaflet carregado de um CDN externo. | CSP restritiva (`script-src 'self'`, ligações só a IPMA, ArcGIS, OpenStreetMap e relays `wss:`); Leaflet servido localmente. |
| 7 | Baixa | Relays configuráveis aceitavam qualquer texto. | Só endereços `ws://`/`wss://` válidos, máximo 10. |
| 8 | Baixa | O nome no chat é escolhido por cada um (pode imitar outra pessoa). | Mostra-se a impressão digital curta do dispositivo (`#abcd`) e é possível bloquear remetentes. |
| 9 | Baixa | O site enviava o *referrer* para serviços externos. | `referrer: no-referrer`. |

Testado com dados maliciosos (HTML em nomes, código em coordenadas, datas futuras, relays `javascript:`): nenhum chegou ao ecrã nem ao armazenamento.

## Já estava bem

- Todo o texto vindo de fora passa por `esc()` antes de ir para o HTML.
- Cifra: AES-256-GCM (WebCrypto) com IV aleatório; ficheiros com PBKDF2-SHA-256 (250 000 iterações); eventos Nostr assinados (BIP-340) e verificados.
- O tópico do grupo nos relays é um hash da chave e não revela o nome.
- O 112 nunca é marcado automaticamente.

## Riscos conhecidos (aceites ou a decidir)

- **Chave do grupo partilhada**: quem a tem pode ler e escrever. Para retirar alguém é preciso "nova chave" e voltar a partilhar o grupo.
- **Relógios dos dispositivos**: a sincronização por "última alteração" depende da hora de cada um.
- **Chave privada Nostr e dados em `localStorage`**: protegidos pelo sistema/navegador, não cifrados em repouso. No telemóvel, recomenda-se bloqueio de ecrã.
- **Relays de terceiros**: guardam texto cifrado e veem IP e horas. Para máxima privacidade, usar um relay próprio (Definições).
- **Palavra-passe fraca** num ficheiro de partilha enfraquece a cifra. Mínimo de 8 caracteres; recomenda-se uma frase.
- **`style-src 'unsafe-inline'`** é necessário para o Leaflet; não permite executar código.

## Reportar uma vulnerabilidade

Abra um *issue* privado (Security advisory) em https://github.com/Deskwisesoft/ekit/security/advisories/new.
