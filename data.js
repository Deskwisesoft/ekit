// Conteúdo base: kit recomendado (72h), números de emergência, guias e fontes de alertas.
// Baseado nas recomendações da UE (autossuficiência 72h) e da ANEPC. Rever periodicamente.

export const CATEGORIES = [
  { id: 'agua', name: 'Água e alimentação', icon: '💧' },
  { id: 'saude', name: 'Saúde e higiene', icon: '🩹' },
  { id: 'energia', name: 'Energia e comunicação', icon: '🔦' },
  { id: 'docs', name: 'Documentos e dinheiro', icon: '📄' },
  { id: 'abrigo', name: 'Ferramentas e abrigo', icon: '🧰' },
  { id: 'outros', name: 'Outros', icon: '📦' },
];

// perPerson: a quantidade é multiplicada pelo nº de pessoas do agregado.
// expires: sugere preencher a data de validade.
export const DEFAULT_KIT = [
  ['agua', 'Água potável (2 L/pessoa/dia, 3 dias)', 6, 'L', true, true],
  ['agua', 'Comida não perecível (enlatados, barras, frutos secos)', 3, 'dias', true, true],
  ['agua', 'Abre-latas manual', 1, 'un', false, false],
  ['agua', 'Comida para bebé / animais (se aplicável)', 0, 'dias', false, true],
  ['saude', 'Kit de primeiros socorros', 1, 'un', false, true],
  ['saude', 'Medicação habitual (7 dias) + cópia das receitas', 1, 'conj.', true, true],
  ['saude', 'Máscaras e desinfetante', 1, 'conj.', false, true],
  ['saude', 'Produtos de higiene, papel higiénico, sacos do lixo', 1, 'conj.', false, false],
  ['saude', 'Óculos / lentes suplentes', 0, 'un', false, false],
  ['energia', 'Lanterna (de preferência frontal)', 1, 'un', true, false],
  ['energia', 'Pilhas extra', 1, 'conj.', false, true],
  ['energia', 'Rádio a pilhas ou a manivela', 1, 'un', false, false],
  ['energia', 'Powerbank carregado + cabos', 1, 'un', false, false],
  ['energia', 'Apito', 1, 'un', true, false],
  ['energia', 'Fósforos / isqueiro e velas', 1, 'conj.', false, false],
  ['docs', 'Cópias de documentos (CC, seguros, escrituras) em saco estanque', 1, 'conj.', false, false],
  ['docs', 'Dinheiro em numerário (notas pequenas)', 1, 'conj.', false, false],
  ['docs', 'Chaves suplentes (casa, carro)', 1, 'conj.', false, false],
  ['docs', 'Lista de contactos em papel', 1, 'un', false, false],
  ['docs', 'Mapa da zona com pontos de encontro', 1, 'un', false, false],
  ['abrigo', 'Canivete multiusos', 1, 'un', false, false],
  ['abrigo', 'Fita adesiva resistente', 1, 'un', false, false],
  ['abrigo', 'Manta térmica', 1, 'un', true, false],
  ['abrigo', 'Roupa quente e impermeável, calçado resistente', 1, 'conj.', true, false],
  ['abrigo', 'Luvas de trabalho', 1, 'par', false, false],
  ['abrigo', 'Saco-cama ou cobertor', 1, 'un', true, false],
].map(([cat, name, qty, unit, perPerson, expires]) => ({ cat, name, qty, unit, perPerson, expires }));

export const EMERGENCY_NUMBERS = [
  { name: 'Número Europeu de Emergência', phone: '112', note: 'Funciona em toda a UE, mesmo sem saldo' },
  { name: 'SNS 24', phone: '808242424', note: 'Aconselhamento de saúde' },
  { name: 'Centro de Informação Antivenenos', phone: '800250250', note: 'Intoxicações' },
  { name: 'Linha de Emergência Social', phone: '144', note: 'Apoio social urgente' },
];

