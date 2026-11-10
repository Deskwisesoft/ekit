# eKit – Kit de Emergência

PWA (site + app instalável) para preparar e verificar o kit de emergência de 72 h recomendado pela UE e pela ANEPC. Funciona offline e guarda os dados apenas no dispositivo.

## Correr localmente

```bash
python -m http.server 8765
```

Abrir http://localhost:8765. Para instalar no telemóvel, publicar em HTTPS (ex.: GitHub Pages, Netlify) e usar "Adicionar ao ecrã principal".

## Funcionalidades

- **Kit**: checklist por categorias, quantidades por pessoa, local de arrumação, validades.
- **Validades**: avisos no painel, notificações ao abrir a app, exportação para calendário (.ics).
- **Contactos**: números de emergência (112, SNS 24…) e contactos pessoais com chamada direta.
- **Grupos**: família/vizinhos/equipa, cada grupo isolado; partilha por ficheiro cifrado (AES-256-GCM + PBKDF2).
- **Mapa**: pontos de encontro dos grupos com coordenadas GPS, pontos oficiais, "mais próximos de mim" (funciona sem rede).
- **Chat do grupo**: com internet via relays Nostr, cifrado com uma chave só do grupo (AES-256-GCM); mensagens escritas sem rede ficam em fila. Sem internet, passa para o **bitchat** (Bluetooth mesh): partilha de "estou bem + ponto de encontro + GPS" pela folha de partilha do sistema e atalho `bitchat://`.
- **Listas**: evacuação, revisão semestral, listas próprias.
- **Guia**: sismo, inundação, incêndio, apagão, calor, confinamento, evacuação.
- **Alertas**: avisos do IPMA por distrito (guardados para consulta offline) e fontes oficiais.

## Dados abertos usados

| Dados | Fonte | Licença |
|---|---|---|
| 86 pontos de encontro de emergência de Lisboa | Câmara Municipal de Lisboa (PMEPC), via dados.gov.pt / ArcGIS | CC0 |
| 24 pontos de encontro de tsunami de Cascais | dadosabertos.cascais.pt | CC-BY |
| Avisos meteorológicos | API aberta do IPMA | — |
| Mapa base | OpenStreetMap | ODbL |

A cópia incluída está em `pontos-encontro.json` (gerada a 2026-11-10). Lisboa pode ser atualizada a partir da app.

## RGPD

- Sem servidor e sem contas: os dados ficam no `localStorage` do dispositivo.
- Os grupos só são partilhados por exportação explícita e cifrada.
- Dados de saúde (art. 9.º) exigem consentimento registado por pessoa.
- Chat: os relays Nostr (terceiros) guardam só texto cifrado, um identificador aleatório do dispositivo e a hora. A chave do grupo só viaja no ficheiro cifrado de partilha; "nova chave" retira o acesso a quem saiu. Os relays podem ser trocados nas Definições.
- bitchat: o canal `#mesh` é público para quem está perto; assuntos privados devem ir por mensagem privada.
- Botão para apagar todos os dados.
