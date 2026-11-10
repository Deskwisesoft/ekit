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
  { id: 'evacuacao', icon: '🚶', title: 'Evacuação', steps: [
    'Siga a lista "Antes de sair de casa".',
    'Leve o kit, documentos, medicação e animais de estimação.',
    'Use as rotas indicadas; não tome atalhos.',
    'Informe o seu grupo do local para onde vai.',
  ] },
];

// Áreas de aviso do IPMA (distritos / regiões)
export const IPMA_AREAS = {
  AVR: 'Aveiro', BJA: 'Beja', BRG: 'Braga', BGC: 'Bragança', CBO: 'Castelo Branco', CBR: 'Coimbra',
  EVR: 'Évora', FAR: 'Faro', GDA: 'Guarda', LRA: 'Leiria', LSB: 'Lisboa', PTG: 'Portalegre',
  PTO: 'Porto', STM: 'Santarém', STB: 'Setúbal', VCT: 'Viana do Castelo', VRL: 'Vila Real', VIS: 'Viseu',
  MCN: 'Madeira – Costa Norte', MCS: 'Madeira – Costa Sul', MRM: 'Madeira – Regiões Montanhosas',
  MPS: 'Porto Santo', AOR: 'Açores – Grupo Oriental', ACE: 'Açores – Grupo Central', AOC: 'Açores – Grupo Ocidental',
};

export const IPMA_WARNINGS_URL = 'https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json';

// Pontos de encontro oficiais (dados abertos). Cópia incluída em pontos-encontro.json;
// Lisboa pode ser atualizada em direto (serviço ArcGIS com CORS aberto, licença CC0).
export const LISBOA_POINTS_URL = 'https://services.arcgis.com/1dSrzEWVQn5kHHyK/arcgis/rest/services/POISocorro/FeatureServer/2/query?outFields=NOME,DESIGNACAO,FREGUESIA,CAPACIDADE&where=1%3D1&outSR=4326&f=geojson';

export const ALERT_SOURCES = [
  { name: 'ANEPC – Proteção Civil', url: 'https://prociv.gov.pt', note: 'Avisos e comunicados oficiais' },
  { name: 'IPMA – Avisos meteorológicos', url: 'https://www.ipma.pt/pt/otempo/prev-sam/', note: 'Avisos por distrito' },
  { name: 'Meteoalarm (Europa)', url: 'https://meteoalarm.org', note: 'Avisos meteorológicos em toda a Europa' },
  { name: 'Fogos.pt', url: 'https://fogos.pt', note: 'Incêndios ativos' },
];
