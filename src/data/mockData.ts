import { Business, Client, Reservation, Alert, ShiftNote, CalendarEvent } from '@/types';

export const BUSINESSES: Business[] = [
  { id: 'el-ganxo', name: 'El Ganxo', type: 'Restaurant · Peix i marisc', address: 'Passeig Marítim 14', initials: 'EG', color: 'bg-emerald-600', reservationCount: 24 },
  { id: 'la-pista', name: 'La Pista', type: 'Padel · Bar restaurant', address: 'Carrer Major 8', initials: 'LP', color: 'bg-purple-600', reservationCount: 0 },
  { id: 'lesquitx', name: "L'Esquitx", type: 'Tapes i còctels', address: 'Plaça Nova 3', initials: 'LE', color: 'bg-teal-600', reservationCount: 0 },
];

export const CLIENTS: Client[] = [
  {
    id: 'c1', fullName: 'Marta Puig', phone: '+34 612 345 678',
    allergies: [], importantNotes: 'Prefereix taula de finestra. Client habitual des de 2019.',
    preferences: 'Taula 12 (finestra)', tags: ['habitual', 'vip'],
    visitHistory: [
      { date: '2026-04-24', businessId: 'el-ganxo', guestCount: 4, notes: 'Taula 12-finestra', reservationId: 'r1' },
      { date: '2026-03-15', businessId: 'el-ganxo', guestCount: 2, notes: '', reservationId: 'r-old-1' },
      { date: '2026-02-08', businessId: 'el-ganxo', guestCount: 6, notes: 'Aniversari', reservationId: 'r-old-2' },
    ],
    internalComments: [{ id: 'cc1', text: 'Sempre puntual, molt educada. Prefereix taula de finestra sense excepció.', authorName: 'Èlia Masdeu', date: '2026-03-15' }],
    businessId: 'el-ganxo',
  },
  {
    id: 'c2', fullName: 'Jordi Roca', phone: '+34 634 567 890',
    allergies: [], importantNotes: '', preferences: '',
    tags: ['habitual'],
    visitHistory: [{ date: '2026-04-24', businessId: 'el-ganxo', guestCount: 2, notes: '', reservationId: 'r2' }],
    internalComments: [],
  },
  {
    id: 'c3', fullName: 'Família Serra', phone: '+34 655 789 012',
    allergies: [], importantNotes: 'Cadira infantil necessària.', preferences: 'Zona tranquil·la si és possible.',
    tags: [],
    visitHistory: [{ date: '2026-04-24', businessId: 'el-ganxo', guestCount: 6, notes: 'Una cadira infantil', reservationId: 'r3' }],
    internalComments: [],
  },
  {
    id: 'c4', fullName: 'Anna Vilanova', phone: '+34 678 901 234',
    allergies: [], importantNotes: 'Trucar per confirmar si no respon en 30 min.', preferences: '',
    tags: [],
    visitHistory: [{ date: '2026-04-24', businessId: 'el-ganxo', guestCount: 2, notes: '', reservationId: 'r4' }],
    internalComments: [{ id: 'cc4', text: 'Ja ha cancel·lat 2 vegades. Confirmar sempre per telèfon.', authorName: 'Èlia Masdeu', date: '2026-04-10' }],
  },
  {
    id: 'c5', fullName: 'Marc Esteve', phone: '+34 601 234 567',
    allergies: ['marisc', 'mol·luscs'], importantNotes: 'Al·lèrgia a marisc i mol·luscs. Informar cuina SEMPRE.',
    preferences: '', tags: ['al·lergia'],
    visitHistory: [{ date: '2026-04-24', businessId: 'el-ganxo', guestCount: 4, notes: "Al·lèrgia mariscs — un comensal", reservationId: 'r5' }],
    internalComments: [{ id: 'cc5', text: 'IMPORTANT: al·lèrgia mariscs verificada. El cuiner ha estat informat.', authorName: 'Pep Soler', date: '2026-04-24' }],
    businessId: 'el-ganxo',
  },
  {
    id: 'c6', fullName: 'Oriol Puig', phone: '+34 699 111 222',
    allergies: [], importantNotes: 'Soci fundador. Tracte preferent sempre.', preferences: 'Taula 4 (reservada habitualment)',
    tags: ['vip', 'habitual'],
    visitHistory: [
      { date: '2026-04-24', businessId: 'el-ganxo', guestCount: 4, notes: 'VIP - soci, taula 4', reservationId: 'r6' },
      { date: '2026-04-10', businessId: 'el-ganxo', guestCount: 2, notes: '', reservationId: 'r-old-3' },
    ],
    internalComments: [{ id: 'cc6', text: 'Soci des del primer dia. Sempre benvingut, taula 4 si disponible.', authorName: 'Direcció', date: '2026-01-01' }],
  },
  {
    id: 'c7', fullName: 'Helena Martí', phone: '+34 611 333 444',
    allergies: [], importantNotes: '', preferences: '',
    tags: [],
    visitHistory: [{ date: '2026-04-24', businessId: 'el-ganxo', guestCount: 2, notes: '', reservationId: 'r7' }],
    internalComments: [],
  },
  {
    id: 'c8', fullName: 'Family Keller', phone: '+34 645 555 666',
    allergies: [], importantNotes: 'Parlen alemany. Tenir carta en alemany o anglès disponible.',
    preferences: '', tags: [],
    visitHistory: [{ date: '2026-04-24', businessId: 'el-ganxo', guestCount: 4, notes: 'Parlen alemany', reservationId: 'r8' }],
    internalComments: [],
  },
  {
    id: 'c9', fullName: 'Joan Cabré', phone: '+34 666 777 888',
    allergies: [], importantNotes: 'Celebració empresa. Coordinar amb RRHH per servei especial.',
    preferences: 'Sala gran o privada si disponible', tags: ['vip'],
    visitHistory: [{ date: '2026-04-24', businessId: 'el-ganxo', guestCount: 6, notes: 'Celebració empresa', reservationId: 'r9' }],
    internalComments: [],
  },
  {
    id: 'c10', fullName: 'Carla Benet', phone: '+34 677 888 999',
    allergies: [], importantNotes: 'Aniversari avui. Porten pastís propi - avisar cambrer de sala.',
    preferences: '', tags: ['aniversari'],
    visitHistory: [],
    internalComments: [],
  },
];

