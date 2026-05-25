// topics.js — the autonomous daily topic engine for the Akara Times.
//
// One flagship article per day. The angle is chosen from four signals the user
// asked for, picked ONE-per-day autonomously:
//   • panchang / festivals  (precise, from the live panchang)
//   • weekday deity rotation (vaar devata)
//   • evergreen SEO bank     (high-search devotional explainers)
//   • live trend             (Claude web-search finds a current spiritual topic)
//
// A high-signal lunar day (Purnima, Amavasya, Ekadashi) overrides the rotation,
// because those are timely and heavily searched. Otherwise we advance a
// deterministic wheel, persisted in SSM, so coverage stays varied day to day.
//
// Each topic produces (a) a `brief` — the day's assignment handed to Claude as
// the user turn, and (b) an `imageQuery` the catalog matcher scores against.
// The Akara editorial PERSONA + SEO rules + output JSON shape live in the
// system prompt (SSM, admin-tunable) — not here.

const { RASHIS } = require('./panchang');

// ── Deities: display name, epithets (for image matching + keyword spread),
//    a one-line domain, and sameAs (Wikipedia) for JSON-LD about/mentions. ──
const DEITIES = {
  shiva: {
    display: 'Shiva', domain: 'the auspicious destroyer, lord of yoga and dissolution',
    epithets: ['shiva', 'shiv', 'mahadev', 'mahadeva', 'shankar', 'shankara', 'bholenath', 'rudra', 'nataraj', 'nataraja', 'neelkanth', 'mahakal', 'mahakaal', 'tryambaka', 'shambhu'],
    mantra: 'Om Namah Shivaya', sameAs: 'https://en.wikipedia.org/wiki/Shiva',
  },
  vishnu: {
    display: 'Vishnu', domain: 'the preserver who sustains cosmic order (dharma)',
    epithets: ['vishnu', 'narayan', 'narayana', 'hari', 'vasudeva', 'madhava', 'govind', 'govinda', 'shesha', 'shesh', 'padmanabha'],
    mantra: 'Om Namo Narayanaya', sameAs: 'https://en.wikipedia.org/wiki/Vishnu',
  },
  krishna: {
    display: 'Krishna', domain: 'the divine cowherd, teacher of the Bhagavad Gita',
    epithets: ['krishna', 'krishn', 'govinda', 'gopala', 'madhava', 'murari', 'kanha', 'banke bihari', 'madhusudana', 'keshava', 'radha', 'venu', 'flute'],
    mantra: 'Hare Krishna', sameAs: 'https://en.wikipedia.org/wiki/Krishna',
  },
  rama: {
    display: 'Rama', domain: 'the ideal king, embodiment of dharma in the Ramayana',
    epithets: ['rama', 'ram', 'raghava', 'raghunath', 'ramachandra', 'sita', 'maryada'],
    mantra: 'Shri Ram Jai Ram', sameAs: 'https://en.wikipedia.org/wiki/Rama',
  },
  hanuman: {
    display: 'Hanuman', domain: 'the devoted servant of Rama, lord of strength and bhakti',
    epithets: ['hanuman', 'bajrang', 'bajrangbali', 'anjaneya', 'anjani', 'maruti', 'pavanputra', 'kesari', 'mahavir', 'sankatmochan'],
    mantra: 'Om Hanumate Namah', sameAs: 'https://en.wikipedia.org/wiki/Hanuman',
  },
  ganesha: {
    display: 'Ganesha', domain: 'the remover of obstacles, lord of beginnings and wisdom',
    epithets: ['ganesha', 'ganesh', 'ganapati', 'ganpati', 'vinayaka', 'vinayak', 'vighnaharta', 'gajanana', 'lambodara', 'ekadanta'],
    mantra: 'Om Gam Ganapataye Namah', sameAs: 'https://en.wikipedia.org/wiki/Ganesha',
  },
  devi: {
    display: 'Devi', domain: 'the Great Goddess — Durga, Kali, Parvati — the cosmic Shakti',
    epithets: ['devi', 'durga', 'kali', 'parvati', 'ambe', 'amba', 'shakti', 'mata', 'maa', 'bhavani', 'chandi', 'sherawali', 'gauri', 'uma'],
    mantra: 'Ya Devi Sarvabhuteshu', sameAs: 'https://en.wikipedia.org/wiki/Durga',
  },
  lakshmi: {
    display: 'Lakshmi', domain: 'goddess of fortune, abundance, and grace',
    epithets: ['lakshmi', 'laxmi', 'mahalakshmi', 'shri', 'sri', 'kamala', 'padma'],
    mantra: 'Om Shreem Mahalakshmiyei Namah', sameAs: 'https://en.wikipedia.org/wiki/Lakshmi',
  },
  saraswati: {
    display: 'Saraswati', domain: 'goddess of knowledge, music, and speech',
    epithets: ['saraswati', 'sharada', 'vagdevi', 'veena'],
    mantra: 'Om Aim Saraswatyai Namah', sameAs: 'https://en.wikipedia.org/wiki/Saraswati',
  },
  surya: {
    display: 'Surya', domain: 'the sun god, source of light, health, and time',
    epithets: ['surya', 'aditya', 'bhaskar', 'savitr', 'vivasvan', 'martanda'],
    mantra: 'Om Suryaya Namah', sameAs: 'https://en.wikipedia.org/wiki/Surya',
  },
};

