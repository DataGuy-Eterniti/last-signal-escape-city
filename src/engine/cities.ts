/* ==========================================================================
   City modes. Each city is a stylised street grid that borrows real street,
   district and landmark names. Layouts are simplified for gameplay — they are
   "inspired by", not geographically exact maps.

   Grid convention: blocksX × blocksY city blocks. Roads run along every block
   edge; vertical roads are indexed 0..blocksX (west→east), horizontal roads
   0..blocksY (north→south). Intersections are (ix, iy) road indices.
   ========================================================================== */

export type LandmarkKind = 'park' | 'tower' | 'plaza' | 'market' | 'arena';

export interface Landmark {
  name: string;
  kind: LandmarkKind;
  bx: number; // block column
  by: number; // block row
  bw?: number; // span in blocks (default 1)
  bh?: number;
}

export interface District {
  name: string;
  i0: number;
  j0: number;
  i1: number; // inclusive
  j1: number;
  kinds: string[]; // building labels used in this district
}

export interface WaterEdge {
  edge: 'north' | 'south' | 'east' | 'west';
  name: string;
}

export interface CityProfile {
  id: string;
  name: string;
  region: string;
  tagline: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  blocksX: number;
  blocksY: number;
  vRoads: string[]; // blocksX + 1 names, west → east
  hRoads: string[]; // blocksY + 1 names, north → south
  districts: District[];
  landmarks: Landmark[];
  water: WaterEdge[];
  start: { ix: number; iy: number; label: string; heading?: number };
  extraction: { ix: number; iy: number; name: string };
  checkpoints: number; // police barricades closing road segments
  parkedCarDensity: number; // 0..1
  seed: number;
}

const COMMON = ['OFFICES', 'APARTMENTS', 'SHOPS', 'CAFÉ', 'GARAGE', 'HOTEL'];

