// ===== Band Simulator: static game data & tuning numbers =====
const WEEKS_PER_YEAR = 48;
const WEEK_MS = 2500;          // real ms per game week at 1x speed
const START_MONEY = 1500;
const MAX_MEMBERS = 5;
const VACATION_COST = 250;
const VACATION_WEEKS = 2;
const lessonCost = level => 60 + 40 * level;

const GENRES = ['Rock', 'Punk', 'Metal', 'Pop', 'Hip-Hop', 'Jazz', 'Electronic', 'Folk', 'Country', 'Indie', 'R&B', 'Reggae'];
const INSTRUMENTS = ['Guitar', 'Bass', 'Drums', 'Vocals', 'Keys', 'Synth', 'Turntables', 'Sax', 'Violin'];

const TRAITS = {
  Workaholic: { desc: 'Stamina drains 25% slower.' },
  Diva:       { desc: '+1 Performance on stage, but makes requests more often.' },
  Prodigy:    { desc: 'Earns 50% more XP.' },
  Gearhead:   { desc: 'Gear wears half as fast and plays one tier higher.' },
  Steady:     { desc: 'Smaller random swings on stage and in the studio.' },
  Wildcard:   { desc: 'Bigger random swings on stage and in the studio.' },
  Lazy:       { desc: 'Asks for a vacation at 70% stamina instead of 50%.' },
};
const TRAIT_NAMES = Object.keys(TRAITS);

const CITY_TIERS = {
  local:         { name: 'Local',         cap: 100,  ticket: 8,  unlock: 30 },
  regional:      { name: 'Regional',      cap: 350,  ticket: 12, unlock: 150 },
  national:      { name: 'National',      cap: 1200, ticket: 20, unlock: 800 },
  international: { name: 'International', cap: 3000, ticket: 30, unlock: 2500 },
};
const TIER_ORDER = ['local', 'regional', 'national', 'international'];

const CITIES = [
  { id: 'home', name: 'Hometown', tier: 'local' },
  { id: 'riverside', name: 'Riverside', tier: 'local' },
  { id: 'oakdale', name: 'Oakdale', tier: 'local' },
  { id: 'porthaven', name: 'Port Haven', tier: 'regional' },
  { id: 'millbrook', name: 'Millbrook', tier: 'regional' },
  { id: 'cedarfalls', name: 'Cedar Falls', tier: 'regional' },
  { id: 'lakewood', name: 'Lakewood', tier: 'regional' },
  { id: 'capital', name: 'Capital City', tier: 'national' },
  { id: 'baycity', name: 'Bay City', tier: 'national' },
  { id: 'metro', name: 'Metro Heights', tier: 'national' },
  { id: 'sunvalley', name: 'Sun Valley', tier: 'national' },
  { id: 'northgate', name: 'Northgate', tier: 'national' },
  { id: 'london', name: 'London', tier: 'international' },
  { id: 'tokyo', name: 'Tokyo', tier: 'international' },
  { id: 'berlin', name: 'Berlin', tier: 'international' },
  { id: 'saopaulo', name: 'São Paulo', tier: 'international' },
  { id: 'seoul', name: 'Seoul', tier: 'international' },
  { id: 'sydney', name: 'Sydney', tier: 'international' },
  { id: 'paris', name: 'Paris', tier: 'international' },
  { id: 'mexicocity', name: 'Mexico City', tier: 'international' },
];

const TRANSPORT = {
  van: { name: 'Van',         perCity: 40,  drain: 14, maxTier: 1 },
  bus: { name: 'Tour Bus',    perCity: 120, drain: 9,  maxTier: 2, buy: 4000 },
  jet: { name: 'Private Jet', perCity: 500, drain: 5,  maxTier: 3, rent: 1500 },
};

const FORMATS = {
  online: { name: 'Upload Online',         cost: 0,    price: 0,  buy: 0,    fanMult: 1.2,  desc: 'Free. More new fans, but no profit.' },
  cd:     { name: 'CD',                    cost: 300,  price: 10, buy: 0.5,  fanMult: 1.0,  desc: 'Sells on release and at shows.' },
  cddvd:  { name: 'CD + DVD',              cost: 650,  price: 18, buy: 0.45, fanMult: 1.15, desc: 'Live footage + interviews. Sells 25% more at great shows (700+).' },
  deluxe: { name: 'CD + Cassette + Vinyl', cost: 1400, price: 35, buy: 0.15, fanMult: 0.8,  desc: 'Die-hard fans only, but a huge margin.' },
};