// Vaar devata — weekday → deity (0=Sun … 6=Sat, in IST).
const WEEKDAY_DEITY = ['surya', 'shiva', 'hanuman', 'ganesha', 'vishnu', 'lakshmi', 'hanuman'];
const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Major annual festivals — HINTS ONLY. Exact Gregorian dates shift each year by
// the lunar calendar, so we do NOT assert dates here; instead, on festival/trend
// days the writer is told to confirm the date and details via web search. The
// `window` (month numbers, 1-12) just biases when we lean festival-ward.
const MAJOR_FESTIVALS = [
  { name: 'Makar Sankranti', deity: 'surya', window: [1], rule: 'Sun enters Makara (Capricorn); harvest and the northward sun' },
  { name: 'Vasant Panchami', deity: 'saraswati', window: [1, 2], rule: 'Magha Shukla Panchami' },
  { name: 'Maha Shivaratri', deity: 'shiva', window: [2, 3], rule: 'Phalguna Krishna Chaturdashi' },
  { name: 'Holi', deity: 'krishna', window: [3], rule: 'Phalguna Purnima (Holika Dahan) and the day after' },
  { name: 'Ugadi / Gudi Padwa', deity: 'devi', window: [3, 4], rule: 'Chaitra Shukla Pratipada — the lunar new year' },
  { name: 'Rama Navami', deity: 'rama', window: [3, 4], rule: 'Chaitra Shukla Navami — birth of Rama' },
  { name: 'Hanuman Jayanti', deity: 'hanuman', window: [4], rule: 'Chaitra Purnima — birth of Hanuman' },
  { name: 'Akshaya Tritiya', deity: 'vishnu', window: [4, 5], rule: 'Vaishakha Shukla Tritiya' },
  { name: 'Guru Purnima', deity: 'vishnu', window: [7], rule: 'Ashadha Purnima — honouring the guru' },
  { name: 'Nag Panchami', deity: 'shiva', window: [7, 8], rule: 'Shravana Shukla Panchami' },
  { name: 'Raksha Bandhan', deity: 'vishnu', window: [8], rule: 'Shravana Purnima' },
  { name: 'Krishna Janmashtami', deity: 'krishna', window: [8, 9], rule: 'Bhadrapada Krishna Ashtami — birth of Krishna' },
  { name: 'Ganesh Chaturthi', deity: 'ganesha', window: [8, 9], rule: 'Bhadrapada Shukla Chaturthi' },
  { name: 'Navratri & Durga Puja', deity: 'devi', window: [9, 10], rule: 'Ashwina Shukla Pratipada–Navami' },
  { name: 'Vijayadashami (Dussehra)', deity: 'devi', window: [10], rule: 'Ashwina Shukla Dashami' },
  { name: 'Karva Chauth', deity: 'devi', window: [10, 11], rule: 'Kartika Krishna Chaturthi' },
  { name: 'Dhanteras & Diwali', deity: 'lakshmi', window: [10, 11], rule: 'Kartika Krishna Trayodashi–Amavasya' },
  { name: 'Govardhan Puja & Bhai Dooj', deity: 'krishna', window: [10, 11], rule: 'Kartika Shukla Pratipada–Dwitiya' },
  { name: 'Gita Jayanti', deity: 'krishna', window: [12], rule: 'Margashirsha Shukla Ekadashi' },
];