export const DEFAULT_LISTS = [
  { name: 'Antes de sair de casa (evacuação)', items: [
    'Pegar no kit de emergência', 'Desligar gás, água e quadro elétrico', 'Fechar portas e janelas',
    'Levar medicação e documentos', 'Avisar o grupo/família do destino', 'Seguir as rotas indicadas pelas autoridades',
  ] },
  { name: 'Revisão semestral do kit', items: [
    'Verificar validades de água e comida', 'Testar lanterna e rádio', 'Trocar pilhas se necessário',
    'Carregar powerbank', 'Atualizar medicação e receitas', 'Confirmar contactos e ponto de encontro',
    'Simulacro: ir com a família ao ponto de encontro', 'Exportar uma cópia de segurança da eKit',
  ] },
  { name: 'Documentos importantes (cópias no kit)', items: [
    'Cartão de cidadão / passaporte', 'Cartão de utente e receitas', 'Apólices de seguro (casa, saúde, carro)',
    'Contactos em papel (cartão da família)', 'Algum dinheiro em notas e moedas', 'Chaves suplentes de casa e do carro',
  ] },
  { name: 'Vizinhos a verificar', items: [
    'Saber quem na rua ou no prédio vive sozinho ou tem mobilidade reduzida',
    'Combinar quem bate à porta de quem numa emergência', 'Ter o telefone de um vizinho de confiança',
  ] },
];

