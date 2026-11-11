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

// Kits por situação (inspirado nas recomendações da ANEPC e da UE).
export const KITS = [
  { id: 'casa', name: 'Casa (72 horas)', short: 'Casa', desc: 'Para ficar em casa 3 dias sem luz, água ou lojas.' },
  { id: 'mochila', name: 'Mochila de evacuação', short: 'Mochila', desc: 'Pronta junto à porta, para sair de casa em poucos minutos.' },
  { id: 'carro', name: 'Carro', short: 'Carro', desc: 'Para ficar retido na estrada ou ter de sair de carro.' },
  { id: 'animais', name: 'Animais', short: 'Animais', desc: 'Para levar consigo os animais da família.' },
];
// Artigos dos outros kits: [kit, categoria, nome, quantidade, unidade, por pessoa, tem validade, essencial]
export const EXTRA_KIT = [
  ['mochila', 'agua', 'Água em garrafas pequenas', 2, 'L', true, true, true],
  ['mochila', 'agua', 'Barras energéticas e comida pronta a comer', 3, 'un', true, true, true],
  ['mochila', 'agua', 'Pastilhas ou filtro para purificar água', 1, 'conj.', false, true, false],
  ['mochila', 'saude', 'Kit de primeiros socorros compacto', 1, 'un', false, true, true],
  ['mochila', 'saude', 'Medicação habitual (3 dias) e cópia das receitas', 1, 'conj.', true, true, true],
  ['mochila', 'saude', 'Máscaras FFP2', 2, 'un', true, true, false],
  ['mochila', 'saude', 'Kit de higiene (escova, pasta, sabonete, pensos)', 1, 'conj.', true, false, false],
  ['mochila', 'saude', 'Gel desinfetante e toalhitas', 1, 'conj.', false, true, false],
  ['mochila', 'energia', 'Lanterna frontal e pilhas', 1, 'conj.', true, false, true],
  ['mochila', 'energia', 'Rádio pequeno a pilhas ou a manivela', 1, 'un', false, false, true],
  ['mochila', 'energia', 'Powerbank carregado e cabos', 1, 'un', false, false, true],
  ['mochila', 'energia', 'Apito', 1, 'un', true, false, true],
  ['mochila', 'energia', 'Isqueiro ou fósforos à prova de água', 1, 'un', false, false, false],
  ['mochila', 'docs', 'Cópias de documentos em saco estanque', 1, 'conj.', false, false, true],
  ['mochila', 'docs', 'Dinheiro em notas pequenas e moedas', 1, 'conj.', false, false, true],
  ['mochila', 'docs', 'Cartão da família e contactos em papel', 1, 'un', false, false, true],
  ['mochila', 'docs', 'Mapa em papel da zona', 1, 'un', false, false, false],
  ['mochila', 'docs', 'Caneta e bloco', 1, 'conj.', false, false, false],
  ['mochila', 'abrigo', 'Manta térmica', 1, 'un', true, false, true],
  ['mochila', 'abrigo', 'Impermeável ou poncho', 1, 'un', true, false, false],
  ['mochila', 'abrigo', 'Muda de roupa, meias e roupa interior', 1, 'conj.', true, false, false],
  ['mochila', 'abrigo', 'Canivete multiusos', 1, 'un', false, false, false],
  ['mochila', 'abrigo', 'Corda fina (10 m) e fita adesiva', 1, 'conj.', false, false, false],
  ['mochila', 'abrigo', 'Sacos do lixo resistentes', 3, 'un', false, false, false],
  ['mochila', 'abrigo', 'Luvas de trabalho', 1, 'par', false, false, false],
  ['carro', 'agua', 'Água (garrafas)', 2, 'L', false, true, true],
  ['carro', 'agua', 'Barras energéticas', 4, 'un', false, true, true],
  ['carro', 'saude', 'Kit de primeiros socorros', 1, 'un', false, true, true],
  ['carro', 'energia', 'Lanterna e pilhas', 1, 'conj.', false, false, true],
  ['carro', 'energia', 'Carregador de isqueiro para telemóvel', 1, 'un', false, false, true],
  ['carro', 'abrigo', 'Colete refletor e triângulo', 1, 'conj.', false, false, true],
  ['carro', 'abrigo', 'Manta térmica ou cobertor', 2, 'un', false, false, true],
  ['carro', 'abrigo', 'Roupa quente e impermeável', 1, 'conj.', false, false, false],
  ['carro', 'abrigo', 'Cabos de arranque da bateria', 1, 'un', false, false, false],
  ['carro', 'abrigo', 'Pá pequena dobrável', 1, 'un', false, false, false],
  ['carro', 'docs', 'Mapa em papel', 1, 'un', false, false, false],
  ['carro', 'outros', 'Depósito sempre acima de metade', 1, 'hábito', false, false, true],
  ['animais', 'agua', 'Comida do animal para 3 dias', 3, 'dias', false, true, true],
  ['animais', 'agua', 'Água para o animal e taça dobrável', 1, 'conj.', false, false, true],
  ['animais', 'abrigo', 'Trela, coleira e transportadora', 1, 'conj.', false, false, true],
  ['animais', 'docs', 'Cópia do boletim de vacinas e do registo', 1, 'un', false, false, true],
  ['animais', 'docs', 'Fotografia recente do animal', 1, 'un', false, false, true],
  ['animais', 'saude', 'Medicação do animal', 1, 'conj.', false, true, false],
  ['animais', 'saude', 'Sacos higiénicos ou areia', 1, 'conj.', false, false, false],
  ['animais', 'abrigo', 'Manta ou brinquedo conhecido', 1, 'un', false, false, false],
].map(([kit, cat, name, qty, unit, perPerson, expires, ess]) => ({ kit, cat, name, qty, unit, perPerson, expires, ess }));