// Evergreen high-search devotional explainers — steady keyword coverage.
const EVERGREEN = [
  { title: 'Hanuman Chalisa: meaning, benefits, and how to chant', deity: 'hanuman', category: 'Scripture', keywords: ['hanuman chalisa', 'hanuman chalisa meaning', 'hanuman chalisa benefits', 'tulsidas', 'how to chant hanuman chalisa'] },
  { title: 'Om Namah Shivaya: the meaning of the five-syllable mantra', deity: 'shiva', category: 'Scripture', keywords: ['om namah shivaya', 'om namah shivaya meaning', 'panchakshara mantra', 'shiva mantra'] },
  { title: 'The Gayatri Mantra: meaning, word by word', deity: 'surya', category: 'Scripture', keywords: ['gayatri mantra', 'gayatri mantra meaning', 'savitri', 'vedic mantra'] },
  { title: 'What is Sanatana Dharma? The eternal way, explained', deity: null, category: 'Philosophy', keywords: ['sanatana dharma', 'sanatan dharma meaning', 'hinduism', 'eternal dharma', 'what is sanatana dharma'] },
  { title: 'The meaning of Om (Aum): the primordial sound', deity: null, category: 'Philosophy', keywords: ['om meaning', 'aum', 'pranava', 'om symbol meaning'] },
  { title: 'Why we fast on Ekadashi', deity: 'vishnu', category: 'Festivals', keywords: ['ekadashi', 'ekadashi fasting', 'ekadashi vrat', 'ekadashi meaning', 'why fast on ekadashi'] },
  { title: 'The symbolism of Ganesha: every detail has a meaning', deity: 'ganesha', category: 'Deities', keywords: ['ganesha symbolism', 'why ganesha has elephant head', 'ganesha meaning', 'lord ganesha'] },
  { title: 'Maha Mrityunjaya Mantra: meaning and significance', deity: 'shiva', category: 'Scripture', keywords: ['maha mrityunjaya mantra', 'mrityunjaya mantra meaning', 'tryambakam', 'healing mantra'] },
  { title: 'The Bhagavad Gita in brief: Krishna’s teaching to Arjuna', deity: 'krishna', category: 'Scripture', keywords: ['bhagavad gita', 'gita summary', 'krishna arjuna', 'karma yoga', 'gita teachings'] },
  { title: 'The significance of the Tulsi plant in Hindu homes', deity: 'vishnu', category: 'Philosophy', keywords: ['tulsi plant significance', 'holy basil hindu', 'tulsi vivah', 'why tulsi is sacred'] },
  { title: 'The three forms: Brahma, Vishnu, and Shiva (the Trimurti)', deity: 'vishnu', category: 'Deities', keywords: ['trimurti', 'brahma vishnu shiva', 'hindu trinity', 'creator preserver destroyer'] },
  { title: 'The nine forms of Durga (Navadurga)', deity: 'devi', category: 'Deities', keywords: ['navadurga', 'nine forms of durga', 'navratri goddesses', 'durga forms'] },
  { title: 'What the conch (shankha) means in worship', deity: 'vishnu', category: 'Philosophy', keywords: ['shankha meaning', 'conch in hinduism', 'why conch is blown', 'shankha significance'] },
  { title: 'The four Vedas, simply explained', deity: null, category: 'Scripture', keywords: ['four vedas', 'rigveda', 'vedas explained', 'vedic scriptures'] },
  { title: 'Diya, dhoop, and the meaning of light in puja', deity: null, category: 'Philosophy', keywords: ['diya meaning', 'aarti significance', 'why light lamp in puja', 'deepak hindu'] },
  { title: 'Rudraksha: the bead of Shiva, its meaning and use', deity: 'shiva', category: 'Philosophy', keywords: ['rudraksha', 'rudraksha meaning', 'rudraksha benefits', 'mukhi rudraksha'] },
];

const COMMON_KEYWORDS = ['sanatana dharma', 'hindu spirituality', 'bhakti', 'devotion', 'akara'];

function deityKeywords(key) {
  const d = DEITIES[key];
  if (!d) return [];
  return [d.display.toLowerCase(), `lord ${d.display.toLowerCase()}`, ...d.epithets.slice(0, 4)];
}

function panchangLine(p) {
  return `${p.paksha} ${p.tithi} · Nakshatra ${p.nakshatra} (pada ${p.pada}) · Yoga ${p.yoga} · Sun in ${p.solarMonth}`;
}

const SANATAN_LENS =
  'Frame everything through the Akara lens: reverent, rooted in Sanatana Dharma, connecting the timeless to the present day — never sensational, never preachy. Cite scripture or tradition where natural.';