export const GUIDES = [
  { id: 'sismo', icon: '🌍', title: 'Sismo', steps: [
    'Durante: BAIXAR, PROTEGER, AGUARDAR — debaixo de uma mesa resistente ou junto a uma parede interior.',
    'Afaste-se de janelas, espelhos e objetos que possam cair.',
    'Não use elevadores. Não corra para a rua durante o abalo.',
    'Depois: verifique feridos, cheiro a gás e danos. Se cheirar a gás, saia e não acione interruptores.',
    'Esteja preparado para réplicas. Ouça a rádio e siga as autoridades.',
  ] },
  { id: 'inundacao', icon: '🌊', title: 'Inundação', steps: [
    'Suba para pisos superiores. Leve o kit, documentos e medicação.',
    'Desligue a eletricidade e o gás se for seguro.',
    'Nunca atravesse zonas inundadas a pé ou de carro — 30 cm de água podem arrastar um carro.',
    'Não beba água da torneira até as autoridades confirmarem que é segura.',
  ] },
  { id: 'incendio', icon: '🔥', title: 'Incêndio rural', steps: [
    'Se receber ordem de evacuação, saia de imediato pelas rotas indicadas.',
    'Se ficar em casa: feche janelas e portas, molhe a envolvente, tenha mangueiras prontas.',
    'Proteja-se do fumo com pano húmido sobre nariz e boca.',
    'Ligue 112 se avistar um incêndio. Consulte o aviso de risco de incêndio diário.',
  ] },
  { id: 'apagao', icon: '🔌', title: 'Falha de energia prolongada', steps: [
    'Use lanternas, não velas, sempre que possível.',
    'Mantenha frigorífico e congelador fechados (conservam 4 a 24 h).',
    'Ouça a rádio a pilhas para informações oficiais.',
    'Poupe a bateria do telemóvel: modo de poupança, só chamadas essenciais.',
    'Desligue aparelhos sensíveis para evitar danos no regresso da corrente.',
  ] },
  { id: 'vento', icon: '🌬', title: 'Vento forte e tempestade', steps: [
    'Recolha ou prenda vasos, toldos e objetos soltos em varandas e quintais.',
    'Afaste-se de árvores, andaimes, muros, postes e estruturas que possam cair.',
    'Adie viagens que não sejam essenciais e evite a orla costeira.',
    'Em casa, feche janelas e estores e afaste-se dos vidros.',
    'Se faltar a luz, use lanternas e siga o guia "Falha de energia".',
  ] },
  { id: 'chuva', icon: '🌧', title: 'Chuva forte e trovoada', steps: [
    'Não atravesse ruas ou estradas com água a correr, nem a pé nem de carro.',
    'Afaste-se de rios, ribeiras, túneis e passagens inferiores.',
    'Durante a trovoada, fique dentro de casa, longe de janelas, e desligue aparelhos da tomada.',
    'Se a água começar a entrar, desligue a eletricidade se for seguro e suba para um piso superior com o kit.',
  ] },
  { id: 'calor', icon: '☀️', title: 'Onda de calor', steps: [
    'Beba água regularmente, mesmo sem sede.',
    'Evite exposição ao sol entre as 11h e as 17h.',
    'Acompanhe idosos, crianças e pessoas com doença crónica.',
    'Mantenha a casa fresca: estores fechados de dia, ventilar à noite.',
  ] },
  { id: 'abrigo', icon: '🏠', title: 'Confinamento (acidente químico/nuclear)', steps: [
    'Entre no edifício mais próximo e fique lá dentro.',
    'Feche portas, janelas e desligue ventilação/ar condicionado.',
    'Escolha uma divisão interior; vede frinchas com fita adesiva e panos húmidos.',
    'Sintonize a rádio e só saia quando as autoridades indicarem.',
  ] },
  { id: 'tsunami', icon: '🌊', title: 'Tsunami', steps: [
    'Se sentir um sismo forte junto à costa ou vir o mar recuar de repente: não espere por avisos.',
    'Afaste-se logo da costa, a pé, para uma zona alta (mais de 30 m) ou para o ponto de tsunami mais próximo.',
    'Se não conseguir sair, suba aos pisos mais altos de um edifício resistente.',
    'Podem vir várias ondas durante horas. Só regresse quando as autoridades indicarem.',
  ] },
  { id: 'telemovel', prep: true, icon: '📱', title: 'Preparar o telemóvel', steps: [
    'Ative os alertas de emergência. iPhone: Definições › Notificações › Alertas de emergência. Android: Definições › Segurança e emergência › Alertas de emergência sem fios.',
    'Preencha a ficha médica e mostre-a no ecrã bloqueado. iPhone: app Saúde › Ficha médica. Android: Segurança e emergência › Informações médicas.',
    'Adicione contactos de emergência na ficha médica: os socorristas veem-nos sem desbloquear o telemóvel.',
    'Guarde o mapa da sua zona sem internet (Mapa › Guardar mapa da minha zona) e imprima o cartão da família.',
    'Tenha uma powerbank carregada e um carregador no kit.',
  ] },
  { id: 'evacuacao', icon: '🚶', title: 'Evacuação', steps: [
    'Siga a lista "Antes de sair de casa".',
    'Leve o kit, documentos, medicação e animais de estimação.',
    'Use as rotas indicadas; não tome atalhos.',
    'Informe o seu grupo do local para onde vai.',
  ] },
];

// Simulacro: um ensaio do plano com a família (de 6 em 6 meses).
GUIDES.push({ id: 'simulacro', prep: true, icon: '🚶', title: 'Simulacro com a família', steps: [
  'Combinem um dia e uma hora com todos os que vivem consigo.',
  'Cada um sai de onde estiver e vai pelo seu caminho até ao ponto de encontro.',
  'Contem quanto tempo demoraram e onde alguém teve dúvidas.',
  'Confirmem o ponto alternativo, para o caso de o principal estar inacessível.',
  'Revejam juntos o kit e os contactos.',
] });

// Avisos do IPMA → guia sugerido no modo emergência.
export const ALERT_GUIDES = { 'Vento': 'vento', 'Agitação Marítima': 'vento', 'Precipitação': 'chuva', 'Trovoada': 'chuva', 'Tempo Quente': 'calor' };

