// panchang.jsx — live tithi / nakshatra / yoga
//
// Pipeline:
//   1. Astronomy Engine gives apparent geocentric ecliptic longitudes of Sun & Moon (tropical, of-date).
//      Engine: https://github.com/cosinekitty/astronomy-engine — sub-arc-second accuracy.
//   2. Subtract Lahiri (Chitrapaksha) ayanamsa to get sidereal longitudes.
//      Reference epoch: J2000.0 → 23.853°, secular drift 0.013969 °/yr (≈ 50.288"/yr) per Indian Astronomical Ephemeris.
//   3. Tithi = floor((Moon − Sun)_sid / 12°)         → 0..29  (0..14 = Shukla, 15..29 = Krishna)
//      Nakshatra = floor(Moon_sid / (360°/27))       → 0..26
//      Yoga      = floor((Sun + Moon)_sid / (360°/27)) → 0..26
//
// The browser global `Astronomy` is provided by the astronomy-engine UMD script in layout.tsx.

(function(){
  const NAKSHATRAS = [
    "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
    "Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
    "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"
  ];
  const YOGAS = [
    "Vishkambha","Priti","Ayushman","Saubhagya","Shobhana","Atiganda","Sukarma","Dhriti","Shoola",
    "Ganda","Vriddhi","Dhruva","Vyaghata","Harshana","Vajra","Siddhi","Vyatipata","Variyana",
    "Parigha","Shiva","Siddha","Sadhya","Shubha","Shukla","Brahma","Indra","Vaidhriti"
  ];
  const TITHI_NAMES = [
    "Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami","Shashthi","Saptami","Ashtami",
    "Navami","Dashami","Ekadashi","Dwadashi","Trayodashi","Chaturdashi","Purnima"
  ]; // index 14 swaps to Amavasya in Krishna paksha

  const NAK_ARC = 360 / 27; // 13.3333°
  const TITHI_ARC = 12;     // 12°

  function julianDay(date){
    return date.getTime() / 86400000 + 2440587.5; // unix-ms → JD (UT)
  }

  // Drik Lahiri (Chitrapaksha) ayanamsa, degrees.
  // Linear model anchored at J2000.0 = 23.853°, drift 0.013969 °/yr.
  // Error vs IAE polynomial < 0.01° in 1900–2100 (well below our 12°/13.3° bin width).
  function lahiriAyanamsa(jd){
    const yrs = (jd - 2451545.0) / 365.25;
    return 23.853 + 0.013969 * yrs;
  }

  function norm360(x){ return ((x % 360) + 360) % 360; }

  function computePanchang(date){
    if (typeof Astronomy === "undefined") return null;
    date = date || new Date();
    const time = Astronomy.MakeTime(date);

    // Apparent geocentric ecliptic-of-date longitudes (tropical), degrees.
    const sun  = Astronomy.SunPosition(time);       // { elat, elon, vec }
    const moon = Astronomy.EclipticGeoMoon(time);   // { lat, lon, dist }
    const sunLonTrop  = sun.elon;
    const moonLonTrop = moon.lon;

    // Tropical → sidereal (Lahiri).
    const ay = lahiriAyanamsa(julianDay(date));
    const sunLon  = norm360(sunLonTrop  - ay);
    const moonLon = norm360(moonLonTrop - ay);

    // Tithi (lunar phase divided into 30 segments of 12°)
    const phase = norm360(moonLon - sunLon);
    const tithiIdx = Math.floor(phase / TITHI_ARC); // 0..29
    const paksha = tithiIdx < 15 ? "Shukla" : "Krishna";
    const tithiNum = tithiIdx % 15;                 // 0..14
    let tithiName = TITHI_NAMES[tithiNum];
    if (tithiNum === 14) tithiName = paksha === "Shukla" ? "Purnima" : "Amavasya";

    // Nakshatra (Moon's sidereal longitude / 13°20')
    const nakIdx = Math.floor(moonLon / NAK_ARC);   // 0..26
    const padaWithin = (moonLon % NAK_ARC) / (NAK_ARC / 4);
    const pada = Math.floor(padaWithin) + 1;        // 1..4

    // Yoga ((Sun + Moon)_sid / 13°20')
    const yogaSum = norm360(sunLon + moonLon);
    const yogaIdx = Math.floor(yogaSum / NAK_ARC);  // 0..26

    return {
      tithi: tithiName,
      tithiNum: tithiNum + 1,         // 1..15 (within paksha)
      paksha,
      nakshatra: NAKSHATRAS[nakIdx],
      pada,
      yoga: YOGAS[yogaIdx],
      ayanamsa: ay,
      sunLon, moonLon,
    };
  }

  window.computePanchang = computePanchang;
})();