// "Como escolher": conselhos curtos por artigo (o nome começa por…). Sem marcas nem lojas.
export const TIPS = [
  ['Água', 'Garrafas fechadas de fábrica. Conte 2 litros por pessoa e por dia (mais com calor) e troque-as antes da validade.'],
  ['Comida não perecível', 'O que não precisa de frigorífico nem de cozinhar: conservas de abertura fácil, feijão, atum, fruta seca, bolachas. Escolha o que a família já come.'],
  ['Barras energéticas', 'Leves e prontas a comer. Troque-as antes da validade e coma-as no dia a dia para não as desperdiçar.'],
  ['Abre-latas', 'Manual e metálico: um abre-latas elétrico não serve sem luz.'],
  ['Pastilhas ou filtro', 'Pastilhas de purificação ou um filtro portátil, para quando só houver água de origem duvidosa.'],
  ['Kit de primeiros socorros', 'Pensos, compressas, ligaduras, desinfetante, tesoura, luvas e termómetro. Verifique as validades.'],
  ['Medicação', 'Alguns dias de cada medicamento e cópia das receitas. Fale com o médico de família para manter esta reserva.'],
  ['Máscaras', 'FFP2 protegem do fumo fino e de poeiras. Guarde-as na embalagem.'],
  ['Lanterna', 'Frontal deixa as mãos livres. Prefira LED e pilhas iguais às do rádio (AA).'],
  ['Pilhas', 'Do mesmo tamanho que a lanterna e o rádio. Guarde-as fora dos aparelhos.'],
  ['Rádio', 'A pilhas AA ou com manivela/solar, com FM. Num apagão é por aqui que chega a informação oficial.'],
  ['Powerbank', 'Pelo menos 10 000 mAh, com os cabos certos. Recarregue-o a cada 3 meses.'],
  ['Apito', 'Ouve-se mais longe do que a voz e cansa menos, se ficar preso.'],
  ['Cópias de documentos', 'Cartão de cidadão, seguros e receitas, em papel, dentro de um saco estanque (zip).'],
  ['Dinheiro', 'Notas pequenas e moedas: sem luz, multibancos e cartões podem não funcionar.'],
  ['Cartão da família', 'Imprima-o em Menu › Cartão da família e guarde uma cópia na mochila.'],
  ['Manta térmica', 'Leve e pequena; com o lado dourado para fora conserva o calor do corpo.'],
  ['Colete refletor', 'Obrigatório. Deixe-o ao alcance do condutor, sem ter de sair do lugar.'],
  ['Carregador de isqueiro', 'Para carregar o telemóvel com o motor ligado.'],
  ['Depósito', 'Abasteça quando chegar a metade: numa evacuação as bombas podem estar fechadas ou cheias.'],
  ['Comida do animal', 'A ração habitual, em embalagem fechada. Vá trocando para não passar a validade.'],
  ['Trela', 'Ponha na transportadora o nome do animal e o seu telefone.'],
  ['Fotografia recente do animal', 'Ajuda a identificá-lo se se perder. Guarde também uma no telemóvel.'],
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
    'Pegar na mochila de evacuação', 'Desligar gás, água e quadro elétrico', 'Fechar portas e janelas',
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
  { id: 'incendio_casa', icon: '🔥', title: 'Incêndio em casa ou no prédio', steps: [
    'Saia logo e avise quem está consigo. Não volte atrás para buscar objetos.',
    'Se houver fumo, desloque-se rente ao chão e tape o nariz e a boca com um pano.',
    'Antes de abrir uma porta, toque-lhe com as costas da mão: se estiver quente, não a abra.',
    'Feche as portas atrás de si para atrasar o fogo. Não use o elevador.',
    'Se não conseguir sair, feche-se numa divisão com janela, tape as frestas com panos molhados e faça-se ver à janela.',
    'Já em segurança, ligue 112 e vá para o ponto de encontro.',
  ] },
  { id: 'gas', icon: '⚠️', title: 'Cheiro a gás', steps: [
    'Não acenda luzes nem mexa em interruptores, isqueiros ou fichas.',
    'Abra portas e janelas para arejar.',
    'Feche a válvula do gás (no contador ou na garrafa) se for seguro.',
    'Saia de casa e avise os vizinhos.',
    'Já lá fora, ligue 112 ou a linha de emergência do seu fornecedor de gás.',
  ] },
  { id: 'calor', icon: '☀️', title: 'Onda de calor', steps: [
    'Beba água regularmente, mesmo sem sede.',
    'Evite exposição ao sol entre as 11h e as 17h.',
    'Acompanhe idosos, crianças e pessoas com doença crónica.',
    'Mantenha a casa fresca: estores fechados de dia, ventilar à noite.',
  ] },
  { id: 'frio', icon: '❄️', title: 'Onda de frio', steps: [
    'Vista várias camadas de roupa, gorro e luvas, e mantenha os pés secos.',
    'Aqueça só uma divisão e feche as outras.',
    'Nunca use fogareiros, braseiras ou geradores dentro de casa: libertam monóxido de carbono.',
    'Coma refeições quentes e beba líquidos quentes; evite o álcool.',
    'Acompanhe idosos, crianças e vizinhos que vivem sozinhos.',
  ] },
  { id: 'agua', icon: '🚱', title: 'Falta prolongada de água', steps: [
    'Use primeiro a água guardada no kit para beber e cozinhar.',
    'Guarde 2 litros por pessoa e por dia só para beber.',
    'Para a higiene, use gel desinfetante e toalhitas.',
    'Não beba água de origem desconhecida sem a ferver ou purificar.',
    'Siga as indicações da Câmara e dos serviços de água sobre os pontos de abastecimento.',
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
export const ALERT_GUIDES = { 'Vento': 'vento', 'Agitação Marítima': 'vento', 'Precipitação': 'chuva', 'Trovoada': 'chuva', 'Tempo Quente': 'calor', 'Tempo Frio': 'frio', 'Neve': 'frio' };

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
