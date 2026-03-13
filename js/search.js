/* ============================================================
   search.js — Country search bar in the header.
   Filters the COUNTRIES list and flies the map to the selection,
   drawing a fading GeoJSON border highlight around the country.
   ============================================================ */


/* ── Country data ────────────────────────────────────────── */
// ~195 countries: { name, flag, cap (capital), lat, lng }
// Names and capitals are plain ASCII (no diacritics) for easy searching.

const COUNTRIES = [
  {name:'Afghanistan',flag:'🇦🇫',cap:'Kabul',lat:34.5253,lng:69.1783},
  {name:'Albania',flag:'🇦🇱',cap:'Tirana',lat:41.3317,lng:19.8317},
  {name:'Algeria',flag:'🇩🇿',cap:'Algiers',lat:36.7372,lng:3.0865},
  {name:'Andorra',flag:'🇦🇩',cap:'Andorra la Vella',lat:42.5075,lng:1.5218},
  {name:'Angola',flag:'🇦🇴',cap:'Luanda',lat:-8.8368,lng:13.2343},
  {name:'Argentina',flag:'🇦🇷',cap:'Buenos Aires',lat:-34.6037,lng:-58.3816},
  {name:'Armenia',flag:'🇦🇲',cap:'Yerevan',lat:40.1872,lng:44.5152},
  {name:'Australia',flag:'🇦🇺',cap:'Canberra',lat:-35.2809,lng:149.1300},
  {name:'Austria',flag:'🇦🇹',cap:'Vienna',lat:48.2092,lng:16.3728},
  {name:'Azerbaijan',flag:'🇦🇿',cap:'Baku',lat:40.4093,lng:49.8671},
  {name:'Bahamas',flag:'🇧🇸',cap:'Nassau',lat:25.0480,lng:-77.3554},
  {name:'Bahrain',flag:'🇧🇭',cap:'Manama',lat:26.2154,lng:50.5832},
  {name:'Bangladesh',flag:'🇧🇩',cap:'Dhaka',lat:23.7106,lng:90.4074},
  {name:'Belarus',flag:'🇧🇾',cap:'Minsk',lat:53.9045,lng:27.5615},
  {name:'Belgium',flag:'🇧🇪',cap:'Brussels',lat:50.8503,lng:4.3517},
  {name:'Belize',flag:'🇧🇿',cap:'Belmopan',lat:17.2514,lng:-88.7590},
  {name:'Benin',flag:'🇧🇯',cap:'Porto-Novo',lat:6.3654,lng:2.4183},
  {name:'Bhutan',flag:'🇧🇹',cap:'Thimphu',lat:27.4728,lng:89.6393},
  {name:'Bolivia',flag:'🇧🇴',cap:'Sucre',lat:-19.0196,lng:-65.2619},
  {name:'Bosnia and Herzegovina',flag:'🇧🇦',cap:'Sarajevo',lat:43.8563,lng:18.4131},
  {name:'Botswana',flag:'🇧🇼',cap:'Gaborone',lat:-24.6282,lng:25.9231},
  {name:'Brazil',flag:'🇧🇷',cap:'Brasilia',lat:-15.7801,lng:-47.9292},
  {name:'Brunei',flag:'🇧🇳',cap:'Bandar Seri Begawan',lat:4.9404,lng:114.9480},
  {name:'Bulgaria',flag:'🇧🇬',cap:'Sofia',lat:42.6977,lng:23.3219},
  {name:'Burkina Faso',flag:'🇧🇫',cap:'Ouagadougou',lat:12.3714,lng:-1.5197},
  {name:'Burundi',flag:'🇧🇮',cap:'Gitega',lat:-3.4271,lng:29.9246},
  {name:'Cambodia',flag:'🇰🇭',cap:'Phnom Penh',lat:11.5564,lng:104.9282},
  {name:'Cameroon',flag:'🇨🇲',cap:'Yaounde',lat:3.8480,lng:11.5021},
  {name:'Canada',flag:'🇨🇦',cap:'Ottawa',lat:45.4215,lng:-75.6919},
  {name:'Cape Verde',flag:'🇨🇻',cap:'Praia',lat:14.9315,lng:-23.5133},
  {name:'Central African Republic',flag:'🇨🇫',cap:'Bangui',lat:4.3612,lng:18.5550},
  {name:'Chad',flag:'🇹🇩',cap:"N'Djamena",lat:12.1348,lng:15.0557},
  {name:'Chile',flag:'🇨🇱',cap:'Santiago',lat:-33.4569,lng:-70.6483},
  {name:'China',flag:'🇨🇳',cap:'Beijing',lat:39.9042,lng:116.4074},
  {name:'Colombia',flag:'🇨🇴',cap:'Bogota',lat:4.7110,lng:-74.0721},
  {name:'Comoros',flag:'🇰🇲',cap:'Moroni',lat:-11.7022,lng:43.2551},
  {name:'Congo',flag:'🇨🇬',cap:'Brazzaville',lat:-4.2634,lng:15.2429},
  {name:'Costa Rica',flag:'🇨🇷',cap:'San Jose',lat:9.9281,lng:-84.0907},
  {name:'Croatia',flag:'🇭🇷',cap:'Zagreb',lat:45.8150,lng:15.9819},
  {name:'Cuba',flag:'🇨🇺',cap:'Havana',lat:23.1136,lng:-82.3666},
  {name:'Cyprus',flag:'🇨🇾',cap:'Nicosia',lat:35.1856,lng:33.3823},
  {name:'Czech Republic',flag:'🇨🇿',cap:'Prague',lat:50.0755,lng:14.4378},
  {name:'DR Congo',flag:'🇨🇩',cap:'Kinshasa',lat:-4.3217,lng:15.3220},
  {name:'Denmark',flag:'🇩🇰',cap:'Copenhagen',lat:55.6761,lng:12.5683},
  {name:'Djibouti',flag:'🇩🇯',cap:'Djibouti',lat:11.5886,lng:43.1450},
  {name:'Dominican Republic',flag:'🇩🇴',cap:'Santo Domingo',lat:18.4861,lng:-69.9312},
  {name:'Ecuador',flag:'🇪🇨',cap:'Quito',lat:-0.2295,lng:-78.5243},
  {name:'Egypt',flag:'🇪🇬',cap:'Cairo',lat:30.0444,lng:31.2357},
  {name:'El Salvador',flag:'🇸🇻',cap:'San Salvador',lat:13.6929,lng:-89.2182},
  {name:'Equatorial Guinea',flag:'🇬🇶',cap:'Malabo',lat:3.7500,lng:8.7833},
  {name:'Eritrea',flag:'🇪🇷',cap:'Asmara',lat:15.3389,lng:38.9318},
  {name:'Estonia',flag:'🇪🇪',cap:'Tallinn',lat:59.4370,lng:24.7536},
  {name:'Eswatini',flag:'🇸🇿',cap:'Mbabane',lat:-26.3054,lng:31.1367},
  {name:'Ethiopia',flag:'🇪🇹',cap:'Addis Ababa',lat:9.0320,lng:38.7469},
  {name:'Fiji',flag:'🇫🇯',cap:'Suva',lat:-18.1416,lng:178.4419},
  {name:'Finland',flag:'🇫🇮',cap:'Helsinki',lat:60.1699,lng:24.9384},
  {name:'France',flag:'🇫🇷',cap:'Paris',lat:48.8566,lng:2.3522},
  {name:'Gabon',flag:'🇬🇦',cap:'Libreville',lat:0.3901,lng:9.4544},
  {name:'Gambia',flag:'🇬🇲',cap:'Banjul',lat:13.4549,lng:-16.5790},
  {name:'Georgia',flag:'🇬🇪',cap:'Tbilisi',lat:41.6941,lng:44.8337},
  {name:'Germany',flag:'🇩🇪',cap:'Berlin',lat:52.5200,lng:13.4050},
  {name:'Ghana',flag:'🇬🇭',cap:'Accra',lat:5.6037,lng:-0.1870},
  {name:'Greece',flag:'🇬🇷',cap:'Athens',lat:37.9838,lng:23.7275},
  {name:'Guatemala',flag:'🇬🇹',cap:'Guatemala City',lat:14.6349,lng:-90.5069},
  {name:'Guinea',flag:'🇬🇳',cap:'Conakry',lat:9.6412,lng:-13.5784},
  {name:'Guinea-Bissau',flag:'🇬🇼',cap:'Bissau',lat:11.8636,lng:-15.5977},
  {name:'Guyana',flag:'🇬🇾',cap:'Georgetown',lat:6.8013,lng:-58.1551},
  {name:'Haiti',flag:'🇭🇹',cap:'Port-au-Prince',lat:18.5944,lng:-72.3074},
  {name:'Honduras',flag:'🇭🇳',cap:'Tegucigalpa',lat:14.0818,lng:-87.2068},
  {name:'Hungary',flag:'🇭🇺',cap:'Budapest',lat:47.4979,lng:19.0402},
  {name:'Iceland',flag:'🇮🇸',cap:'Reykjavik',lat:64.1355,lng:-21.8954},
  {name:'India',flag:'🇮🇳',cap:'New Delhi',lat:28.6139,lng:77.2090},
  {name:'Indonesia',flag:'🇮🇩',cap:'Jakarta',lat:-6.2088,lng:106.8456},
  {name:'Iran',flag:'🇮🇷',cap:'Tehran',lat:35.6892,lng:51.3890},
  {name:'Iraq',flag:'🇮🇶',cap:'Baghdad',lat:33.3152,lng:44.3661},
  {name:'Ireland',flag:'🇮🇪',cap:'Dublin',lat:53.3498,lng:-6.2603},
  {name:'Israel',flag:'🇮🇱',cap:'Jerusalem',lat:31.7683,lng:35.2137},
  {name:'Italy',flag:'🇮🇹',cap:'Rome',lat:41.9028,lng:12.4964},
  {name:'Jamaica',flag:'🇯🇲',cap:'Kingston',lat:17.9970,lng:-76.7936},
  {name:'Japan',flag:'🇯🇵',cap:'Tokyo',lat:35.6762,lng:139.6503},
  {name:'Jordan',flag:'🇯🇴',cap:'Amman',lat:31.9454,lng:35.9284},
  {name:'Kazakhstan',flag:'🇰🇿',cap:'Astana',lat:51.1801,lng:71.4460},
  {name:'Kenya',flag:'🇰🇪',cap:'Nairobi',lat:-1.2921,lng:36.8219},
  {name:'Kosovo',flag:'🇽🇰',cap:'Pristina',lat:42.6629,lng:21.1655},
  {name:'Kuwait',flag:'🇰🇼',cap:'Kuwait City',lat:29.3759,lng:47.9774},
  {name:'Kyrgyzstan',flag:'🇰🇬',cap:'Bishkek',lat:42.8746,lng:74.5698},
  {name:'Laos',flag:'🇱🇦',cap:'Vientiane',lat:17.9757,lng:102.6331},
  {name:'Latvia',flag:'🇱🇻',cap:'Riga',lat:56.9460,lng:24.1059},
  {name:'Lebanon',flag:'🇱🇧',cap:'Beirut',lat:33.8938,lng:35.5018},
  {name:'Lesotho',flag:'🇱🇸',cap:'Maseru',lat:-29.3151,lng:27.4869},
  {name:'Liberia',flag:'🇱🇷',cap:'Monrovia',lat:6.2907,lng:-10.7605},
  {name:'Libya',flag:'🇱🇾',cap:'Tripoli',lat:32.9020,lng:13.1800},
  {name:'Liechtenstein',flag:'🇱🇮',cap:'Vaduz',lat:47.1415,lng:9.5215},
  {name:'Lithuania',flag:'🇱🇹',cap:'Vilnius',lat:54.6872,lng:25.2797},
  {name:'Luxembourg',flag:'🇱🇺',cap:'Luxembourg City',lat:49.6117,lng:6.1319},
  {name:'Madagascar',flag:'🇲🇬',cap:'Antananarivo',lat:-18.9137,lng:47.5361},
  {name:'Malawi',flag:'🇲🇼',cap:'Lilongwe',lat:-13.9626,lng:33.7741},
  {name:'Malaysia',flag:'🇲🇾',cap:'Kuala Lumpur',lat:3.1478,lng:101.6953},
  {name:'Maldives',flag:'🇲🇻',cap:'Male',lat:4.1755,lng:73.5093},
  {name:'Mali',flag:'🇲🇱',cap:'Bamako',lat:12.6392,lng:-8.0029},
  {name:'Malta',flag:'🇲🇹',cap:'Valletta',lat:35.8997,lng:14.5147},
  {name:'Mauritania',flag:'🇲🇷',cap:'Nouakchott',lat:18.0735,lng:-15.9582},
  {name:'Mauritius',flag:'🇲🇺',cap:'Port Louis',lat:-20.1609,lng:57.4977},
  {name:'Mexico',flag:'🇲🇽',cap:'Mexico City',lat:19.4326,lng:-99.1332},
  {name:'Moldova',flag:'🇲🇩',cap:'Chisinau',lat:47.0105,lng:28.8638},
  {name:'Monaco',flag:'🇲🇨',cap:'Monaco',lat:43.7333,lng:7.4167},
  {name:'Mongolia',flag:'🇲🇳',cap:'Ulaanbaatar',lat:47.8864,lng:106.9057},
  {name:'Montenegro',flag:'🇲🇪',cap:'Podgorica',lat:42.4304,lng:19.2594},
  {name:'Morocco',flag:'🇲🇦',cap:'Rabat',lat:34.0209,lng:-6.8416},
  {name:'Mozambique',flag:'🇲🇿',cap:'Maputo',lat:-25.9692,lng:32.5732},
  {name:'Myanmar',flag:'🇲🇲',cap:'Naypyidaw',lat:19.7633,lng:96.0785},
  {name:'Namibia',flag:'🇳🇦',cap:'Windhoek',lat:-22.5597,lng:17.0832},
  {name:'Nepal',flag:'🇳🇵',cap:'Kathmandu',lat:27.7172,lng:85.3240},
  {name:'Netherlands',flag:'🇳🇱',cap:'Amsterdam',lat:52.3676,lng:4.9041},
  {name:'New Zealand',flag:'🇳🇿',cap:'Wellington',lat:-41.2866,lng:174.7756},
  {name:'Nicaragua',flag:'🇳🇮',cap:'Managua',lat:12.1328,lng:-86.2504},
  {name:'Niger',flag:'🇳🇪',cap:'Niamey',lat:13.5137,lng:2.1098},
  {name:'Nigeria',flag:'🇳🇬',cap:'Abuja',lat:9.0765,lng:7.3986},
  {name:'North Korea',flag:'🇰🇵',cap:'Pyongyang',lat:39.0194,lng:125.7381},
  {name:'North Macedonia',flag:'🇲🇰',cap:'Skopje',lat:41.9973,lng:21.4280},
  {name:'Norway',flag:'🇳🇴',cap:'Oslo',lat:59.9139,lng:10.7522},
  {name:'Oman',flag:'🇴🇲',cap:'Muscat',lat:23.5880,lng:58.3829},
  {name:'Pakistan',flag:'🇵🇰',cap:'Islamabad',lat:33.7294,lng:73.0931},
  {name:'Palestine',flag:'🇵🇸',cap:'Ramallah',lat:31.9522,lng:35.2332},
  {name:'Panama',flag:'🇵🇦',cap:'Panama City',lat:8.9936,lng:-79.5197},
  {name:'Papua New Guinea',flag:'🇵🇬',cap:'Port Moresby',lat:-9.4438,lng:147.1803},
  {name:'Paraguay',flag:'🇵🇾',cap:'Asuncion',lat:-25.2867,lng:-57.6470},
  {name:'Peru',flag:'🇵🇪',cap:'Lima',lat:-12.0464,lng:-77.0428},
  {name:'Philippines',flag:'🇵🇭',cap:'Manila',lat:14.5995,lng:120.9842},
  {name:'Poland',flag:'🇵🇱',cap:'Warsaw',lat:52.2297,lng:21.0122},
  {name:'Portugal',flag:'🇵🇹',cap:'Lisbon',lat:38.7223,lng:-9.1393},
  {name:'Qatar',flag:'🇶🇦',cap:'Doha',lat:25.2854,lng:51.5310},
  {name:'Romania',flag:'🇷🇴',cap:'Bucharest',lat:44.4268,lng:26.1025},
  {name:'Russia',flag:'🇷🇺',cap:'Moscow',lat:55.7558,lng:37.6173},
  {name:'Rwanda',flag:'🇷🇼',cap:'Kigali',lat:-1.9706,lng:30.1044},
  {name:'Saudi Arabia',flag:'🇸🇦',cap:'Riyadh',lat:24.6877,lng:46.7219},
  {name:'Senegal',flag:'🇸🇳',cap:'Dakar',lat:14.7167,lng:-17.4677},
  {name:'Serbia',flag:'🇷🇸',cap:'Belgrade',lat:44.8048,lng:20.4781},
  {name:'Sierra Leone',flag:'🇸🇱',cap:'Freetown',lat:8.4657,lng:-13.2317},
  {name:'Singapore',flag:'🇸🇬',cap:'Singapore',lat:1.3521,lng:103.8198},
  {name:'Slovakia',flag:'🇸🇰',cap:'Bratislava',lat:48.1486,lng:17.1077},
  {name:'Slovenia',flag:'🇸🇮',cap:'Ljubljana',lat:46.0511,lng:14.5051},
  {name:'Somalia',flag:'🇸🇴',cap:'Mogadishu',lat:2.0469,lng:45.3182},
  {name:'South Africa',flag:'🇿🇦',cap:'Pretoria',lat:-25.7479,lng:28.2293},
  {name:'South Korea',flag:'🇰🇷',cap:'Seoul',lat:37.5665,lng:126.9780},
  {name:'South Sudan',flag:'🇸🇸',cap:'Juba',lat:4.8594,lng:31.5713},
  {name:'Spain',flag:'🇪🇸',cap:'Madrid',lat:40.4168,lng:-3.7038},
  {name:'Sri Lanka',flag:'🇱🇰',cap:'Sri Jayawardenepura Kotte',lat:6.9271,lng:79.8612},
  {name:'Sudan',flag:'🇸🇩',cap:'Khartoum',lat:15.5007,lng:32.5599},
  {name:'Suriname',flag:'🇸🇷',cap:'Paramaribo',lat:5.8520,lng:-55.2038},
  {name:'Sweden',flag:'🇸🇪',cap:'Stockholm',lat:59.3293,lng:18.0686},
  {name:'Switzerland',flag:'🇨🇭',cap:'Bern',lat:46.9480,lng:7.4474},
  {name:'Syria',flag:'🇸🇾',cap:'Damascus',lat:33.5138,lng:36.2765},
  {name:'Taiwan',flag:'🇹🇼',cap:'Taipei',lat:25.0330,lng:121.5654},
  {name:'Tajikistan',flag:'🇹🇯',cap:'Dushanbe',lat:38.5598,lng:68.7870},
  {name:'Tanzania',flag:'🇹🇿',cap:'Dodoma',lat:-6.1731,lng:35.7395},
  {name:'Thailand',flag:'🇹🇭',cap:'Bangkok',lat:13.7563,lng:100.5018},
  {name:'Timor-Leste',flag:'🇹🇱',cap:'Dili',lat:-8.5569,lng:125.5789},
  {name:'Togo',flag:'🇹🇬',cap:'Lome',lat:6.1375,lng:1.2123},
  {name:'Trinidad and Tobago',flag:'🇹🇹',cap:'Port of Spain',lat:10.6572,lng:-61.5185},
  {name:'Tunisia',flag:'🇹🇳',cap:'Tunis',lat:36.8190,lng:10.1658},
  {name:'Turkey',flag:'🇹🇷',cap:'Ankara',lat:39.9334,lng:32.8597},
  {name:'Turkmenistan',flag:'🇹🇲',cap:'Ashgabat',lat:37.9601,lng:58.3261},
  {name:'Uganda',flag:'🇺🇬',cap:'Kampala',lat:0.3476,lng:32.5825},
  {name:'Ukraine',flag:'🇺🇦',cap:'Kyiv',lat:50.4501,lng:30.5234},
  {name:'United Arab Emirates',flag:'🇦🇪',cap:'Abu Dhabi',lat:24.4539,lng:54.3773},
  {name:'United Kingdom',flag:'🇬🇧',cap:'London',lat:51.5074,lng:-0.1278},
  {name:'United States',flag:'🇺🇸',cap:'Washington D.C.',lat:38.8951,lng:-77.0369},
  {name:'Uruguay',flag:'🇺🇾',cap:'Montevideo',lat:-34.9011,lng:-56.1645},
  {name:'Uzbekistan',flag:'🇺🇿',cap:'Tashkent',lat:41.2995,lng:69.2401},
  {name:'Venezuela',flag:'🇻🇪',cap:'Caracas',lat:10.4806,lng:-66.9036},
  {name:'Vietnam',flag:'🇻🇳',cap:'Hanoi',lat:21.0285,lng:105.8542},
  {name:'Yemen',flag:'🇾🇪',cap:'Sanaa',lat:15.3694,lng:44.1910},
  {name:'Zambia',flag:'🇿🇲',cap:'Lusaka',lat:-15.4167,lng:28.2833},
  {name:'Zimbabwe',flag:'🇿🇼',cap:'Harare',lat:-17.8292,lng:31.0522}
];