export const RESERVATIONS: Reservation[] = [
  // MIGDIA
  { id: 'r1', businessId: 'el-ganxo', date: '2026-04-24', time: '13:00', serviceBlock: 'migdia', guestCount: 4, customerId: 'c1', customerName: 'Marta Puig', phone: '+34 612 345 678', notes: 'Taula 12-finestra', status: 'a-taula', source: 'telefon', tags: ['habitual', 'vip'], tableInfo: 'Taula 12 · finestra' },
  { id: 'r2', businessId: 'el-ganxo', date: '2026-04-24', time: '13:00', serviceBlock: 'migdia', guestCount: 2, customerId: 'c2', customerName: 'Jordi Roca', notes: '', status: 'confirmada', source: 'web', tags: [] },
  { id: 'r3', businessId: 'el-ganxo', date: '2026-04-24', time: '13:15', serviceBlock: 'migdia', guestCount: 6, customerId: 'c3', customerName: 'Família Serra', notes: 'Una cadira infantil', status: 'confirmada', source: 'telefon', tags: [] },
  { id: 'r4', businessId: 'el-ganxo', date: '2026-04-24', time: '13:30', serviceBlock: 'migdia', guestCount: 2, customerId: 'c4', customerName: 'Anna Vilanova', notes: '', status: 'pendent', source: 'whatsapp', tags: [] },
  { id: 'r5', businessId: 'el-ganxo', date: '2026-04-24', time: '13:30', serviceBlock: 'migdia', guestCount: 4, customerId: 'c5', customerName: 'Marc Esteve', notes: "Al·lèrgia mariscs — un comensal", status: 'a-taula', source: 'telefon', tags: ['al·lergia'] },
  { id: 'r-m6', businessId: 'el-ganxo', date: '2026-04-24', time: '14:00', serviceBlock: 'migdia', guestCount: 8, customerName: 'Grup Vilafranca', notes: '', status: 'confirmada', source: 'web', tags: [] },
  { id: 'r-m7', businessId: 'el-ganxo', date: '2026-04-24', time: '14:00', serviceBlock: 'migdia', guestCount: 3, customerName: 'Sofia Mas', notes: '', status: 'confirmada', tags: [] },
  { id: 'r-m8', businessId: 'el-ganxo', date: '2026-04-24', time: '14:15', serviceBlock: 'migdia', guestCount: 5, customerName: 'Pau Ferrer', notes: '', status: 'pendent', tags: [] },
  { id: 'r-m9', businessId: 'el-ganxo', date: '2026-04-24', time: '14:30', serviceBlock: 'migdia', guestCount: 4, customerName: 'Laia Torrent', notes: '', status: 'confirmada', tags: [] },
  { id: 'r-m10', businessId: 'el-ganxo', date: '2026-04-24', time: '14:00', serviceBlock: 'migdia', guestCount: 2, customerName: 'Carla Benet', customerId: 'c10', notes: 'Aniversari · pastís propi', status: 'a-taula', tags: ['aniversari'] },
  { id: 'r-m11', businessId: 'el-ganxo', date: '2026-04-24', time: '15:00', serviceBlock: 'migdia', guestCount: 3, customerName: 'Xavier Llop', notes: '', status: 'confirmada', tags: [] },
  { id: 'r-m12', businessId: 'el-ganxo', date: '2026-04-24', time: '15:30', serviceBlock: 'migdia', guestCount: 2, customerName: 'Mireia Camps', notes: '', status: 'pendent', tags: [] },
  { id: 'r-m13', businessId: 'el-ganxo', date: '2026-04-24', time: '16:00', serviceBlock: 'migdia', guestCount: 1, customerName: 'Albert Riba', notes: '', status: 'confirmada', tags: [] },
  // NIT
  { id: 'r6', businessId: 'el-ganxo', date: '2026-04-24', time: '20:30', serviceBlock: 'nit', guestCount: 4, customerId: 'c6', customerName: 'Oriol Puig', notes: 'VIP — soci · taula 4', status: 'confirmada', source: 'telefon', tags: ['vip'] },
  { id: 'r7', businessId: 'el-ganxo', date: '2026-04-24', time: '20:30', serviceBlock: 'nit', guestCount: 2, customerId: 'c7', customerName: 'Helena Martí', notes: '', status: 'pendent', source: 'instagram', tags: [] },
  { id: 'r8', businessId: 'el-ganxo', date: '2026-04-24', time: '20:45', serviceBlock: 'nit', guestCount: 4, customerId: 'c8', customerName: 'Family Keller', notes: 'Parlen alemany', status: 'confirmada', source: 'thefork', tags: [] },
  { id: 'r9', businessId: 'el-ganxo', date: '2026-04-24', time: '21:00', serviceBlock: 'nit', guestCount: 6, customerId: 'c9', customerName: 'Joan Cabré', notes: 'Celebració empresa', status: 'confirmada', source: 'telefon', tags: [] },
  { id: 'r-n5', businessId: 'el-ganxo', date: '2026-04-24', time: '21:00', serviceBlock: 'nit', guestCount: 3, customerName: 'Neus Pons', notes: '', status: 'confirmada', tags: [] },
  { id: 'r-n6', businessId: 'el-ganxo', date: '2026-04-24', time: '21:15', serviceBlock: 'nit', guestCount: 2, customerName: 'David Costa', notes: '', status: 'pendent', tags: [] },
  { id: 'r-n7', businessId: 'el-ganxo', date: '2026-04-24', time: '21:30', serviceBlock: 'nit', guestCount: 5, customerName: 'Grup Barceloneta', notes: '', status: 'confirmada', tags: [] },
  { id: 'r-n8', businessId: 'el-ganxo', date: '2026-04-24', time: '22:00', serviceBlock: 'nit', guestCount: 4, customerName: 'Rosa Pla', notes: '', status: 'confirmada', tags: [] },
  { id: 'r-n9', businessId: 'el-ganxo', date: '2026-04-24', time: '22:00', serviceBlock: 'nit', guestCount: 3, customerName: 'Tomàs Vidal', notes: '', status: 'pendent', tags: [] },
  { id: 'r-n10', businessId: 'el-ganxo', date: '2026-04-24', time: '22:30', serviceBlock: 'nit', guestCount: 2, customerName: 'Irene Soler', notes: '', status: 'confirmada', tags: [] },
  { id: 'r-n11', businessId: 'el-ganxo', date: '2026-04-24', time: '22:45', serviceBlock: 'nit', guestCount: 2, customerName: 'Blai Fuster', notes: '', status: 'confirmada', tags: [] },
];