// Os 10 essenciais do kit (aparecem primeiro).
export const ESSENTIALS = ['Água potável', 'Comida não perecível', 'Kit de primeiros socorros', 'Medicação habitual', 'Lanterna',
  'Pilhas extra', 'Rádio a pilhas', 'Powerbank', 'Cópias de documentos', 'Dinheiro em numerário'];

// Áreas de aviso do IPMA (distritos / regiões)
export const IPMA_AREAS = {
  AVR: 'Aveiro', BJA: 'Beja', BRG: 'Braga', BGC: 'Bragança', CBO: 'Castelo Branco', CBR: 'Coimbra',
  EVR: 'Évora', FAR: 'Faro', GDA: 'Guarda', LRA: 'Leiria', LSB: 'Lisboa', PTG: 'Portalegre',
  PTO: 'Porto', STM: 'Santarém', STB: 'Setúbal', VCT: 'Viana do Castelo', VRL: 'Vila Real', VIS: 'Viseu',
  MCN: 'Madeira – Costa Norte', MCS: 'Madeira – Costa Sul', MRM: 'Madeira – Regiões Montanhosas',
  MPS: 'Porto Santo', AOR: 'Açores – Grupo Oriental', ACE: 'Açores – Grupo Central', AOC: 'Açores – Grupo Ocidental',
};

// Capitais de distrito (aproximação offline para escolher a zona dos avisos).
export const DISTRICT_CAPITALS = {
  AVR: [40.641, -8.654], BJA: [38.015, -7.865], BRG: [41.551, -8.420], BGC: [41.806, -6.757], CBO: [39.822, -7.491],
  CBR: [40.205, -8.419], EVR: [38.571, -7.909], FAR: [37.019, -7.930], GDA: [40.537, -7.268], LRA: [39.744, -8.807],
  LSB: [38.722, -9.139], PTG: [39.297, -7.428], PTO: [41.150, -8.611], STM: [39.236, -8.687], STB: [38.524, -8.888],
  VCT: [41.693, -8.832], VRL: [41.300, -7.744], VIS: [40.657, -7.913],
};
// OpenStreetMap (Overpass): bombeiros, polícia e distrito da zona. Só com pedido do utilizador.
export const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// Antena 1 por zona de aviso (fonte: RTP, antena1.rtp.pt/frequencias). FM em MHz, onda média (OM) em kHz.
export const RADIO_SOURCE = 'https://antena1.rtp.pt/frequencias/';
export const RADIO_A1 = {
  AVR: 'Lousã 87.9 · Arestal 106.7',
  BJA: 'Mendro 87.7 · Mértola 90.9 · OM Elvas 720',
  BRG: 'Braga 91.3 · Muro 88.3',
  BGC: 'Bragança 96.4 · Bornes 92.8 · Miranda do Douro 90.3 · OM Bragança 666',
  CBO: 'Gardunha 96.4 · Castelo Branco 89.9 · OM Castelo Branco 720',
  CBR: 'Coimbra 94.9 · Lousã 87.9 · OM Coimbra 630',
  EVR: 'Elvas 103.8 · Mendro 87.7 · Serra de Ossa 88.4 · OM Elvas 720',
  FAR: 'Faro 97.6 · Monchique 88.9 · Alcoutim 88.9',
  GDA: 'Guarda 94.7 · Marofa 97.2 · Manteigas 104.8 · OM Guarda 720',
  LRA: 'Leiria 98.7 · Lousã 87.9 · Montejunto 98.3 · OM Coimbra 630',
  LSB: 'Monsanto 95.7 · Banática 99.4 · Montejunto 98.3 · Janas 96.9 · OM 666',
  PTG: 'Portalegre 97.9 · Elvas 103.8 · Montargil 93.6 · OM Portalegre 1287',
  PTO: 'Monte da Virgem 96.7 · Muro 88.3 · Marão 95.2',
  STM: 'Santarém 98.8 · Montejunto 98.3 · OM 666',
  STB: 'Monsanto 95.7 · Tróia 106.7 · Grândola 99.2 · OM 666',
  VCT: 'Muro 88.3 · Moledo 102.9 · Valença 98.2 · Paredes de Coura 102.9 · OM Valença 666',
  VRL: 'Marão 95.2 · Minhéu 94.9 · S. Domingos 87.9 · OM Vila Real 666',
  VIS: 'Lousã 87.9 · Gravia 104.5 · Viseu 88.2 · S. Domingos 87.9 · OM Viseu 666',
  AOR: 'S. Miguel: Ponta Delgada 94.1 · Pico da Barrosa 97.9 · Furnas 93.6 · Nordeste 104.6 · Povoação 102.8 · Pico das Éguas 89.5 · Sta. Maria: Pico Alto 96.7',
  ACE: 'Terceira: Sta. Bárbara 90.5 · Serra do Cume 99.7 · Faial: Cabeço Gordo 88.9 · Espalamaca 93.8 · Pico: Arrife 94.5 · Lajes do Pico 96.5 · S. Jorge: Macela 87.6 · Graciosa: Pico do Jardim 97.0',
  AOC: 'Flores: Fajãzinha 100.4 · Lajes das Flores 102.6 · Monte das Cruzes 99.8 · Corvo: Monte das Cruzes 99.8 · OM 828',
  MCN: 'Funchal (Monte) 104.6 · Pico do Areeiro 95.5 · Encumeada 93.1 · Achadas da Cruz 104.3 · Maçapez 92.0 · Gaula 98.5',
  MCS: 'Funchal (Monte) 104.6 · Cabo Girão 96.7 · Caniço 101.6 · Ribeira Brava 105.6 · Calheta 105.4 · Ponta do Pargo 90.2',
  MRM: 'Pico do Areeiro 95.5 · Paúl da Serra 101.9 · Encumeada 93.1 · Funchal (Monte) 104.6',
  MPS: 'Porto Santo 100.5',
};