/* ── Country search UI ───────────────────────────────────── */

function initCountrySearch() {
  const input  = document.getElementById('country-search');
  const results = document.getElementById('search-results');
  let isSelecting = false; // prevents blur firing before mousedown completes

  /** Filter COUNTRIES and render the dropdown. */
  function doSearch(q) {
    if (!q.trim()) { results.classList.remove('open'); results.innerHTML = ''; return; }

    const matches = COUNTRIES
      .filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.cap.toLowerCase().includes(q.toLowerCase())
      )
      .slice(0, 8);

    results.innerHTML = matches.length
      ? matches.map((c, i) => `
          <div class="sr-item" data-idx="${i}"
            data-lat="${c.lat}" data-lng="${c.lng}"
            data-name="${c.name.replace(/"/g, '&quot;')}">
            <span class="sr-flag">${c.flag}</span>
            <div>
              <div class="sr-name">${c.name}</div>
              <div class="sr-cap">${c.cap}</div>
            </div>
          </div>`).join('')
      : `<div class="sr-none">No results for "${q}"</div>`;

    results.classList.add('open');
  }

  // Use mousedown (fires before blur) to prevent the dropdown closing
  // before the click registers on the item
  results.addEventListener('mousedown', e => {
    isSelecting = true;
    const item = e.target.closest('.sr-item');
    if (!item) return;
    e.preventDefault();
    const lat  = parseFloat(item.dataset.lat);
    const lng  = parseFloat(item.dataset.lng);
    const name = item.dataset.name;
    results.classList.remove('open');
    input.value  = '';
    input.blur();
    isSelecting  = false;
    flyToCountry(lat, lng, name);
  });

  input.addEventListener('input',  e => doSearch(e.target.value));
  input.addEventListener('focus',  e => { if (e.target.value.trim()) doSearch(e.target.value); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { results.classList.remove('open'); input.blur(); }
    if (e.key === 'Enter') {
      const first = results.querySelector('.sr-item');
      if (first) {
        const lat  = parseFloat(first.dataset.lat);
        const lng  = parseFloat(first.dataset.lng);
        const name = first.dataset.name;
        results.classList.remove('open');
        input.value = '';
        input.blur();
        flyToCountry(lat, lng, name);
      }
    }
  });

  // Delayed blur to let mousedown finish first
  input.addEventListener('blur', () => {
    if (!isSelecting) setTimeout(() => results.classList.remove('open'), 200);
  });

  // Close dropdown when clicking anywhere outside the search widget
  document.addEventListener('click', e => {
    if (!document.getElementById('search-wrap').contains(e.target))
      results.classList.remove('open');
  });
}