function festivalTopic(obs, p) {
  const d = DEITIES[obs.deity] || {};
  return {
    angle: 'festival',
    category: 'Festivals',
    deity: obs.deity || null,
    deityDisplay: d.display || null,
    workingTitle: `${obs.name}: meaning, observance, and the divine angle`,
    festivalName: obs.name,
    useWebSearch: true,
    keywords: [obs.name.toLowerCase(), `${obs.name.toLowerCase()} meaning`, `${obs.name.toLowerCase()} significance`, `${obs.name.toLowerCase()} 2026`, ...deityKeywords(obs.deity), ...COMMON_KEYWORDS],
    imageQuery: { deity: obs.deity, terms: [...(d.epithets || [])] },
    brief: [
      `TODAY'S ASSIGNMENT — FESTIVAL / OBSERVANCE: ${obs.name}.`,
      `Panchang for today: ${panchangLine(p)}.`,
      `${obs.note}`,
      `Use web search to confirm today's exact date, the precise tithi timing, and any region-specific customs, then write a serious, useful feature: what the day is, its scriptural/mythic origin, how it is observed (vrat, puja, mantra), and why it matters now.`,
      d.display ? `Centre it on ${d.display} (${d.domain}); suggested mantra: ${d.mantra}.` : '',
      SANATAN_LENS,
    ].filter(Boolean).join('\n'),
  };
}

function deityTopic(weekday, p, minorObs) {
  const key = WEEKDAY_DEITY[weekday];
  const d = DEITIES[key];
  const occasion = minorObs ? ` Today is also ${minorObs.name} — ${minorObs.note}` : '';
  return {
    angle: 'deity',
    category: 'Deities',
    deity: key,
    deityDisplay: d.display,
    workingTitle: `${d.display} on ${WEEKDAY_NAME[weekday]}: the vaar devata and what devotion looks like`,
    festivalName: minorObs ? minorObs.name : null,
    useWebSearch: false,
    keywords: [...deityKeywords(key), `${WEEKDAY_NAME[weekday].toLowerCase()} ${d.display.toLowerCase()}`, `${d.display.toLowerCase()} worship`, `${d.display.toLowerCase()} mantra`, ...COMMON_KEYWORDS],
    imageQuery: { deity: key, terms: [...d.epithets] },
    brief: [
      `TODAY'S ASSIGNMENT — DEITY FEATURE: ${d.display} (${d.domain}).`,
      `${WEEKDAY_NAME[weekday]} is traditionally ${d.display}'s day (vaar devata).${occasion}`,
      `Panchang for today: ${panchangLine(p)}.`,
      `Write a substantial feature: who ${d.display} is, the iconography and its meaning, a key story or two from scripture, the mantra (${d.mantra}) and how devotees worship today, and a reflection on what this deity asks of the seeker.`,
      SANATAN_LENS,
    ].join('\n'),
  };
}

function astrologyTopic(p, weekday) {
  const moonRashi = RASHIS[Math.floor(p.moonLon / 30)];
  return {
    angle: 'astrology',
    category: 'Astrology',
    deity: null,
    deityDisplay: null,
    workingTitle: `Today's sky: the Moon in ${p.nakshatra}, and what the day favours`,
    festivalName: null,
    useWebSearch: false,
    keywords: ['daily panchang', 'today nakshatra', `${p.nakshatra.toLowerCase()} nakshatra`, 'vedic astrology today', 'rashifal', `moon in ${moonRashi.toLowerCase()}`, 'tithi today', ...COMMON_KEYWORDS],
    imageQuery: { deity: null, terms: ['cosmic', 'celestial', 'stars', 'moon', 'sky', 'nakshatra', 'divine'] },
    brief: [
      `TODAY'S ASSIGNMENT — DAILY ASTROLOGY / PANCHANG NOTE.`,
      `Today's panchang: ${panchangLine(p)}. Moon rashi: ${moonRashi}.`,
      `Write a grounded daily guidance piece in the Vedic jyotish tradition: explain the qualities of the ${p.nakshatra} nakshatra and the ${p.tithi} tithi, what activities the day traditionally favours or counsels patience on, and a short reflective practice. Keep it dignified and rooted — not a fortune-cookie horoscope. Be clear that this is traditional guidance, not prediction.`,
      SANATAN_LENS,
    ].join('\n'),
  };
}