export const CITIES: CityProfile[] = [
  {
    id: 'nyc',
    name: 'New York',
    region: 'Midtown Manhattan · USA',
    tagline: 'Avenues of glass and gold. Reach the Lincoln Tunnel before the grid locks down.',
    difficulty: 'Hard',
    blocksX: 9,
    blocksY: 12,
    vRoads: ['12th Ave', '11th Ave', '10th Ave', '9th Ave', '8th Ave', '7th Ave', '6th Ave', '5th Ave', 'Madison Ave', 'Park Ave'],
    hRoads: [
      'W 59th St', 'W 57th St', 'W 55th St', 'W 53rd St', 'W 50th St', 'W 47th St', 'W 44th St',
      'W 42nd St', 'W 39th St', 'W 36th St', 'W 34th St', 'W 31st St', 'W 28th St'
    ],
    districts: [
      { name: "Hell's Kitchen", i0: 0, j0: 0, i1: 3, j1: 7, kinds: ['APARTMENTS', 'DINER', 'THEATRE', 'GARAGE', 'BAKERY', 'GYM'] },
      { name: 'Midtown', i0: 4, j0: 1, i1: 8, j1: 7, kinds: ['OFFICES', 'BANK', 'HOTEL', 'TOWER', 'GALLERY', 'STUDIO'] },
      { name: 'Garment District', i0: 0, j0: 8, i1: 5, j1: 11, kinds: ['TEXTILES', 'WAREHOUSE', 'OFFICES', 'SHOWROOM', 'DELI'] },
      { name: 'Koreatown', i0: 6, j0: 8, i1: 8, j1: 11, kinds: ['BBQ', 'KARAOKE', 'HOTEL', 'SPA', 'MARKET'] }
    ],
    landmarks: [
      { name: 'Central Park', kind: 'park', bx: 4, by: 0, bw: 4, bh: 1 },
      { name: 'Rockefeller Center', kind: 'tower', bx: 6, by: 3 },
      { name: 'Times Square', kind: 'plaza', bx: 5, by: 5 },
      { name: 'Bryant Park', kind: 'park', bx: 6, by: 6 },
      { name: 'Grand Central', kind: 'arena', bx: 8, by: 6 },
      { name: 'Empire State', kind: 'tower', bx: 7, by: 9 },
      { name: 'Madison Square Garden', kind: 'arena', bx: 4, by: 10 }
    ],
    water: [{ edge: 'west', name: 'Hudson River' }],
    start: { ix: 8, iy: 1, label: 'Madison Ave & W 57th St', heading: Math.PI / 2 },
    extraction: { ix: 0, iy: 8, name: 'Lincoln Tunnel' },
    checkpoints: 12,
    parkedCarDensity: 0.55,
    seed: 1811
  },
  {
    id: 'lagos',
    name: 'Lagos',
    region: 'Lagos Island · Nigeria',
    tagline: 'Market lanes and marina towers. Make the Third Mainland Bridge before curfew.',
    difficulty: 'Medium',
    blocksX: 8,
    blocksY: 8,
    vRoads: ['Idumagbo Ave', 'Nnamdi Azikiwe St', 'Martins St', 'Tinubu St', 'Kakawa St', 'Igbosere Rd', 'Awolowo Rd', 'Kingsway Rd', 'Bourdillon Rd'],
    hRoads: ['Ebute Ero', 'Adeniji Adele Rd', 'Balogun St', 'Broad St', 'Marina', 'Obalende Rd', 'Ahmadu Bello Way', 'Adeola Odeku St', 'Ozumba Mbadiwe Ave'],
    districts: [
      { name: 'Idumota', i0: 0, j0: 0, i1: 3, j1: 3, kinds: ['MARKET', 'TRADERS', 'FABRICS', 'PHARMACY', 'BUKKA', 'SHOPS'] },
      { name: 'Marina', i0: 4, j0: 0, i1: 7, j1: 4, kinds: ['BANK', 'OFFICES', 'TOWER', 'EXCHANGE', 'COURT', 'HOTEL'] },
      { name: 'Obalende', i0: 0, j0: 4, i1: 3, j1: 7, kinds: ['MOTOR PARK', 'SUYA SPOT', 'APARTMENTS', 'CLINIC', 'SCHOOL'] },
      { name: 'Ikoyi', i0: 4, j0: 5, i1: 7, j1: 7, kinds: ['VILLAS', 'EMBASSY', 'CLUB', 'GALLERY', 'HOTEL', 'GYM'] }
    ],
    landmarks: [
      { name: 'Balogun Market', kind: 'market', bx: 1, by: 1, bw: 2, bh: 1 },
      { name: 'Tafawa Balewa Square', kind: 'plaza', bx: 3, by: 4 },
      { name: 'Marina Tower', kind: 'tower', bx: 5, by: 3 },
      { name: 'Freedom Park', kind: 'park', bx: 2, by: 3 },
      { name: 'Civic Centre', kind: 'arena', bx: 6, by: 6 }
    ],
    water: [
      { edge: 'south', name: 'Lagos Lagoon' },
      { edge: 'west', name: 'Lagos Lagoon' }
    ],
    start: { ix: 7, iy: 7, label: 'Kingsway Rd & Adeola Odeku St', heading: -Math.PI / 2 },
    extraction: { ix: 0, iy: 0, name: 'Third Mainland Bridge' },
    checkpoints: 9,
    parkedCarDensity: 0.7,
    seed: 2026
  },
  {
    id: 'chicago',
    name: 'Chicago',
    region: 'The Loop · USA',
    tagline: 'Steel canyons under the "L". Break out to Lake Shore Drive.',
    difficulty: 'Medium',
    blocksX: 8,
    blocksY: 7,
    vRoads: ['Canal St', 'Clinton St', 'Wacker Dr', 'Wells St', 'LaSalle St', 'Clark St', 'Dearborn St', 'State St', 'Michigan Ave'],
    hRoads: ['Lake St', 'Randolph St', 'Washington St', 'Madison St', 'Monroe St', 'Adams St', 'Jackson Blvd', 'Van Buren St'],
    districts: [
      { name: 'West Loop', i0: 0, j0: 0, i1: 2, j1: 6, kinds: ['LOFTS', 'WAREHOUSE', 'DINER', 'GARAGE', 'BREWERY'] },
      { name: 'Financial District', i0: 3, j0: 2, i1: 5, j1: 6, kinds: ['BANK', 'EXCHANGE', 'OFFICES', 'TOWER', 'COURT'] },
      { name: 'Theatre District', i0: 3, j0: 0, i1: 7, j1: 1, kinds: ['THEATRE', 'HOTEL', 'CAFÉ', 'STUDIO', 'SHOPS'] },
      { name: 'State Street', i0: 6, j0: 2, i1: 7, j1: 6, kinds: ['DEPT STORE', 'SHOPS', 'HOTEL', 'LIBRARY', 'MUSEUM'] }
    ],
    landmarks: [
      { name: 'Union Station', kind: 'arena', bx: 0, by: 4 },
      { name: 'Willis Tower', kind: 'tower', bx: 2, by: 5 },
      { name: 'Daley Plaza', kind: 'plaza', bx: 5, by: 1 },
      { name: 'Millennium Park', kind: 'park', bx: 7, by: 1, bw: 1, bh: 2 }
    ],
    water: [
      { edge: 'north', name: 'Chicago River' },
      { edge: 'east', name: 'Lake Michigan' }
    ],
    start: { ix: 0, iy: 7, label: 'Canal St & Van Buren St', heading: -Math.PI / 2 },
    extraction: { ix: 8, iy: 2, name: 'Lake Shore Drive' },
    checkpoints: 8,
    parkedCarDensity: 0.5,
    seed: 3112
  },
  {
    id: 'gold',
    name: 'Gold City',
    region: 'Free roam · Original',
    tagline: 'An original city to learn the wheel. Fewer checkpoints, wider streets.',
    difficulty: 'Easy',
    blocksX: 7,
    blocksY: 7,
    vRoads: ['Signal Ave', 'Courier St', 'Lantern Ave', 'Amber St', 'Meridian Ave', 'Ember St', 'Harbor Ave', 'Beacon St'],
    hRoads: ['North Rd', 'Gilded Way', 'Copper St', 'Market St', 'Foundry Rd', 'Velvet Ln', 'Quay St', 'South Rd'],
    districts: [
      { name: 'Old Town', i0: 0, j0: 0, i1: 3, j1: 3, kinds: ['MARKET', 'CAFÉ', 'BAKERY', 'APARTMENTS', 'SHOPS'] },
      { name: 'Downtown', i0: 4, j0: 0, i1: 6, j1: 6, kinds: ['OFFICES', 'BANK', 'HOTEL', 'TOWER', 'GALLERY'] },
      { name: 'Docklands', i0: 0, j0: 4, i1: 3, j1: 6, kinds: ['WAREHOUSE', 'GARAGE', 'DEPOT', 'LOFTS'] }
    ],
    landmarks: [
      { name: 'Sun Garden', kind: 'park', bx: 2, by: 2 },
      { name: 'Gilded Spire', kind: 'tower', bx: 5, by: 2 },
      { name: 'Lantern Square', kind: 'plaza', bx: 4, by: 5 }
    ],
    water: [{ edge: 'south', name: 'Amber Bay' }],
    start: { ix: 3, iy: 3, label: 'Amber St & Market St', heading: Math.PI / 2 },
    extraction: { ix: 7, iy: 7, name: 'Harbor Gate' },
    checkpoints: 3,
    parkedCarDensity: 0.2,
    seed: 77
  }
];

export const getCity = (id: string | null | undefined): CityProfile | undefined => CITIES.find((c) => c.id === id);

export const DEFAULT_KINDS = COMMON;
