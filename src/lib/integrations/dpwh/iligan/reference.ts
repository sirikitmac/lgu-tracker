import boundary from './iligan-boundary.osm.json';

/**
 * Reference data used to judge whether a DPWH record is located in Iligan
 * City. None of it comes from the DPWH dataset itself, so it can serve as
 * independent evidence.
 *
 * - Barangays: PSA Philippine Standard Geographic Code (PSGC), City of
 *   Iligan (103504000), retrieved 2026-10-25 from the psgc.gitlab.io mirror.
 * - Other places: PSGC municipalities/cities of Region X and Lanao del Sur,
 *   plus all provinces, retrieved the same day.
 * - Boundary: OpenStreetMap relation 3818838 (ODbL), see iligan-boundary.osm.json.
 */

export const REFERENCE_PROVENANCE = {
  barangays: 'PSA PSGC, City of Iligan (103504000), via https://psgc.gitlab.io/api, retrieved 2026-10-25',
  otherPlaces: 'PSA PSGC Region X and Lanao del Sur municipalities/cities and all provinces, via https://psgc.gitlab.io/api, retrieved 2026-10-25',
  boundary: `${boundary.source}; ${boundary.attribution}; retrieved ${boundary.retrievedAt}`,
  boundaryNote: boundary.note,
};

export const ILIGAN_BOUNDARY_RING: ReadonlyArray<readonly [number, number]> =
  boundary.geometry.coordinates[0] as [number, number][];

export interface IliganBarangay {
  psgcCode: string;
  name: string;
}

/** All 44 barangays of the City of Iligan (PSGC). */
export const ILIGAN_BARANGAYS: readonly IliganBarangay[] = (
  [
    ['103504001', 'Abuno'], ['103504002', 'Bonbonon'], ['103504003', 'Bunawan'],
    ['103504005', 'Buru-un'], ['103504006', 'Dalipuga'], ['103504007', 'Digkilaan'],
    ['103504008', 'Hinaplanon'], ['103504010', 'Kabacsanan'], ['103504011', 'Kiwalan'],
    ['103504012', 'Mahayahay'], ['103504013', 'Mainit'], ['103504014', 'Mandulog'],
    ['103504015', 'Maria Cristina'], ['103504016', 'Palao'], ['103504017', 'Poblacion'],
    ['103504018', 'Puga-an'], ['103504019', 'Rogongon'], ['103504021', 'Santa Elena'],
    ['103504022', 'Santa Filomena'], ['103504024', 'Suarez'], ['103504025', 'Tambacan'],
    ['103504026', 'Saray'], ['103504027', 'Tipanoy'], ['103504028', 'Tomas L. Cabili'],
    ['103504029', 'Upper Tominobo'], ['103504030', 'Tubod'], ['103504031', 'Bagong Silang'],
    ['103504032', 'Del Carmen'], ['103504033', 'Dulag'], ['103504034', 'San Miguel'],
    ['103504035', 'Santiago'], ['103504036', 'Santo Rosario'], ['103504037', 'Tibanga'],
    ['103504038', 'Acmac'], ['103504039', 'Ditucalan'], ['103504040', 'Hindang'],
    ['103504041', 'Kalilangan'], ['103504042', 'Lanipao'], ['103504043', 'Luinab'],
    ['103504044', 'Panoroganan'], ['103504045', 'San Roque'], ['103504046', 'Ubaldo Laya'],
    ['103504047', 'Upper Hinaplanon'], ['103504048', 'Villa Verde'],
  ] as const
).map(([psgcCode, name]) => ({ psgcCode, name }));

/**
 * Municipalities and cities of Region X and Lanao del Sur other than
 * Iligan. Left out on purpose: names that are also Iligan barangays
 * (Kalilangan, Tubod) and names common as street or personal names
 * (Quezon, Magsaysay, Bonifacio, Plaridel, Salvador, Concepcion, Libertad,
 * Medina, Villanueva, Jimenez, Lopez Jaena, San Fernando, Calamba, Catarman, Sagay).
 */
