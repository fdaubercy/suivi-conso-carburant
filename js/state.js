/* ─── État global partagé entre modules ─── */
export const state = {
  currentType:        'E85',
  userLat:            null,
  userLon:            null,
  _nearbyStations:    [],
  _geoStations:       [],   // toutes les stations vues lors d'une géoloc (W30 comparateur)
  currentVehiculeNom: '',
  searchRadiusM:      20000,
  _stationPrices:     {},   // { E85: 0.798, SP98: 2.091, … } — prix station sélectionnée
  _mapStations:       [],   // stations affichées sur la carte
  _selectedLat:       null, // coordonnées de la station sélectionnée
  _selectedLon:       null,
  _ticketPhoto:       null, // base64 JPEG de la photo du ticket (W9)
};