/* ── Country border highlight ────────────────────────────── */

let countryLayer     = null; // current GeoJSON border layer
let countryFadeTimer = null; // setInterval handle for the fade-out animation

/**
 * Fly the map to a country and draw a fading border highlight.
 * The border fades out automatically after 4 s.
 */
async function flyToCountry(lat, lng, name) {
  map.flyTo([lat, lng], 5, { animate: true, duration: 1.0 });

  // Clear any existing border
  if (countryFadeTimer) { clearInterval(countryFadeTimer); countryFadeTimer = null; }
  if (countryLayer)     { map.removeLayer(countryLayer);   countryLayer = null; }

  try {
    const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=3&polygon_geojson=1&addressdetails=1&namedetails=1&accept-language=en`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en-GB,en;q=0.9' } });
    const data = await res.json();

    // Prefer a country/boundary result; fall back to the first hit
    const match = data.find(d =>
      d.addresstype === 'country' ||
      d.type        === 'administrative' ||
      d.class       === 'boundary'
    ) || data[0];

    if (!match || !match.geojson) return;

    if (countryLayer) { map.removeLayer(countryLayer); countryLayer = null; }

    const highlightColor = isDark ? '#e8ff47' : '#5c6bc0';
    countryLayer = L.geoJSON(match.geojson, {
      style: {
        color:       highlightColor,
        weight:      2.5,
        opacity:     1,
        fillColor:   highlightColor,
        fillOpacity: 0.12,
        interactive: false
      }
    }).addTo(map);

    // Fit map to the country bounds
    const bounds = countryLayer.getBounds();
    if (bounds.isValid())
      setTimeout(() => map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 7, duration: 1.2 }), 600);

    // Start fading the border after 4 s
    setTimeout(() => {
      if (!countryLayer) return;
      let opacity = 1.0, fillOpacity = 0.1;
      countryFadeTimer = setInterval(() => {
        opacity     -= 0.08;
        fillOpacity -= 0.008;
        if (opacity <= 0) {
          clearInterval(countryFadeTimer);
          countryFadeTimer = null;
          if (countryLayer) { map.removeLayer(countryLayer); countryLayer = null; }
          return;
        }
        if (countryLayer) countryLayer.setStyle({ opacity, fillOpacity });
      }, 50);
    }, 4000);

  } catch (e) {
    // Silently ignore network errors for the decorative border
  }
}
