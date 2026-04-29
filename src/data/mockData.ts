import type { Business, Reservation, Customer, FloorPlan, BusinessStats, BusinessId, ShiftNote, AppEvent, BusinessConfig, BusinessHours, BizShift, Employee, EmployeeRole, NotifConfig, WeekScheduleData } from '@/types';

export const BUSINESSES: Business[] = [
  { id: 'ganxo',   name: 'El Ganxo',   kind: 'Pub',                        hue: '#a84a2a', hueSoft: '#f7e2d2', monogram: 'EG', address: 'Passeig Marítim 14',       capacity: 64 },
  { id: 'pista',   name: 'La Pista',   kind: 'Bar restaurant · Pàdel',     hue: '#5a6b35', hueSoft: '#e4ead1', monogram: 'LP', address: 'Carrer del Poliesportiu 3', capacity: 48 },
  { id: 'esquitx', name: "L'Esquitx", kind: 'Bar restaurant',              hue: '#2a6d8a', hueSoft: '#d4e7ee', monogram: 'LE', address: 'Plaça Vella 7',             capacity: 32 },
];

function r(bizId: BusinessId, time: string, name: string, pax: number, status: Reservation['status'], extras: Partial<Reservation> = {}): Reservation {
  return { id: `${bizId}-${time}-${name}`, bizId, date: '2026-04-24', time, name, pax, status, ...extras };
}

export const RESERVATIONS: Reservation[] = [
  // El Ganxo — Migdia
  r('ganxo','13:00','Marta Puig',       4,'seated',    { phone:'+34 678 12 34 56', notes:'Taula 12 · finestra', source:'Telèfon', tags:['regular'] }),
  r('ganxo','13:00','Jordi Roca',       2,'confirmed', { phone:'+34 645 98 76 12', source:'Web' }),
  r('ganxo','13:15','Família Serra',    6,'confirmed', { phone:'+34 619 23 87 44', notes:'Una cadira infantil', source:'Telèfon', tags:['regular'] }),
  r('ganxo','13:30','Anna Vilanova',    2,'pending',   { phone:'+34 677 11 22 33', source:'WhatsApp' }),
  r('ganxo','13:30','Marc Esteve',      4,'seated',    { phone:'+34 601 45 78 21', notes:"Al·lèrgia marisc — un comensal", source:'Web', tags:['allergy'] }),
  r('ganxo','13:45','Laura Fontaine',   3,'confirmed', { phone:'+33 6 12 34 56 78', notes:'Turistes · anglès', source:'Booking' }),
  r('ganxo','14:00','Pau Miró',         2,'confirmed', { phone:'+34 622 13 09 84', source:'Telèfon' }),
  r('ganxo','14:00','Carla Benet',      5,'pending',   { phone:'+34 673 44 21 09', notes:'Aniversari — porten pastís', source:'Instagram', tags:['birthday'] }),
  r('ganxo','14:15','Xavier Pla',       2,'confirmed', { phone:'+34 699 77 12 44', source:'Web' }),
  r('ganxo','14:30','Núria Camps',      4,'confirmed', { phone:'+34 610 32 18 77', notes:'Terrassa si pot ser', source:'Telèfon', tags:['terrassa'] }),
  r('ganxo','14:30','Emmanuel Duval',   2,'confirmed', { phone:'+33 6 88 77 11 22', source:'TheFork' }),
  r('ganxo','14:45','Família Bonet',    7,'confirmed', { phone:'+34 655 09 88 73', notes:'Cinc adults + dos nens', source:'Telèfon' }),
  r('ganxo','15:00','Montse Aldaví',    2,'pending',   { phone:'+34 688 21 34 55', source:'WhatsApp' }),
  // El Ganxo — Nit
  r('ganxo','20:30','Oriol Puig',       4,'confirmed', { phone:'+34 677 09 87 21', source:'Web', tags:['vip'], notes:'VIP — soci · taula 4' }),
  r('ganxo','20:30','Helena Martí',     2,'pending',   { phone:'+34 622 14 09 88', source:'WhatsApp' }),
  r('ganxo','20:45','Family Keller',    4,'confirmed', { phone:'+49 172 2334566', notes:'Parlen alemany', source:'Booking' }),
  r('ganxo','21:00','Joan Cabré',       6,'confirmed', { phone:'+34 610 88 21 34', notes:"Celebració d'empresa", source:'Telèfon', tags:['birthday'] }),
  r('ganxo','21:00','Sílvia Torrent',   2,'confirmed', { phone:'+34 645 12 98 77', source:'Web' }),
  r('ganxo','21:15','Raül Domènech',    3,'pending',   { phone:'+34 677 22 13 84', source:'Telèfon' }),
  r('ganxo','21:30','Família Coll',     5,'confirmed', { phone:'+34 622 87 44 12', source:'Telèfon', tags:['regular'] }),
  r('ganxo','21:45','Berta Nogués',     2,'confirmed', { phone:'+34 688 32 11 09', notes:'Aniversari sorpresa — no cantar', source:'WhatsApp', tags:['birthday'] }),
  r('ganxo','22:00','Pere Fontana',     4,'confirmed', { phone:'+34 699 14 55 21', source:'TheFork' }),
  r('ganxo','22:00','Giulia Ferrari',   2,'pending',   { phone:'+39 340 1234567', notes:'Italians', source:'Instagram' }),
  r('ganxo','22:15','Quim Badia',       3,'confirmed', { phone:'+34 610 44 78 21', source:'Telèfon' }),
  // La Pista — Migdia
  r('pista','12:00','Ferran Adrià',     4,'seated',    { phone:'+34 699 11 22 33', notes:'Pista 2 + taula després', source:'App', tags:['regular'] }),
  r('pista','12:30','Laia Romeu',       2,'confirmed', { phone:'+34 677 88 44 21', source:'App' }),
  r('pista','13:00','Roger Vinyes',     6,'confirmed', { phone:'+34 622 09 87 44', notes:'Grup empreses — reservat menjador', source:'Telèfon' }),
  r('pista','13:30','Clara Bosch',      4,'pending',   { phone:'+34 688 23 44 21', source:'WhatsApp' }),
  r('pista','14:00','Toni Gálvez',      2,'confirmed', { phone:'+34 645 78 21 09', source:'App', tags:['regular'] }),
  r('pista','14:30','Família Riera',    5,'confirmed', { phone:'+34 610 55 88 21', notes:'Aniversari nen 8 anys', source:'Telèfon', tags:['birthday'] }),
  r('pista','15:00','Josep Maria Pons', 2,'confirmed', { phone:'+34 699 32 11 88', source:'App' }),
  // La Pista — Nit
  r('pista','19:30','Marina Llop',      4,'confirmed', { phone:'+34 622 44 78 21', notes:'Després del partit pista 1', source:'App' }),
  r('pista','20:00','Club Can Vidal',  12,'confirmed', { phone:'+34 655 21 09 88', notes:'Sopar social — 12 pax, menú fix', source:'Telèfon', tags:['regular'] }),
  r('pista','20:30','Enric Molins',     2,'pending',   { phone:'+34 677 14 22 09', source:'WhatsApp' }),
  r('pista','21:00','Família Mas',      4,'confirmed', { phone:'+34 610 88 44 21', source:'App' }),
  r('pista','21:30','Ivet Salvador',    3,'confirmed', { phone:'+34 688 09 32 11', notes:'Sense gluten', source:'Telèfon', tags:['allergy'] }),
  // L'Esquitx — Nit
  r('esquitx','19:00','Aina Palau',     2,'confirmed', { phone:'+34 677 44 21 88', source:'Instagram', tags:['regular'] }),
  r('esquitx','19:30','Biel Morera',    4,'seated',    { phone:'+34 622 88 11 44', notes:'Taula del racó', source:'WhatsApp' }),
  r('esquitx','19:30','Carlota Estruch',3,'confirmed', { phone:'+34 688 09 77 21', source:'Web' }),
  r('esquitx','20:00','David Reguant',  5,'pending',   { phone:'+34 610 21 88 44', source:'Telèfon' }),
  r('esquitx','20:00','Gemma Solà',     2,'confirmed', { phone:'+34 699 32 44 21', notes:'Primera cita — llum suau', source:'Instagram' }),
  r('esquitx','20:30','Hèctor Vidal',   4,'confirmed', { phone:'+34 645 09 88 32', source:'WhatsApp', tags:['vip'] }),
  r('esquitx','20:30','Irene Company',  2,'confirmed', { phone:'+34 677 77 44 88', source:'Instagram' }),
  r('esquitx','21:00','Jaume Ribas',    6,'confirmed', { phone:'+34 622 44 21 09', notes:'Acomiadament soltera', source:'Telèfon', tags:['birthday'] }),
  r('esquitx','21:00','Kevin Whitfield',2,'pending',   { phone:'+44 7700 900123', notes:'English speakers', source:'Instagram' }),
  r('esquitx','21:30','Lluïsa Boada',   3,'confirmed', { phone:'+34 688 77 11 44', source:'Web' }),
  r('esquitx','22:00','Manel Canyelles',2,'confirmed', { phone:'+34 610 44 88 21', source:'WhatsApp', tags:['regular'] }),
  r('esquitx','22:30','Noa Carreras',   4,'pending',   { phone:'+34 699 21 44 88', source:'Instagram' }),
];

