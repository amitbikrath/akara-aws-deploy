// panchang.js — server-side Vedic time markers, ported verbatim from the live
// frontend/public/akara/panchang.jsx so the Lambda's panchang EXACTLY matches
// what the hero rail shows. Same astronomy-engine longitudes, same Drik Lahiri
// (Chitrapaksha) ayanamsa, same name tables. Do not let these drift apart.
//
//   Tithi     = floor((Moon − Sun)_sid / 12°)          → 0..29 (0..14 Shukla, 15..29 Krishna)
//   Nakshatra = floor(Moon_sid / (360/27)°)            → 0..26
//   Yoga      = floor((Sun + Moon)_sid / (360/27)°)    → 0..26

const Astronomy = require('astronomy-engine');

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];
const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shoola',
  'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana',
  'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti',
];
const TITHI_NAMES = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami',
  'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima',
]; // index 14 swaps to Amavasya in Krishna paksha

// Sidereal solar months (sun's rashi) — used only for coarse season/masa context.
const RASHIS = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const NAK_ARC = 360 / 27; // 13.3333°
const TITHI_ARC = 12;

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5; // unix-ms → JD (UT)
}

// Drik Lahiri (Chitrapaksha): J2000.0 = 23.853°, drift 0.013969 °/yr.
function lahiriAyanamsa(jd) {
  const yrs = (jd - 2451545.0) / 365.25;
  return 23.853 + 0.013969 * yrs;
}

function norm360(x) {
  return ((x % 360) + 360) % 360;
}

function computePanchang(date) {
  date = date || new Date();
  const time = Astronomy.MakeTime(date);

  const sun = Astronomy.SunPosition(time); // { elat, elon, vec }
  const moon = Astronomy.EclipticGeoMoon(time); // { lat, lon, dist }

  const ay = lahiriAyanamsa(julianDay(date));
  const sunLon = norm360(sun.elon - ay);
  const moonLon = norm360(moon.lon - ay);

  const phase = norm360(moonLon - sunLon);
  const tithiIdx = Math.floor(phase / TITHI_ARC); // 0..29
  const paksha = tithiIdx < 15 ? 'Shukla' : 'Krishna';
  const tithiNum = tithiIdx % 15; // 0..14
  let tithiName = TITHI_NAMES[tithiNum];
  if (tithiNum === 14) tithiName = paksha === 'Shukla' ? 'Purnima' : 'Amavasya';

  const nakIdx = Math.floor(moonLon / NAK_ARC); // 0..26
  const pada = Math.floor((moonLon % NAK_ARC) / (NAK_ARC / 4)) + 1; // 1..4

  const yogaSum = norm360(sunLon + moonLon);
  const yogaIdx = Math.floor(yogaSum / NAK_ARC); // 0..26

  const rashiIdx = Math.floor(sunLon / 30); // 0..11

  return {
    date: date.toISOString(),
    tithi: tithiName,
    tithiNum: tithiNum + 1, // 1..15 within paksha
    tithiIndex: tithiIdx, // 0..29 absolute
    paksha,
    nakshatra: NAKSHATRAS[nakIdx],
    nakshatraIndex: nakIdx,
    pada,
    yoga: YOGAS[yogaIdx],
    solarMonth: RASHIS[rashiIdx],
    ayanamsa: ay,
    sunLon,
    moonLon,
  };
}

// ── Recurring lunar observances detectable from tithi/paksha alone ──────────
// These need no Gregorian calendar and are precise from the panchang. Each
// carries the deity it honours and a short significance hook the writer uses.
function recurringObservances(p) {
  const out = [];
  const add = (key, name, deity, note) => out.push({ key, name, deity, note });

  if (p.tithiNum === 11) {
    add('ekadashi', 'Ekadashi', 'vishnu',
      'The eleventh lunar day, kept as a fast devoted to Vishnu — a day of lightness, restraint, and remembrance.');
  }
  if (p.tithi === 'Purnima') {
    add('purnima', 'Purnima', 'devi',
      'The full moon — a high tide of devotion, charity, and the chanting of the divine name.');
  }
  if (p.tithi === 'Amavasya') {
    add('amavasya', 'Amavasya', 'shiva',
      'The new-moon night — turned toward ancestors (pitru), introspection, and the formless.');
  }
  if (p.tithiNum === 13) {
    add('pradosh', 'Pradosh Vrat', 'shiva',
      'The thirteenth tithi, kept at dusk in worship of Shiva and Parvati.');
  }
  if (p.paksha === 'Krishna' && p.tithiNum === 4) {
    add('sankashti', 'Sankashti Chaturthi', 'ganesha',
      'The waning fourth, sacred to Ganesha as the remover of obstacles; observed until moonrise.');
  }
  if (p.paksha === 'Shukla' && p.tithiNum === 4) {
    add('vinayaka', 'Vinayaka Chaturthi', 'ganesha',
      'The waxing fourth, devoted to Ganesha for new beginnings.');
  }
  if (p.paksha === 'Krishna' && p.tithi === 'Chaturdashi') {
    add('masik-shivratri', 'Masik Shivaratri', 'shiva',
      'The monthly night of Shiva on the waning fourteenth — vigil, stillness, and the great mantra.');
  }
  if (p.paksha === 'Krishna' && p.tithiNum === 8) {
    add('kalashtami', 'Kalashtami', 'shiva',
      'The waning eighth, honouring Bhairava, the fierce guardian form of Shiva.');
  }
  if (p.tithiNum === 8 && p.paksha === 'Shukla') {
    add('durga-ashtami', 'Masik Durgashtami', 'devi',
      'The waxing eighth, sacred to Durga.');
  }
  return out;
}

module.exports = {
  computePanchang,
  recurringObservances,
  NAKSHATRAS,
  YOGAS,
  TITHI_NAMES,
  RASHIS,
};
