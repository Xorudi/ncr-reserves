/**
 * Catàleg dels 14 al·lèrgens declaratius de la UE (Reglament 1169/2011),
 * amb etiqueta en català i un emoji visual perquè el cambrer els reconegui
 * d'un cop d'ull a la fila de la reserva.
 */
export interface Allergen {
  id:    string;
  label: string;
  emoji: string;
}

export const ALLERGENS: Allergen[] = [
  { id:'gluten',     label:'Gluten',        emoji:'🌾' },
  { id:'lactosa',    label:'Lactis',        emoji:'🥛' },
  { id:'ous',        label:'Ous',           emoji:'🥚' },
  { id:'peix',       label:'Peix',          emoji:'🐟' },
  { id:'marisc',     label:'Crustacis',     emoji:'🦐' },
  { id:'molluscs',   label:'Mol·luscs',     emoji:'🦪' },
  { id:'fruits-secs',label:'Fruits secs',   emoji:'🥜' },
  { id:'cacauets',   label:'Cacauets',      emoji:'🥜' },
  { id:'soja',       label:'Soja',          emoji:'🫘' },
  { id:'sesam',      label:'Sèsam',         emoji:'🌱' },
  { id:'apit',       label:'Api',           emoji:'🥬' },
  { id:'mostassa',   label:'Mostassa',      emoji:'🌭' },
  { id:'sulfits',    label:'Sulfits',       emoji:'🍷' },
  { id:'tramussos',  label:'Tramussos',     emoji:'🌰' },
];

export function allergenById(id: string): Allergen | undefined {
  return ALLERGENS.find(a => a.id === id);
}

export function allergenLabel(id: string): string {
  return allergenById(id)?.label ?? id;
}
