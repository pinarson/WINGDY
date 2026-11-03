export const spots = [
  { id: 'tharon', name: 'Tharon-Plage', area: 'Saint-Michel-Chef-Chef · Loire-Atlantique', lat: 47.16957, lon: -2.16599, source: 'https://www.pornic.com/la-paillote-de-tharon-1.html', reference: 'Office de tourisme de Pornic · front de mer de Tharon' },
  { id: 'la-baule', name: 'La Baule', area: 'La Baule-Escoublac · Loire-Atlantique', lat: 47.28191, lon: -2.39399, source: 'https://en.ot-batzsurmer.fr/la-baule-beach.html', reference: 'Office de tourisme de Batz-sur-Mer · plage de La Baule' },
  { id: 'suscinio', name: 'Suscinio', area: 'Sarzeau · Morbihan', lat: 47.50468, lon: -2.72878, source: 'https://www.openstreetmap.org/way/23038014', reference: 'OpenStreetMap · plage de Suscinio (way 23038014), coordonnées recoupées avec Mapcarta' },
];
export const getSpot = id => spots.find(s => s.id === id) || spots[0];
