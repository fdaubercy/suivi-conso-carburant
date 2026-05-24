/* ─── État global partagé entre modules ─── */
export const state = {
  currentType:        'E85',
  s98Autofilled:      false,
  userLat:            null,
  userLon:            null,
  _nearbyStations:    [],
  currentVehiculeNom: '',
  searchRadiusM:      20000,
  _stationPrices:     {},   // { E85: 0.798, SP98: 2.091, … } — prix station sélectionnée
  _mapStations:       [],   // stations affichées sur la carte
  _selectedLat:       null, // coordonnées de la station sélectionnée
  _selectedLon:       null,
};