export const SERVICE_BLOCKS = [
  { id: 'migdia', name: 'Servei de migdia', timeRange: '12:00 – 16:30', startTime: '12:00', endTime: '16:30' },
  { id: 'nit', name: 'Servei de nit', timeRange: '19:00 – 23:30', startTime: '19:00', endTime: '23:30' },
];

export const ALERTS: Alert[] = [
  { id: 'a1', businessId: 'el-ganxo', date: '2026-04-24', type: 'peak', title: 'Pic de 14:00 a 15:00', description: '8 reserves · 32 comensals. Confirmar torn de cuina.', priority: 1 },
  { id: 'a2', businessId: 'el-ganxo', date: '2026-04-24', type: 'pending', title: '2 reserves pendents de confirmar', description: 'Anna Vilanova · 13:30 · 2 pax — trucar abans de les 12:30', priority: 2 },
  { id: 'a3', businessId: 'el-ganxo', date: '2026-04-24', type: 'special', title: 'Aniversari · Carla Benet · 14:00', description: 'Porten pastís propi. Avisar cambrer de sala.', priority: 3 },
];

export const SHIFT_NOTES: ShiftNote[] = [
  { id: 'n1', businessId: 'el-ganxo', date: '2026-04-24', authorName: 'Pep', authorRole: 'Cuiner', text: 'Avui no hi ha rap. Canviar la recomanació per llenguado a la planxa.', minutesAgo: 34 },
  { id: 'n2', businessId: 'el-ganxo', date: '2026-04-24', authorName: 'Èlia', authorRole: 'Sala', text: 'Taula 7 té la pota coixa — evitar grups grans fins que vingui el fuster.', minutesAgo: 120 },
];

export const EVENTS: CalendarEvent[] = [
  { id: 'e1', businessId: 'el-ganxo', date: '2026-04-30', title: 'Sopar de fi de curs — Institut Vilamar', description: '28 pax · menú tancat · sala privada', dayLabel: 'DJ. 30 ABR' },
  { id: 'e2', businessId: 'el-ganxo', date: '2026-05-01', title: 'Festiu · horari reduït', description: 'Només migdia · cuina fins les 15:30', dayLabel: 'DV. 1 MAIG' },
];