export const CUSTOMERS: Customer[] = [
  { id:'c1',  name:'Marta Puig',     phone:'+34 678 12 34 56', email:'marta.puig@gmail.com', visits:14, lastVisit:'2026-04-10', spend:642,  tags:['regular'],           biz:['ganxo','esquitx'], notes:'Prefereix taula a la finestra. Al·lèrgia al marisc cuit.' },
  { id:'c2',  name:'Jordi Roca',     phone:'+34 645 98 76 12', email:'jroca@ca.cat',          visits:3,  lastVisit:'2026-03-28', spend:124,  tags:[],                    biz:['ganxo'], notes:'' },
  { id:'c3',  name:'Oriol Puig',     phone:'+34 677 09 87 21', email:'oriol.p@gmail.com',     visits:42, lastVisit:'2026-04-17', spend:2310, tags:['vip','regular'],     biz:['ganxo','pista'], notes:'Soci des del 2019. Taula 4 sempre que sigui possible. Bon vi negre.' },
  { id:'c4',  name:'Núria Camps',    phone:'+34 610 32 18 77', email:'nucamps@hey.com',        visits:8,  lastVisit:'2026-04-03', spend:380,  tags:['terrassa'],          biz:['ganxo'], notes:'Demana sempre terrassa.' },
  { id:'c5',  name:'Família Serra',  phone:'+34 619 23 87 44', email:'serra.family@yahoo.es',  visits:21, lastVisit:'2026-04-18', spend:1120, tags:['regular'],           biz:['ganxo','esquitx'], notes:'Venen amb una cadira infantil. Nen de 6 anys.' },
  { id:'c6',  name:'Marc Esteve',    phone:'+34 601 45 78 21', email:'m.esteve@icloud.com',    visits:5,  lastVisit:'2026-04-19', spend:234,  tags:['allergy'],           biz:['ganxo'], notes:'Al·lèrgia al marisc — marcar a comanda.' },
  { id:'c7',  name:'Ferran Adrià',   phone:'+34 699 11 22 33', email:'f.adria@email.cat',      visits:31, lastVisit:'2026-04-20', spend:890,  tags:['regular'],           biz:['pista','esquitx'], notes:'Juga dilluns i dijous. Mateix homònim, no el Ferran.' },
  { id:'c8',  name:'Carla Benet',    phone:'+34 673 44 21 09', email:'carlabenet@gmail.com',   visits:6,  lastVisit:'2026-04-24', spend:312,  tags:['birthday'],          biz:['ganxo'], notes:'Celebra aniversari avui — porten pastís propi.' },
  { id:'c9',  name:'Laia Romeu',     phone:'+34 677 88 44 21', email:'lromeu@outlook.com',     visits:18, lastVisit:'2026-04-15', spend:560,  tags:['regular'],           biz:['pista'], notes:'' },
  { id:'c10', name:'Helena Martí',   phone:'+34 622 14 09 88', email:'',                       visits:1,  lastVisit:'2026-04-24', spend:0,    tags:[],                    biz:['ganxo'], notes:'Nova · WhatsApp.' },
  { id:'c11', name:'Joan Cabré',     phone:'+34 610 88 21 34', email:'joan.c@empresacc.cat',   visits:12, lastVisit:'2026-04-24', spend:1450, tags:['birthday','regular'],biz:['ganxo'], notes:"Sopars d'empresa trimestrals." },
  { id:'c12', name:'Hèctor Vidal',   phone:'+34 645 09 88 32', email:'h.vidal@pm.me',          visits:9,  lastVisit:'2026-04-16', spend:520,  tags:['vip'],               biz:['esquitx'], notes:'Còctel favorit: Negroni.' },
  { id:'c13', name:'Biel Morera',    phone:'+34 622 88 11 44', email:'',                       visits:4,  lastVisit:'2026-04-24', spend:180,  tags:[],                    biz:['esquitx'], notes:'' },
  { id:'c14', name:'Berta Nogués',   phone:'+34 688 32 11 09', email:'berta@g.cat',            visits:7,  lastVisit:'2026-04-24', spend:410,  tags:['birthday'],          biz:['ganxo'], notes:'No cantar Happy Birthday — sorpresa.' },
  { id:'c15', name:'Anna Vilanova',  phone:'+34 677 11 22 33', email:'',                       visits:1,  lastVisit:'2026-04-24', spend:0,    tags:[],                    biz:['ganxo'], notes:'Pendent de confirmar.' },
];