function evergreenTopic(idx, p) {
  const e = EVERGREEN[idx % EVERGREEN.length];
  const d = e.deity ? DEITIES[e.deity] : null;
  return {
    angle: 'evergreen',
    category: e.category,
    deity: e.deity || null,
    deityDisplay: d ? d.display : null,
    workingTitle: e.title,
    festivalName: null,
    useWebSearch: false,
    keywords: [...e.keywords, ...COMMON_KEYWORDS],
    imageQuery: { deity: e.deity || null, terms: d ? [...d.epithets] : ['om', 'temple', 'sacred', 'devotional', 'divine'] },
    brief: [
      `TODAY'S ASSIGNMENT — EVERGREEN EXPLAINER: "${e.title}".`,
      `Panchang for today (use as a dateline, optional): ${panchangLine(p)}.`,
      `Write the definitive, genuinely useful explainer a seeker would search for. Be accurate and specific — meanings, origins, correct transliteration, and practical guidance. This is reference-quality content meant to rank and to be cited.`,
      SANATAN_LENS,
    ].join('\n'),
  };
}

function trendTopic(p) {
  return {
    angle: 'trend',
    category: 'Deities',
    deity: null,
    deityDisplay: null,
    workingTitle: `What devotees are talking about today`,
    festivalName: null,
    useWebSearch: true,
    keywords: ['hindu news today', 'trending spiritual', 'temple', 'dharma', ...COMMON_KEYWORDS],
    imageQuery: { deity: null, terms: ['temple', 'devotional', 'sacred', 'divine', 'om'] },
    brief: [
      `TODAY'S ASSIGNMENT — TRENDING TOPIC.`,
      `Panchang for today: ${panchangLine(p)}.`,
      `Use web search to find a genuinely current, noteworthy topic in the Hindu / Sanatana Dharma world right now — a deity or festival in the news, a temple event, a pilgrimage, an anniversary, a cultural moment. Pick ONE with real search interest and lasting relevance, and write a serious feature on it with the divine/Akara angle. Avoid politics and controversy; favour the devotional and the timeless. Verify facts via search and cite reputable sources.`,
      `If nothing noteworthy is trending, fall back to a feature on the deity of the day and say so to yourself silently (do not mention this instruction in the article).`,
      SANATAN_LENS,
    ].join('\n'),
  };
}

// nearMajorFestival — does a major festival's month window include this month?
// Used only to nudge the wheel toward 'festival/trend' angles in festival season.
function nearMajorFestival(date) {
  const m = date.getUTCMonth() + 1;
  return MAJOR_FESTIVALS.filter((f) => f.window.includes(m));
}

// pickTopic — the autonomous selector. Returns { topic, state }.
function pickTopic({ date, weekday, panchang, observances, state }) {
  state = state && typeof state === 'object' ? { ...state } : {};
  if (typeof state.counter !== 'number') state.counter = 0;
  if (typeof state.evergreenIndex !== 'number') state.evergreenIndex = 0;

  let topic;
  const bigKeys = ['purnima', 'amavasya', 'ekadashi'];
  const big = (observances || []).find((o) => bigKeys.includes(o.key));

  if (big) {
    topic = festivalTopic(big, panchang);
  } else {
    const wheel = ['deity', 'astrology', 'evergreen', 'trend'];
    const angle = wheel[state.counter % wheel.length];
    if (angle === 'deity') {
      topic = deityTopic(weekday, panchang, (observances || [])[0]);
    } else if (angle === 'astrology') {
      topic = astrologyTopic(panchang, weekday);
    } else if (angle === 'evergreen') {
      topic = evergreenTopic(state.evergreenIndex, panchang);
      state.evergreenIndex = (state.evergreenIndex + 1) % EVERGREEN.length;
    } else {
      topic = trendTopic(panchang);
    }
  }

  state.counter += 1;
  state.recent = [topic.angle, ...(state.recent || [])].slice(0, 7);
  state.lastPick = { date: date.toISOString().slice(0, 10), angle: topic.angle, title: topic.workingTitle };
  return { topic, state };
}

module.exports = {
  pickTopic,
  DEITIES,
  WEEKDAY_DEITY,
  WEEKDAY_NAME,
  MAJOR_FESTIVALS,
  EVERGREEN,
  nearMajorFestival,
  panchangLine,
  // exported for unit tests / the Lambda
  festivalTopic,
  deityTopic,
  astrologyTopic,
  evergreenTopic,
  trendTopic,
};