const MERCH = {
  stickers: { name: 'Stickers', cost: 0.5, price: 3,  rate: 0.5,  step: 50 },
  patches:  { name: 'Patches',  cost: 1,   price: 5,  rate: 0.3,  step: 25 },
  posters:  { name: 'Posters',  cost: 2,   price: 12, rate: 0.22, step: 20 },
  shirts:   { name: 'Shirts',   cost: 5,   price: 25, rate: 0.3,  step: 20 },
  hats:     { name: 'Hats',     cost: 6,   price: 25, rate: 0.15, step: 10 },
  hoodies:  { name: 'Hoodies',  cost: 15,  price: 55, rate: 0.1,  step: 10 },
};

const GEAR_TIERS = [
  { name: 'Pawn Shop', cost: 0 },
  { name: 'Starter',   cost: 300 },
  { name: 'Pro',       cost: 1200 },
  { name: 'Boutique',  cost: 4000 },
  { name: 'Legendary', cost: 12000 },
];

const RECRUIT = {
  word:      { name: 'Word of Mouth',    cost: 0,    weeks: 2, count: 2, min: 1, max: 4, desc: 'Free. Ask around town (2 weeks).' },
  ad:        { name: 'Put Out an Ad',    cost: 250,  weeks: 1, count: 4, min: 2, max: 6, desc: 'Medium reach (1 week).' },
  recruiter: { name: 'Talent Recruiter', cost: 1200, weeks: 0, count: 3, min: 4, max: 8, star: 0.1, desc: 'Instant. Skilled players, maybe a star.' },
};

// Critics: weights over album pools T(heory) C(reativity) M(usicianship) L(ength). bias null = random each review.
const CRITICS = [
  { name: 'The Purist', w: { T: .45, C: .15, M: .30, L: .10 }, bias: -4, color: '#4c6ef5',
    quotes: ['Learn a scale. Any scale.', 'Competent, but forgettable.', 'Real craft on display here.', 'Impeccably constructed.', 'A masterclass in songwriting.'] },
  { name: 'Hype Machine', w: { T: .10, C: .45, M: .25, L: .20 }, bias: 5, color: '#e64980',
    quotes: ['Even I cannot hype this.', 'Some vibes. Not enough vibes.', 'This one slaps, honestly!', 'OBSESSED. On repeat all week.', 'Album of the decade?! YES.'] },
  { name: 'Old Head', w: { T: .30, C: .10, M: .50, L: .10 }, bias: 0, color: '#f59f00',
    quotes: ['Kids today can\'t play.', 'Sloppy in spots. Promising.', 'These folks have chops.', 'Tight as my old band was.', 'Best playing I\'ve heard in years.'] },
  { name: 'The Algorithm', w: { T: .20, C: .30, M: .20, L: .30 }, bias: null, color: '#12b886',
    quotes: ['SKIP RATE: CRITICAL.', 'ENGAGEMENT: BELOW AVERAGE.', 'PLAYLIST FIT: GOOD.', 'RECOMMENDING TO MILLIONS.', 'ERROR: SCORE OVERFLOW. 10/10.'] },
];

const FIRST_NAMES = ['Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Jamie', 'Taylor', 'Quinn', 'Avery', 'Rowan', 'Skyler',
  'Dana', 'Robin', 'Kai', 'Noor', 'Mika', 'Yuki', 'Ravi', 'Lena', 'Marco', 'Ines', 'Tomas', 'Zoe', 'Felix', 'Priya', 'Omar',
  'Hana', 'Leo', 'Ada', 'Jin', 'Sol', 'Nico', 'Rosa', 'Ezra', 'Mara', 'Theo', 'Iris', 'Diego', 'Freya', 'Kofi', 'Lux', 'Remy',
  'Sasha', 'Wren', 'Arlo', 'Juno', 'Vic'];
const TITLE_ADJ = ['Neon', 'Broken', 'Electric', 'Midnight', 'Velvet', 'Static', 'Golden', 'Hollow', 'Wild', 'Paper', 'Silent',
  'Burning', 'Cosmic', 'Lonely', 'Crimson', 'Feral', 'Borrowed', 'Plastic'];
const TITLE_NOUN = ['Hearts', 'Highway', 'Dreams', 'Machines', 'Summer', 'Ghosts', 'Signals', 'Thunder', 'Garden', 'Skyline',
  'Echoes', 'Rebellion', 'Tides', 'Satellites', 'Basement', 'Fever', 'Weather', 'Cassettes'];

const SKINS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
const HAIRS = ['#2b1d0e', '#111111', '#d6b370', '#a5402a', '#e8e8e8', '#3b5bdb', '#e64980', '#f08c00', '#40c057'];
const SHIRTS = ['#e03131', '#1971c2', '#2f9e44', '#f08c00', '#7048e8', '#212529', '#f8f9fa', '#0ca678', '#d6336c'];
const PANTS = ['#343a40', '#1c3d6e', '#5c3b1e', '#495057', '#212529'];