export const OTHER_MUNICIPALITIES: readonly string[] = [
  // Bukidnon
  'Baungon', 'Damulog', 'Dangcagan', 'Don Carlos', 'Impasug-Ong', 'Kadingilan', 'Kibawe',
  'Kitaotao', 'Lantapan', 'Libona', 'Malaybalay', 'Malitbog', 'Manolo Fortich', 'Maramag',
  'Pangantucan', 'Sumilao', 'Talakag', 'Valencia', 'Cabanglasan',
  // Camiguin
  'Guinsiliban', 'Mahinog', 'Mambajao',
  // Lanao del Norte
  'Bacolod', 'Baloi', 'Baroy', 'Kapatagan', 'Sultan Naga Dimaporo', 'Kauswagan', 'Kolambugan',
  'Lala', 'Linamon', 'Maigo', 'Matungao', 'Munai', 'Nunungan', 'Pantao Ragat', 'Poona Piagapo',
  'Sapad', 'Tagoloan', 'Tangcal', 'Pantar',
  // Misamis Occidental
  'Aloran', 'Baliangao', 'Clarin', 'Oroquieta', 'Ozamiz', 'Panaon', 'Sapang Dalaga',
  'Sinacaban', 'Tangub', 'Tudela', 'Don Victoriano Chiongbian',
  // Misamis Oriental
  'Alubijid', 'Balingasag', 'Balingoan', 'Binuangan', 'Cagayan de Oro', 'Claveria',
  'El Salvador', 'Gingoog', 'Gitagum', 'Initao', 'Jasaan', 'Kinoguitan', 'Lagonglong',
  'Laguindingan', 'Lugait', 'Manticao', 'Naawan', 'Opol', 'Salay', 'Sugbongcogon',
  'Talisayan',
  // Lanao del Sur
  'Bacolod-Kalawi', 'Balabagan', 'Balindong', 'Bayang', 'Binidayan', 'Bubong', 'Butig',
  'Ganassi', 'Kapai', 'Lumba-Bayabao', 'Lumbatan', 'Madalum', 'Madamba', 'Malabang',
  'Marantao', 'Marawi', 'Masiu', 'Mulondo', 'Pagayawan', 'Piagapo', 'Poona Bayabao',
  'Pualas', 'Ditsaan-Ramain', 'Saguiaran', 'Tamparan', 'Taraka', 'Tubaran', 'Tugaya', 'Wao',
  'Marogong', 'Calanogas', 'Buadiposo-Buntong', 'Maguing', 'Picong', 'Lumbayanague',
  'Amai Manabilang', 'Sultan Dumalondong', 'Lumbaca-Unayan',
];

/**
 * Provinces other than Lanao del Norte (which geographically contains
 * Iligan), plus common DPWH abbreviations. Left out: Quezon, Aurora, Rizal
 * (frequent street names) and Cagayan (part of "Cagayan de Oro").
 */
export const OTHER_PROVINCES: readonly string[] = [
  'Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan', 'Batanes', 'Isabela', 'Nueva Vizcaya',
  'Quirino', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales', 'Batangas',
  'Cavite', 'Laguna', 'Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan',
  'Romblon', 'Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon',
  'Aklan', 'Antique', 'Capiz', 'Iloilo', 'Negros Occidental', 'Guimaras', 'Bohol', 'Cebu',
  'Negros Oriental', 'Siquijor', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar',
  'Southern Leyte', 'Biliran', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay',
  'Bukidnon', 'Camiguin', 'Misamis Occidental', 'Misamis Oriental', 'Davao del Norte',
  'Davao del Sur', 'Davao Oriental', 'Davao de Oro', 'Davao Occidental', 'Cotabato',
  'South Cotabato', 'Sultan Kudarat', 'Sarangani', 'Abra', 'Benguet', 'Ifugao', 'Kalinga',
  'Mountain Province', 'Apayao', 'Agusan del Norte', 'Agusan del Sur', 'Surigao del Norte',
  'Surigao del Sur', 'Dinagat Islands', 'Basilan', 'Lanao del Sur', 'Maguindanao', 'Sulu',
  'Tawi-Tawi',
  'Mis Or', 'Misamis Or', 'Mis Occ', 'Misamis Occ',
];