export const FLOOR_PLANS: Record<string, FloorPlan> = {
  ganxo: {
    gridW: 14, gridH: 9,
    zones: [
      { id:'sala',     label:'Sala principal', order:0, x:0,  y:0, w:9,  h:6 },
      { id:'terrassa', label:'Terrassa',        order:1, x:9,  y:0, w:5,  h:6 },
      { id:'barra',    label:'Barra',           order:2, x:0,  y:6, w:14, h:2 },
    ],
    tables: [
      { id:'T1',  x:0.3,  y:0.4, shape:'round',  cap:2, zone:'sala',     status:'seated',    res:'Marta Puig',     time:'13:00' },
      { id:'T2',  x:2.0,  y:0.4, shape:'round',  cap:2, zone:'sala',     status:'confirmed', res:'Jordi Roca',     time:'13:00' },
      { id:'T3',  x:3.7,  y:0.4, shape:'square', cap:4, zone:'sala',     status:'seated',    res:'Marc Esteve',    time:'13:30' },
      { id:'T4',  x:5.9,  y:0.4, shape:'square', cap:4, zone:'sala',     status:'reserved',  res:'Oriol Puig',     time:'20:30', reservedLater:true },
      { id:'T5',  x:0.3,  y:2.2, shape:'rect',   cap:6, zone:'sala',     status:'confirmed', res:'Família Serra',  time:'13:15', w:1.6 },
      { id:'T6',  x:3.7,  y:2.2, shape:'square', cap:4, zone:'sala',     status:'free' },
      { id:'T7',  x:5.9,  y:2.2, shape:'square', cap:4, zone:'sala',     status:'blocked',   note:'Pota coixa' },
      { id:'T8',  x:0.3,  y:4.0, shape:'rect',   cap:8, zone:'sala',     status:'free',      w:2.2 },
      { id:'T9',  x:3.7,  y:4.0, shape:'round',  cap:2, zone:'sala',     status:'pending',   res:'Anna Vilanova',  time:'13:30' },
      { id:'T10', x:5.4,  y:4.0, shape:'round',  cap:2, zone:'sala',     status:'free' },
      { id:'T11', x:7.1,  y:4.0, shape:'round',  cap:3, zone:'sala',     status:'confirmed', res:'Laura Fontaine', time:'13:45' },
      { id:'TE1', x:0.4,  y:0.4, shape:'round',  cap:4, zone:'terrassa', status:'confirmed', res:'Núria Camps',    time:'14:30' },
      { id:'TE2', x:2.2,  y:0.4, shape:'round',  cap:2, zone:'terrassa', status:'free' },
      { id:'TE3', x:3.8,  y:0.4, shape:'round',  cap:2, zone:'terrassa', status:'free' },
      { id:'TE4', x:0.4,  y:2.2, shape:'square', cap:4, zone:'terrassa', status:'free' },
      { id:'TE5', x:2.4,  y:2.2, shape:'square', cap:4, zone:'terrassa', status:'confirmed', res:'Emmanuel Duval', time:'14:30' },
      { id:'TE6', x:0.4,  y:4.0, shape:'rect',   cap:6, zone:'terrassa', status:'free',      w:1.6 },
      { id:'TE7', x:3.6,  y:4.0, shape:'square', cap:4, zone:'terrassa', status:'confirmed', res:'Pau Miró',       time:'14:00' },
      { id:'B1',  x:0.3,  y:0.4, shape:'stool',  cap:1, zone:'barra',    status:'free' },
      { id:'B2',  x:1.3,  y:0.4, shape:'stool',  cap:1, zone:'barra',    status:'seated',    res:'Walk-in', time:'ara' },
      { id:'B3',  x:2.3,  y:0.4, shape:'stool',  cap:1, zone:'barra',    status:'seated',    res:'Walk-in', time:'ara' },
      { id:'B4',  x:3.3,  y:0.4, shape:'stool',  cap:1, zone:'barra',    status:'free' },
      { id:'B5',  x:4.3,  y:0.4, shape:'stool',  cap:1, zone:'barra',    status:'free' },
      { id:'B6',  x:5.3,  y:0.4, shape:'stool',  cap:1, zone:'barra',    status:'free' },
    ],
  },
  pista: {
    gridW: 16, gridH: 10,
    zones: [
      { id:'menjador',        label:'Menjador',        order:0 },
      { id:'bar',             label:'Bar',             order:1 },
      { id:'barra',           label:'Barra',           order:2 },
      { id:'terrassa-ciment', label:'Terrassa ciment', order:3 },
      { id:'terrassa-terra',  label:'Terrassa terra',  order:4 },
    ],
    tables: [
      // ── Menjador: 14 taules (10–16 + 10-bis–16-bis) ──
      { id:'10',      name:'10',      x:0.3,   y:0.3, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'11',      name:'11',      x:2.05,  y:0.3, shape:'square', cap:4, zone:'menjador', status:'confirmed', res:'Roger Vinyes',  time:'13:00' },
      { id:'12',      name:'12',      x:3.8,   y:0.3, shape:'square', cap:4, zone:'menjador', status:'seated',    res:'Ferran Adrià',  time:'12:00' },
      { id:'13',      name:'13',      x:5.55,  y:0.3, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'14',      name:'14',      x:7.3,   y:0.3, shape:'square', cap:4, zone:'menjador', status:'pending',   res:'Clara Bosch',   time:'13:30' },
      { id:'15',      name:'15',      x:9.05,  y:0.3, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'16',      name:'16',      x:10.8,  y:0.3, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'10-bis',  name:'10-bis',  x:0.3,   y:2.1, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'11-bis',  name:'11-bis',  x:2.05,  y:2.1, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'12-bis',  name:'12-bis',  x:3.8,   y:2.1, shape:'square', cap:4, zone:'menjador', status:'confirmed', res:'Toni Gálvez',   time:'14:00' },
      { id:'13-bis',  name:'13-bis',  x:5.55,  y:2.1, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'14-bis',  name:'14-bis',  x:7.3,   y:2.1, shape:'square', cap:4, zone:'menjador', status:'reserved',  res:'Club Can Vidal',time:'20:00', reservedLater:true },
      { id:'15-bis',  name:'15-bis',  x:9.05,  y:2.1, shape:'square', cap:4, zone:'menjador', status:'free' },
      { id:'16-bis',  name:'16-bis',  x:10.8,  y:2.1, shape:'square', cap:4, zone:'menjador', status:'free' },
      // ── Bar: 8 taules (1–8) ──
      { id:'1', name:'1', x:0.3,  y:0.3, shape:'square', cap:4, zone:'bar', status:'seated',    res:'Família Serra', time:'13:15' },
      { id:'2', name:'2', x:2.05, y:0.3, shape:'square', cap:4, zone:'bar', status:'confirmed', res:'Marc Esteve',   time:'13:30' },
      { id:'3', name:'3', x:3.8,  y:0.3, shape:'square', cap:4, zone:'bar', status:'free' },
      { id:'4', name:'4', x:5.55, y:0.3, shape:'square', cap:4, zone:'bar', status:'free' },
      { id:'5', name:'5', x:0.3,  y:2.1, shape:'square', cap:4, zone:'bar', status:'free' },
      { id:'6', name:'6', x:2.05, y:2.1, shape:'square', cap:4, zone:'bar', status:'confirmed', res:'Marina Llop',   time:'19:30' },
      { id:'7', name:'7', x:3.8,  y:2.1, shape:'square', cap:4, zone:'bar', status:'free' },
      { id:'8', name:'8', x:5.55, y:2.1, shape:'square', cap:4, zone:'bar', status:'free' },
      // ── Barra: 10 tamborets (20–29) ──
      { id:'20', name:'20', x:0.3, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'seated', res:'Walk-in', time:'ara' },
      { id:'21', name:'21', x:1.2, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'seated', res:'Walk-in', time:'ara' },
      { id:'22', name:'22', x:2.1, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'23', name:'23', x:3.0, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'24', name:'24', x:3.9, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'25', name:'25', x:4.8, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'seated', res:'Walk-in', time:'ara' },
      { id:'26', name:'26', x:5.7, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'27', name:'27', x:6.6, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'28', name:'28', x:7.5, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'29', name:'29', x:8.4, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      // ── Terrassa ciment: 12 taules (101–106 + 101-bis–106-bis) ──
      { id:'101',     name:'101',     x:0.3,  y:0.3, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      { id:'102',     name:'102',     x:2.05, y:0.3, shape:'round', cap:4, zone:'terrassa-ciment', status:'confirmed', res:'Núria Camps',     time:'14:30' },
      { id:'103',     name:'103',     x:3.8,  y:0.3, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      { id:'104',     name:'104',     x:5.55, y:0.3, shape:'round', cap:4, zone:'terrassa-ciment', status:'seated',    res:'Oriol Puig',      time:'13:00' },
      { id:'105',     name:'105',     x:7.3,  y:0.3, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      { id:'106',     name:'106',     x:9.05, y:0.3, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      { id:'101-bis', name:'101-bis', x:0.3,  y:2.1, shape:'round', cap:4, zone:'terrassa-ciment', status:'confirmed', res:'Emmanuel Duval',  time:'14:30' },
      { id:'102-bis', name:'102-bis', x:2.05, y:2.1, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      { id:'103-bis', name:'103-bis', x:3.8,  y:2.1, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      { id:'104-bis', name:'104-bis', x:5.55, y:2.1, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      { id:'105-bis', name:'105-bis', x:7.3,  y:2.1, shape:'round', cap:4, zone:'terrassa-ciment', status:'pending',   res:'Anna Vilanova',   time:'14:00' },
      { id:'106-bis', name:'106-bis', x:9.05, y:2.1, shape:'round', cap:4, zone:'terrassa-ciment', status:'free' },
      // ── Terrassa terra: 39 taules (111–149) ──
      { id:'111', name:'111', x:0.3,   y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'112', name:'112', x:2.05,  y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'113', name:'113', x:3.8,   y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'seated',    res:'Walk-in', time:'ara' },
      { id:'114', name:'114', x:5.55,  y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'115', name:'115', x:7.3,   y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'confirmed', res:'Pau Miró',       time:'14:00' },
      { id:'116', name:'116', x:9.05,  y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'117', name:'117', x:10.8,  y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'118', name:'118', x:12.55, y:0.3, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'119', name:'119', x:0.3,   y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'120', name:'120', x:2.05,  y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'121', name:'121', x:3.8,   y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'122', name:'122', x:5.55,  y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'123', name:'123', x:7.3,   y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'124', name:'124', x:9.05,  y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'125', name:'125', x:10.8,  y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'126', name:'126', x:12.55, y:2.1, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'127', name:'127', x:0.3,   y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'128', name:'128', x:2.05,  y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'129', name:'129', x:3.8,   y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'130', name:'130', x:5.55,  y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'131', name:'131', x:7.3,   y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'132', name:'132', x:9.05,  y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'133', name:'133', x:10.8,  y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'134', name:'134', x:12.55, y:3.9, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'135', name:'135', x:0.3,   y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'136', name:'136', x:2.05,  y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'137', name:'137', x:3.8,   y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'138', name:'138', x:5.55,  y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'139', name:'139', x:7.3,   y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'140', name:'140', x:9.05,  y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'141', name:'141', x:10.8,  y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'142', name:'142', x:12.55, y:5.7, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'143', name:'143', x:0.3,   y:7.5, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'144', name:'144', x:2.05,  y:7.5, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'145', name:'145', x:3.8,   y:7.5, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'146', name:'146', x:5.55,  y:7.5, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'147', name:'147', x:7.3,   y:7.5, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'148', name:'148', x:9.05,  y:7.5, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
      { id:'149', name:'149', x:10.8,  y:7.5, shape:'round', cap:2, zone:'terrassa-terra', status:'free' },
    ],
  },
  esquitx: {
    gridW: 12, gridH: 10,
    zones: [
      { id:'barra',            label:'Barra',           order:0 },
      { id:'bar',              label:'Bar',             order:1 },
      { id:'menjador',         label:'Menjador',        order:2 },
      { id:'terrassa-davant',  label:'Terrassa davant', order:3 },
      { id:'terrassa-darrer',  label:'Terrassa darrer', order:4 },
    ],
    tables: [
      // ── Barra: 8 tamborets ──
      { id:'BR1', name:'BR1', x:0.3, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'BR2', name:'BR2', x:1.2, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'seated', res:'Walk-in', time:'ara' },
      { id:'BR3', name:'BR3', x:2.1, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'seated', res:'Walk-in', time:'ara' },
      { id:'BR4', name:'BR4', x:3.0, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'BR5', name:'BR5', x:3.9, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'seated', res:'Walk-in', time:'ara' },
      { id:'BR6', name:'BR6', x:4.8, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'BR7', name:'BR7', x:5.7, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      { id:'BR8', name:'BR8', x:6.6, y:0.3, w:0.7, h:0.7, shape:'stool', cap:1, zone:'barra', status:'free' },
      // ── Bar: 6 taules (foto 1) ──
      // Fila superior: 22 (rodona ♟4), 21-bis, 21
      { id:'22',     name:'22',     x:0.3,  y:0.3, shape:'round',  cap:4, zone:'bar', status:'free' },
      { id:'21-bis', name:'21 BIS', x:3.5,  y:0.3, shape:'square', cap:2, zone:'bar', status:'free' },
      { id:'21',     name:'21',     x:5.3,  y:0.3, shape:'square', cap:2, zone:'bar', status:'free' },
      // Fila inferior: 20-z, 20-bis, 20
      { id:'20-z',   name:'20 Z',   x:1.75, y:2.1, shape:'square', cap:2, zone:'bar', status:'free' },
      { id:'20-bis', name:'20 BIS', x:3.5,  y:2.1, shape:'square', cap:2, zone:'bar', status:'free' },
      { id:'20',     name:'20',     x:5.3,  y:2.1, shape:'square', cap:2, zone:'bar', status:'free' },
      // ── Menjador: 20 taules (foto 2) ──
      // Posicions: c1=0.3, c2=2.05, c3=3.8, c4=5.55, c5=7.3, c6=9.05
      // Fila 1: 5, 4
      { id:'5',      name:'5',      x:2.05, y:0.3, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'4',      name:'4',      x:5.55, y:0.3, shape:'square', cap:2, zone:'menjador', status:'free' },
      // Fila 2: 6, 6-bis, 9-bis, 11-bis, 3
      { id:'6',      name:'6',      x:0.3,  y:2.1, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'6-bis',  name:'6 BIS',  x:2.05, y:2.1, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'9-bis',  name:'9 BIS',  x:3.8,  y:2.1, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'11-bis', name:'11BIS',  x:5.55, y:2.1, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'3',      name:'3',      x:9.05, y:2.1, shape:'square', cap:2, zone:'menjador', status:'free' },
      // Fila 3: 7, 7-bis, 9, 11, 2-bis, 2
      { id:'7',      name:'7',      x:0.3,  y:3.9, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'7-bis',  name:'7 BIS',  x:2.05, y:3.9, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'9',      name:'9',      x:3.8,  y:3.9, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'11',     name:'11',     x:5.55, y:3.9, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'2-bis',  name:'2 BIS',  x:7.3,  y:3.9, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'2',      name:'2',      x:9.05, y:3.9, shape:'square', cap:2, zone:'menjador', status:'free' },
      // Fila 4: 8-bis, 10-bis
      { id:'8-bis',  name:'8 BIS',  x:3.8,  y:5.7, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'10-bis', name:'10 BIS', x:5.55, y:5.7, shape:'square', cap:2, zone:'menjador', status:'free' },
      // Fila 5: 30, 8, 10, 1-bis, 1
      { id:'30',     name:'30',     x:2.05, y:7.5, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'8',      name:'8',      x:3.8,  y:7.5, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'10',     name:'10',     x:5.55, y:7.5, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'1-bis',  name:'1 BIS',  x:7.3,  y:7.5, shape:'square', cap:2, zone:'menjador', status:'free' },
      { id:'1',      name:'1',      x:9.05, y:7.5, shape:'square', cap:2, zone:'menjador', status:'free' },
      // ── Terrassa davant i darrer: buides (pendent de foto) ──
    ],
  },
};

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function getStats(bizId: BusinessId): BusinessStats {
  const list = RESERVATIONS.filter(r => r.bizId === bizId);
  const biz = BUSINESSES.find(b => b.id === bizId)!;
  const totalRes = list.length;
  const totalPax = list.reduce((s, r) => s + r.pax, 0);
  const mins = list.map(r => parseTime(r.time));
  let peak = 0;
  for (const m of mins) {
    const overlap = mins.filter(x => Math.abs(x - m) < 90).length;
    if (overlap > peak) peak = overlap;
  }
  const occupancyPct = Math.min(100, Math.round((totalPax / (biz.capacity * 2)) * 100));
  const level = occupancyPct > 70 ? 'high' : occupancyPct > 40 ? 'medium' : 'low';
  return { totalRes, totalPax, peak, occupancyPct, level };
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase();
}

export function avIdx(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 6;
}

export const STATE_LABELS: Record<string, string> = {
  pending: 'Pendent', confirmed: 'Confirmada', seated: 'A taula',
  completed: 'Acabada', cancelled: "Cancel·lada", noshow: 'No ha vingut',
};

export const ROLES: Record<string, { label: string; hue: string; bg: string }> = {
  encarregat: { label: 'Encarregat',         hue: '#8a4a2a', bg: '#f3e3d6' },
  sala:       { label: 'Cambrer/a sala',     hue: '#5d6e3a', bg: '#e7ecd3' },
  terrassa:   { label: 'Cambrer/a terrassa', hue: '#3a6b8a', bg: '#d4e5ee' },
  barra:      { label: 'Cambrer/a barra',    hue: '#7a4288', bg: '#ecdaf0' },
  bar:        { label: 'Cambrer/a bar',      hue: '#a8662b', bg: '#f4e2cf' },
  cuina:      { label: 'Cuina',              hue: '#7d4a3a', bg: '#efdcd3' },
  capCuina:   { label: 'Cap de cuina',       hue: '#552d20', bg: '#e6d3c8' },
  pizzer:     { label: 'Pizzer',             hue: '#aa3d2e', bg: '#f3d7d1' },
};

export const SHIFTS = [
  { id: 'M', label: 'Migdia', range: '12:00 – 16:00' },
  { id: 'N', label: 'Nit',    range: '20:00 – 00:00' },
];

export interface StaffMember {
  id: string; name: string; role: string; biz: string[];
  clockedIn: boolean; startedAt: string | null;
}

export const STAFF: StaffMember[] = [
  { id:'s1',  name:'Núria Vila',     role:'encarregat', biz:['ganxo'],   clockedIn:true,  startedAt:'11:48' },
  { id:'s2',  name:'Pol Esteve',     role:'sala',       biz:['ganxo'],   clockedIn:true,  startedAt:'11:55' },
  { id:'s3',  name:'Aina Llopart',   role:'sala',       biz:['ganxo'],   clockedIn:true,  startedAt:'12:02' },
  { id:'s4',  name:'Genís Roca',     role:'terrassa',   biz:['ganxo'],   clockedIn:true,  startedAt:'11:50' },
  { id:'s5',  name:'Marta Cusidó',   role:'terrassa',   biz:['ganxo'],   clockedIn:false, startedAt:null    },
  { id:'s6',  name:'Bernat Solé',    role:'barra',      biz:['ganxo'],   clockedIn:true,  startedAt:'11:45' },
  { id:'s7',  name:'Roger Mas',      role:'capCuina',   biz:['ganxo'],   clockedIn:true,  startedAt:'10:30' },
  { id:'s8',  name:'Carla Vives',    role:'cuina',      biz:['ganxo'],   clockedIn:true,  startedAt:'10:45' },
  { id:'s9',  name:'Jordi Esquius',  role:'cuina',      biz:['ganxo'],   clockedIn:true,  startedAt:'10:50' },
  { id:'s10', name:'Mireia Pi',      role:'pizzer',     biz:['ganxo'],   clockedIn:false, startedAt:null    },
  { id:'s11', name:'Quim Tena',      role:'encarregat', biz:['pista'],   clockedIn:true,  startedAt:'11:30' },
  { id:'s12', name:'Laia Codina',    role:'bar',        biz:['pista'],   clockedIn:true,  startedAt:'11:40' },
  { id:'s13', name:'Arnau Pons',     role:'bar',        biz:['pista'],   clockedIn:false, startedAt:null    },
  { id:'s14', name:'Berta Olivella', role:'encarregat', biz:['esquitx'], clockedIn:false, startedAt:null    },
  { id:'s15', name:'Iván Martín',    role:'barra',      biz:['esquitx'], clockedIn:false, startedAt:null    },
  { id:'s16', name:'Sara Bonet',     role:'sala',       biz:['esquitx'], clockedIn:false, startedAt:null    },
];

export const WEEK_SCHEDULE: Record<string, Record<number, { M: string[]; N: string[] }>> = {
  ganxo: {
    0: { M:['s2','s4','s7','s8'],                N:['s1','s3','s6','s9','s10'] },
    1: { M:['s1','s3','s5','s7','s9'],           N:['s2','s6','s8','s10'] },
    2: { M:['s2','s4','s7','s8'],                N:['s1','s5','s6','s9'] },
    3: { M:['s1','s2','s3','s7','s8','s9'],      N:['s4','s5','s6','s10'] },
    4: { M:['s1','s2','s4','s6','s7','s8','s9'], N:['s1','s3','s5','s6','s9','s10'] },
    5: { M:['s1','s2','s3','s4','s5','s7','s8','s9','s10'], N:['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10'] },
    6: { M:['s1','s2','s3','s4','s5','s7','s8','s9'], N:[] },
  },
  pista: {
    0:{M:['s11','s12'],N:['s11','s13']}, 1:{M:['s11','s13'],N:['s12']},
    2:{M:['s12'],N:['s11','s13']},       3:{M:['s11','s13'],N:['s12']},
    4:{M:['s11','s12'],N:['s11','s12','s13']},
    5:{M:['s11','s12','s13'],N:['s11','s12','s13']}, 6:{M:['s12'],N:[]},
  },
  esquitx: {
    0:{M:[],N:['s14','s15']}, 1:{M:[],N:['s14','s16']}, 2:{M:[],N:['s15','s16']},
    3:{M:[],N:['s14','s15','s16']}, 4:{M:[],N:['s14','s15','s16']},
    5:{M:[],N:['s14','s15','s16']}, 6:{M:[],N:['s14']},
  },
};

export const DAY_NAMES       = ['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'];
export const DAY_NAMES_SHORT = ['dl','dt','dc','dj','dv','ds','dg'];
export const TODAY_DOW = 4;

export const WAITLIST = [
  { id:'w1', name:'Família Pérez', pax:4, since:'13:42', wait:18, phone:'+34 661 22 33 44' },
  { id:'w2', name:'Adrià + 1',     pax:2, since:'13:55', wait:5,  phone:'+34 622 11 09 88' },
];

export const APRIL_2026 = (() => {
  const days = [];
  for (let d = 1; d <= 30; d++) {
    const dow = (d + 2) % 7;
    const isWeekend = dow === 4 || dow === 5 || dow === 6;
    let count = 8 + Math.floor(Math.sin(d * 0.7) * 6) + (isWeekend ? 18 : 0);
    if (d === 23) count = 64;
    if (d === 24) count = 42;
    if (d === 25) count = 56;
    days.push({ day: d, dow, count, special: d === 23 ? 'Sant Jordi' : null });
  }
  return days;
})();

// ─── Shift Notes ──────────────────────────────────────────────
// createdAt relatiu al "ara" del demo (24 abr 2026 ~14:30)
const _demoNow = new Date(2026, 3, 24, 14, 30).getTime();

export const SHIFT_NOTES: ShiftNote[] = [
  { id:'sn1', bizId:'ganxo',   date:'2026-04-24', author:'Pep · Cuiner', createdAt: _demoNow - 34*60*1000,  body:'Avui no hi ha rap. Canviar la recomanació per llenguado a la planxa.' },
  { id:'sn2', bizId:'ganxo',   date:'2026-04-24', author:'Èlia · Sala',  createdAt: _demoNow - 2*3600*1000, body:'Taula 7 té la pota coixa — evitar grups grans fins que vingui el fuster.' },
  { id:'sn3', bizId:'pista',   date:'2026-04-24', author:'Quim · Enc.',  createdAt: _demoNow - 20*60*1000,  body:'Pista 3 tancada per manteniment fins les 16h.' },
  { id:'sn4', bizId:'esquitx', date:'2026-04-24', author:'Berta · Sala', createdAt: _demoNow - 45*60*1000,  body:"Manca gel picat. Trucar al proveïdor." },
];

// ─── App Events ───────────────────────────────────────────────
export const APP_EVENTS: AppEvent[] = [
  { id:'ev1', bizId:'ganxo',   date:'2026-04-30', title:"Sopar de fi de curs — Institut Vilamar", description:'28 pax · menú tancat · sala privada', kind:'event' },
  { id:'ev2', bizId:'ganxo',   date:'2026-05-01', title:'Festiu · horari reduït', description:'Només migdia · cuina fins les 15:30', kind:'festiu' },
  { id:'ev3', bizId:'pista',   date:'2026-04-26', title:'Torneig de pàdel intern', description:'Ocupació completa de pistes 9:00–14:00', kind:'event' },
  { id:'ev4', bizId:'esquitx', date:'2026-04-25', title:'Presentació de vins — Celler Marçal', description:'Aforament limitat a 20 persones. Cata guiada.', kind:'event' },
];

// ─── Helpers ──────────────────────────────────────────────────
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'ara mateix';
  if (mins < 60) return `fa ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `fa ${hrs} h`;
  return `fa ${Math.floor(hrs / 24)} d`;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Business configs (mutable per negoci) ────────────────────────────────────
export const BUSINESS_CONFIGS: Record<string, BusinessConfig> = {
  ganxo:   { name:'El Ganxo',   kind:'Pub',                  address:"C/ Major, 14, Granollers",           phone:'+34 93 870 11 22', email:'reserves@elganxo.cat',  capacity:80,  active:true },
  pista:   { name:'La Pista',   kind:'Bar restaurant · Pàdel', address:'C/ Indústria, 3, Granollers',     phone:'+34 93 870 33 44', email:'info@lapista.cat',       capacity:120, active:true },
  esquitx: { name:"L'Esquitx",  kind:'Bar restaurant',      address:'Pl. de la Porxada, 5, Granollers',  phone:'+34 93 870 55 66', email:'hola@esquitx.cat',       capacity:45,  active:true },
};

// ─── Business hours (mutable per negoci) ─────────────────────────────────────
function makeSlots(pairs: [string,string][]): { start:string; end:string }[] {
  return pairs.map(([start,end]) => ({ start, end }));
}
export const BUSINESS_HOURS: Record<string, BusinessHours> = {
  ganxo: {
    avgTableMinutes: 90,
    days: [
      { open:true,  slots: makeSlots([['13:00','16:00'],['20:00','00:00']]) }, // dl
      { open:true,  slots: makeSlots([['13:00','16:00'],['20:00','00:00']]) }, // dt
      { open:true,  slots: makeSlots([['13:00','16:00'],['20:00','00:00']]) }, // dc
      { open:true,  slots: makeSlots([['13:00','16:00'],['20:00','00:00']]) }, // dj
      { open:true,  slots: makeSlots([['13:00','16:00'],['20:00','00:00']]) }, // dv
      { open:true,  slots: makeSlots([['13:00','16:30'],['20:00','00:30']]) }, // ds
      { open:false, slots: [] },                                               // dg
    ],
  },
  pista: {
    avgTableMinutes: 75,
    days: [
      { open:true,  slots: makeSlots([['12:00','16:00'],['18:00','23:00']]) },
      { open:true,  slots: makeSlots([['12:00','16:00'],['18:00','23:00']]) },
      { open:true,  slots: makeSlots([['12:00','16:00'],['18:00','23:00']]) },
      { open:true,  slots: makeSlots([['12:00','16:00'],['18:00','23:00']]) },
      { open:true,  slots: makeSlots([['12:00','16:00'],['18:00','23:30']]) },
      { open:true,  slots: makeSlots([['11:00','17:00'],['18:00','00:00']]) },
      { open:true,  slots: makeSlots([['11:00','17:00']]) },
    ],
  },
  esquitx: {
    avgTableMinutes: 120,
    days: [
      { open:false, slots: [] },                                               // dl
      { open:true,  slots: makeSlots([['20:00','01:00']]) },
      { open:true,  slots: makeSlots([['20:00','01:00']]) },
      { open:true,  slots: makeSlots([['20:00','01:00']]) },
      { open:true,  slots: makeSlots([['20:00','02:00']]) },
      { open:true,  slots: makeSlots([['20:00','02:00']]) },
      { open:true,  slots: makeSlots([['19:00','01:00']]) },
    ],
  },
};

// ─── Shifts per negoci ────────────────────────────────────────────────────────
// Derivats dels torns reals d'empleats a NCR Serveis (/api/shifts per negoci).
// El Ganxo  → pub/discoteca: tot el personal treballa 20:30–04:00 (NIL, AINA, ARNAU).
//             Sense torn de migdia — no hi ha servei de cuina diürn.
// La Pista  → bar-restaurant: dos clústers clars a NCR Serveis:
//             matins 09:00–16:00 i tardes/nit 17:00–00:00.
// L'Esquitx → bar-restaurant: empleats a NCR Serveis fan torns diürns 07:00–20:00
//             (preparació + servei de migdia) i nit des de les 20:00.
export const BIZ_SHIFTS: Record<string, BizShift[]> = {
  ganxo:   [
    { id:'N', code:'N', label:'Nit',    start:'20:30', end:'04:00', color:'#d4e5ee', active:true },
  ],
  pista:   [
    { id:'M', code:'M', label:'Migdia', start:'09:00', end:'16:00', color:'#f3e3d6', active:true },
    { id:'N', code:'N', label:'Nit',    start:'16:00', end:'00:00', color:'#d4e5ee', active:true },
  ],
  esquitx: [
    { id:'M', code:'M', label:'Migdia', start:'09:00', end:'16:00', color:'#f3e3d6', active:true },
    { id:'N', code:'N', label:'Nit',    start:'20:00', end:'01:00', color:'#ecdaf0', active:true },
  ],
};

// ─── Employee roles per negoci ────────────────────────────────────────────────
// Rols derivats de NCR Serveis. Ganxo=pub, Pista+Esquitx=bar-restaurant.
export const EMPLOYEE_ROLES: EmployeeRole[] = [
  // ── El Ganxo (pub/discoteca) ──────────────────────────────────────
  { id:'er1', bizId:'ganxo',   name:'Encarregat/da', color:'#f3e3d6', textColor:'#8a4a2a', order:0, active:true },
  { id:'er2', bizId:'ganxo',   name:'Cambrer/a',     color:'#d4e5ee', textColor:'#3a6b8a', order:1, active:true },
  // ── La Pista (bar-restaurant + pàdel) ────────────────────────────
  { id:'er3', bizId:'pista',   name:'Encarregat/da', color:'#f3e3d6', textColor:'#8a4a2a', order:0, active:true },
  { id:'er4', bizId:'pista',   name:'Cap de cuina',  color:'#e6d3c8', textColor:'#552d20', order:1, active:true },
  { id:'er5', bizId:'pista',   name:'Cuiner/a',      color:'#efdcd3', textColor:'#7d4a3a', order:2, active:true },
  { id:'er6', bizId:'pista',   name:'Cambrer/a sala',color:'#e7ecd3', textColor:'#5d6e3a', order:3, active:true },
  { id:'er7', bizId:'pista',   name:'Pizzer',        color:'#c8f0d0', textColor:'#2a7040', order:4, active:true },
  { id:'er8', bizId:'pista',   name:'Runner',        color:'#daeee7', textColor:'#2e6e5a', order:5, active:true },
  // ── L'Esquitx (bar-restaurant) ───────────────────────────────────
  { id:'er9',  bizId:'esquitx', name:'Encarregat/da', color:'#f3e3d6', textColor:'#8a4a2a', order:0, active:true },
  { id:'er10', bizId:'esquitx', name:'Cap de cuina',  color:'#e6d3c8', textColor:'#552d20', order:1, active:true },
  { id:'er11', bizId:'esquitx', name:'Cuiner/a',      color:'#efdcd3', textColor:'#7d4a3a', order:2, active:true },
  { id:'er12', bizId:'esquitx', name:'Cambrer/a',     color:'#ecdaf0', textColor:'#7a4288', order:3, active:true },
];

// ─── Employees (noms reals de NCR Serveis) ────────────────────────────────────
// clockedIn reflecteix l'estat demo d'un divendres (DOW 4) al migdia.
export const EMPLOYEES: Employee[] = [
  // ── El Ganxo: torn de nit 20:30–04:00 → no fitxats de dia ───────
  { id:'e1', bizId:'ganxo',   fullName:'Nil',       initials:'NL', roleId:'er1', active:true, clockedIn:false, startedAt:null },
  { id:'e2', bizId:'ganxo',   fullName:'Aina',      initials:'AI', roleId:'er1', active:true, clockedIn:false, startedAt:null },
  { id:'e3', bizId:'ganxo',   fullName:'Arnau',     initials:'AR', roleId:'er2', active:true, clockedIn:false, startedAt:null },
  // ── La Pista (divendres): NINA fa torn M (10:00), la resta torn N ─
  { id:'e4',  bizId:'pista',  fullName:'Mounir',    initials:'MO', roleId:'er6', active:true, clockedIn:false, startedAt:null },
  { id:'e5',  bizId:'pista',  fullName:'Joan',      initials:'JN', roleId:'er7', active:true, clockedIn:false, startedAt:null },
  { id:'e6',  bizId:'pista',  fullName:'Ahmed',     initials:'AH', roleId:'er5', active:true, clockedIn:false, startedAt:null },
  { id:'e7',  bizId:'pista',  fullName:'Alejandro', initials:'AL', roleId:'er5', active:true, clockedIn:false, startedAt:null },
  { id:'e8',  bizId:'pista',  fullName:'Mariano',   initials:'MA', roleId:'er4', active:true, clockedIn:false, startedAt:null },
  { id:'e9',  bizId:'pista',  fullName:'Nina',      initials:'NI', roleId:'er6', active:true, clockedIn:true,  startedAt:'10:00' },
  { id:'e10', bizId:'pista',  fullName:'Sara',      initials:'SA', roleId:'er6', active:true, clockedIn:false, startedAt:null },
  { id:'e11', bizId:'pista',  fullName:'Dana',      initials:'DA', roleId:'er6', active:true, clockedIn:false, startedAt:null },
  { id:'e12', bizId:'pista',  fullName:'Bene',      initials:'BE', roleId:'er6', active:true, clockedIn:false, startedAt:null },
  { id:'e13', bizId:'pista',  fullName:'Jordi',     initials:'JO', roleId:'er3', active:true, clockedIn:false, startedAt:null },
  { id:'e14', bizId:'pista',  fullName:'Biel',      initials:'BI', roleId:'er8', active:true, clockedIn:false, startedAt:null },
  { id:'e15', bizId:'pista',  fullName:'Iker',      initials:'IK', roleId:'er8', active:true, clockedIn:false, startedAt:null },
  { id:'e25', bizId:'pista',  fullName:'Pol',       initials:'PO', roleId:'er5', active:true, clockedIn:false, startedAt:null },
  // ── L'Esquitx (divendres): Guillermo, Christian, Vanessa, Adriana fitxats
  { id:'e16', bizId:'esquitx', fullName:'Jose Luis',  initials:'JL', roleId:'er9',  active:true, clockedIn:true,  startedAt:'11:00' },
  { id:'e17', bizId:'esquitx', fullName:'Guillermo',  initials:'GU', roleId:'er10', active:true, clockedIn:true,  startedAt:'07:00' },
  { id:'e18', bizId:'esquitx', fullName:'Lee',        initials:'LE', roleId:'er11', active:true, clockedIn:false, startedAt:null },
  { id:'e19', bizId:'esquitx', fullName:'Christian',  initials:'CH', roleId:'er11', active:true, clockedIn:true,  startedAt:'09:00' },
  { id:'e20', bizId:'esquitx', fullName:'Nina',       initials:'NE', roleId:'er11', active:true, clockedIn:false, startedAt:null },
  { id:'e21', bizId:'esquitx', fullName:'Antonella',  initials:'AN', roleId:'er12', active:true, clockedIn:false, startedAt:null },
  { id:'e22', bizId:'esquitx', fullName:'Vanessa',    initials:'VA', roleId:'er12', active:true, clockedIn:true,  startedAt:'09:00' },
  { id:'e23', bizId:'esquitx', fullName:'Adriana',    initials:'AD', roleId:'er12', active:true, clockedIn:true,  startedAt:'07:45' },
  { id:'e24', bizId:'esquitx', fullName:'Bene',       initials:'BE', roleId:'er12', active:true, clockedIn:false, startedAt:null },
];

// ─── Week schedule (bizId → dow → shiftId → employeeIds) ─────────────────────
// Derivat dels torns reals de NCR Serveis: setmana Apr 13(Dl)–Apr 19(Dg).
// Regla d'assignació pista/esquitx: inici <16:00 → M; inici ≥16:00 → N; doble torn → M+N.
// Esquitx: tots els empleats fan M (07:00–20:00); el torn N existeix però cap l'usa
//          a NCR Serveis (servei nocturn nou, pendent de planificació).
export const WEEK_SCHED: WeekScheduleData = {

  // ── El Ganxo: Nil+Aina dijous-divendres, Aina+Arnau divendres-diumenge ──
  ganxo: {
    0: { N:[] },
    1: { N:[] },
    2: { N:[] },
    3: { N:['e1','e2'] },              // Nil + Aina
    4: { N:['e1','e2','e3'] },         // Nil + Aina + Arnau
    5: { N:['e2','e3'] },              // Aina + Arnau
    6: { N:['e2'] },                   // Aina
  },

  // ── La Pista: dimecres–diumenge segons PDF real; dilluns+dimarts lliures ──
  // e4=Mounir, e5=Joan(Pizzer), e6=Ahmed(Cuiner), e7=Alejandro(Cuiner),
  // e8=Mariano(CapCuina), e9=Nina(Cambrera), e10=Sara(Cambrera),
  // e11=Dana(Cambrera), e12=Bene(Cambrera·La Pista, Esquitx DC+DG),
  // e13=Jordi(Encarregat), e14=Biel(Runner), e15=Iker(Runner), e25=Pol(Cuiner)
  pista: {
    0: { M:[], N:[] },
    //   DL: lliure
    1: { M:[], N:[] },
    //   DT: lliure
    2: { M:[], N:['e8','e9','e13','e4'] },
    //   DC: Mariano(18:00)·Nina(17:00)·Jordi(18:00)·Mounir(16:45) — Bene a L'Esquitx
    3: { M:['e8'], N:['e8','e9','e25','e5','e13','e4','e12'] },
    //   DJ M: Mariano(doble); DJ N: +Nina·Pol·Joan·Jordi·Mounir·Bene
    4: { M:['e9'], N:['e9','e8','e25','e5','e14','e13','e4','e10','e7','e12'] },
    //   DV M: Nina(doble);   DV N: +Mariano·Pol·Joan·Biel·Jordi·Mounir·Sara·Alejandro·Bene
    5: { M:['e8','e9','e13','e7','e11'], N:['e8','e9','e6','e25','e5','e14','e13','e4','e10','e7','e12','e11'] },
    //   DS M: Mariano·Nina·Jordi·Alejandro·Dana; DS N: +Ahmed·Pol·Joan·Biel·Mounir·Sara·Bene
    6: { M:['e8','e9','e13','e7','e10','e11','e6'], N:['e8','e9','e6','e25','e5','e14','e4','e10','e7','e11'] },
    //   DG M: Mariano·Nina·Jordi(PEDIDOS)·Alejandro·Sara·Dana·Ahmed;
    //   DG N: Mariano·Nina·Ahmed·Pol·Joan·Biel·Mounir·Sara·Alejandro·Dana — Bene a L'Esquitx, Jordi no fa N
  },

  // ── L'Esquitx: M=torn diürn (dades reals); N=buit (sense registre a NCR) ──
  esquitx: {
    0: { M:['e16','e17','e18','e21','e22'], N:[] },
    //       JoseLuis·Guillermo·Lee·Antonella·Vanessa
    1: { M:['e16','e18','e19','e20','e21','e23'], N:[] },
    //       JoseLuis·Lee·Christian·Nina·Antonella·Adriana
    2: { M:['e18','e19','e20','e21','e23','e24'], N:[] },
    //       Lee·Christian·Nina·Antonella·Adriana·Bene
    3: { M:['e17','e19','e21','e22','e23'], N:[] },
    //       Guillermo·Christian·Antonella·Vanessa·Adriana
    4: { M:['e16','e17','e19','e22','e23'], N:[] },
    //       JoseLuis·Guillermo·Christian·Vanessa·Adriana
    5: { M:['e16','e17','e18','e22','e23'], N:[] },
    //       JoseLuis·Guillermo·Lee·Vanessa·Adriana
    6: { M:['e16','e17','e18','e19','e22','e24'], N:[] },
    //       JoseLuis·Guillermo·Lee·Christian·Vanessa·Bene
  },
};

// ─── Notification defaults ────────────────────────────────────────────────────
export const NOTIF_DEFAULTS: NotifConfig = {
  pendingConfirm: true,
  peakAlert: true,
  birthdays: false,
  resChanges: true,
  clientNotes: false,
  channel: 'intern',
  advanceMinutes: 60,
};