// Risco de incêndio rural (IPMA), por concelho: hoje (d0) e amanhã (d1).
export const FIRE_RISK_URL = d => `https://api.ipma.pt/open-data/forecast/meteorology/rcm/rcm-d${d}.json`;
export const FIRE_LEVELS = ['', 'Reduzido', 'Moderado', 'Elevado', 'Muito elevado', 'Máximo'];

// Sismos (IPMA): área 7 = continente e Madeira, área 3 = Açores.
export const SEISMIC_URL = area => `https://api.ipma.pt/open-data/observation/seismic/${area}.json`;

export const IPMA_WARNINGS_URL = 'https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json';

// Pontos de encontro oficiais (dados abertos). Cópia incluída em pontos-encontro.json;
// Lisboa pode ser atualizada em direto (serviço ArcGIS com CORS aberto, licença CC0).
export const LISBOA_POINTS_URL = 'https://services.arcgis.com/1dSrzEWVQn5kHHyK/arcgis/rest/services/POISocorro/FeatureServer/2/query?outFields=NOME,DESIGNACAO,FREGUESIA,CAPACIDADE&where=1%3D1&outSR=4326&f=geojson';

export const ALERT_SOURCES = [
  { name: 'ANEPC – Proteção Civil', url: 'https://prociv.gov.pt', note: 'Avisos e comunicados oficiais' },
  { name: 'IPMA – Avisos meteorológicos', url: 'https://www.ipma.pt/pt/otempo/prev-sam/', note: 'Avisos por distrito' },
  { name: 'Meteoalarm (Europa)', url: 'https://meteoalarm.org', note: 'Avisos meteorológicos em toda a Europa' },
  { name: 'Fogos.pt', url: 'https://fogos.pt', note: 'Incêndios ativos (dados da Proteção Civil)' },
  { name: 'ANEPC – Ocorrências', url: 'https://prociv.gov.pt/pt/home/ocorrencias/', note: 'Ocorrências em curso em Portugal continental' },
];
