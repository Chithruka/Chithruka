/* ==========================================================================
   KODEX Built-In Instant-Read Showcase (Works 100% Offline & Online)
   ========================================================================== */

(function (global) {
  const Kodex = (global.Kodex = global.Kodex || {});

  function svgToDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  }

  function makeMangaPage(pageNum, title, sceneTitle, dialogueA, dialogueB, accent = '#fb7185') {
    return svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1160" viewBox="0 0 800 1160">
        <defs>
          <pattern id="tone" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#27272a" />
          </pattern>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#111827"/>
            <stop offset="100%" stop-color="#3f3f46"/>
          </linearGradient>
        </defs>
        <rect width="800" height="1160" fill="#fafafa"/>
        <rect x="28" y="28" width="744" height="1104" fill="#ffffff" stroke="#09090b" stroke-width="6"/>

        <!-- Top Panel -->
        <rect x="48" y="48" width="704" height="330" fill="url(#sky)" stroke="#09090b" stroke-width="5"/>
        <path d="M48 310 L210 210 L350 280 L540 160 L752 290 L752 378 L48 378 Z" fill="#09090b"/>
        <circle cx="620" cy="125" r="46" fill="${accent}" opacity="0.9"/>
        <text x="68" y="92" font-family="sans-serif" font-size="22" font-weight="800" fill="#f4f4f5" letter-spacing="2">${title} — P.${pageNum}</text>
        <text x="68" y="122" font-family="monospace" font-size="16" fill="#d4d4d8">${sceneTitle}</text>

        <!-- Speech Bubble 1 -->
        <ellipse cx="260" cy="215" rx="180" ry="58" fill="#ffffff" stroke="#09090b" stroke-width="4"/>
        <text x="260" y="210" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#09090b">${dialogueA}</text>
        <text x="260" y="236" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#52525b">[Chapter 01 · Page ${pageNum}]</text>

        <!-- Middle Split Panels (RTL order) -->
        <rect x="48" y="400" width="335" height="340" fill="url(#tone)" stroke="#09090b" stroke-width="5"/>
        <line x1="70" y1="430" x2="360" y2="710" stroke="#09090b" stroke-width="3" opacity="0.35"/>
        <line x1="360" y1="430" x2="70" y2="710" stroke="#09090b" stroke-width="3" opacity="0.35"/>
        <text x="215" y="565" text-anchor="middle" font-family="sans-serif" font-size="44" font-weight="900" fill="#09090b" transform="rotate(-12 215 565)">SLASH!!</text>

        <rect x="405" y="400" width="347" height="340" fill="#18181b" stroke="#09090b" stroke-width="5"/>
        <circle cx="578" cy="545" r="76" fill="#fafafa"/>
        <circle cx="554" cy="535" r="10" fill="#09090b"/>
        <circle cx="602" cy="535" r="10" fill="#09090b"/>
        <path d="M548 585 Q578 565 608 585" stroke="#09090b" stroke-width="5" fill="none"/>
        <rect x="435" y="655" width="286" height="62" rx="28" fill="#ffffff" stroke="#09090b" stroke-width="4"/>
        <text x="578" y="693" text-anchor="middle" font-family="sans-serif" font-size="19" font-weight="700" fill="#09090b">${dialogueB}</text>

        <!-- Bottom Action Panel -->
        <rect x="48" y="762" width="704" height="348" fill="#09090b" stroke="#09090b" stroke-width="5"/>
        <path d="M48 940 L752 840" stroke="${accent}" stroke-width="8"/>
        <path d="M48 975 L752 890" stroke="#ffffff" stroke-width="3" opacity="0.7"/>
        <text x="400" y="1040" text-anchor="middle" font-family="monospace" font-size="18" fill="#a1a1aa">KODEX MANGA ENGINE · TRY RTL / LTR / SPREAD / WEBTOON</text>
      </svg>
    `);
  }

  function makeComicPage(pageNum, title, caption, heroLine, bgTop = '#0284c7', bgBottom = '#1e1b4b') {
    return svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1160" viewBox="0 0 800 1160">
        <defs>
          <linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${bgTop}"/>
            <stop offset="100%" stop-color="${bgBottom}"/>
          </linearGradient>
        </defs>
        <rect width="800" height="1160" fill="#fef3c7"/>
        <rect x="24" y="24" width="752" height="1112" fill="#fffbeb" stroke="#111827" stroke-width="7"/>

        <!-- Comic Header Masthead -->
        <rect x="44" y="44" width="712" height="90" fill="#facc15" stroke="#111827" stroke-width="5"/>
        <text x="64" y="102" font-family="sans-serif" font-size="38" font-weight="900" fill="#111827">${title}</text>
        <text x="734" y="100" text-anchor="end" font-family="monospace" font-size="22" font-weight="700" fill="#111827">PG ${pageNum}</text>

        <!-- Splash Panel -->
        <rect x="44" y="152" width="712" height="510" fill="url(#cbg)" stroke="#111827" stroke-width="5"/>
        <circle cx="400" cy="390" r="145" fill="#fde047" opacity="0.22"/>
        <polygon points="400,250 435,355 545,355 455,420 490,525 400,460 310,525 345,420 255,355 365,355" fill="#facc15" stroke="#111827" stroke-width="5"/>
        <rect x="64" y="172" width="380" height="56" fill="#fef08a" stroke="#111827" stroke-width="4"/>
        <text x="80" y="207" font-family="sans-serif" font-size="19" font-weight="700" fill="#111827">${caption}</text>

        <!-- Lower Two Panels -->
        <rect x="44" y="684" width="346" height="432" fill="#e0f2fe" stroke="#111827" stroke-width="5"/>
        <ellipse cx="217" cy="790" rx="145" ry="62" fill="#ffffff" stroke="#111827" stroke-width="4"/>
        <text x="217" y="796" text-anchor="middle" font-family="sans-serif" font-size="19" font-weight="700" fill="#111827">${heroLine}</text>
        <text x="217" y="960" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="900" fill="#ef4444">KRAAK!</text>

        <rect x="410" y="684" width="346" height="432" fill="#312e81" stroke="#111827" stroke-width="5"/>
        <circle cx="583" cy="870" r="90" fill="#38bdf8" stroke="#111827" stroke-width="5"/>
        <text x="583" y="880" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" fill="#0f172a">SECTOR ${pageNum}</text>
        <text x="583" y="1065" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#cbd5e1">TO BE CONTINUED...</text>
      </svg>
    `);
  }

  function makeBookCover(title, author, bgA, bgB) {
    return svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
        <defs>
          <linearGradient id="bk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${bgA}"/>
            <stop offset="100%" stop-color="${bgB}"/>
          </linearGradient>
        </defs>
        <rect width="400" height="600" fill="url(#bk)"/>
        <rect x="24" y="24" width="352" height="552" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>
        <text x="200" y="110" text-anchor="middle" font-family="monospace" font-size="14" fill="rgba(255,255,255,0.72)" letter-spacing="3">KODEX EDITION</text>
        <text x="200" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="32" font-weight="bold" fill="#ffffff">${title}</text>
        <line x1="120" y1="310" x2="280" y2="310" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <text x="200" y="360" text-anchor="middle" font-family="sans-serif" font-size="18" fill="rgba(255,255,255,0.86)">${author}</text>
      </svg>
    `);
  }

  const SAMPLE_CATALOG = [
    {
      id: 'sample-frankenstein',
      title: 'Frankenstein; Or, The Modern Prometheus',
      author: 'Mary Wollstonecraft Shelley',
      mediaType: 'books',
      source: 'Kodex Classics',
      year: '1818',
      format: 'EPUB / TEXT',
      tags: ['Gothic', 'Sci-Fi', 'Classic', 'Public Domain'],
      description:
        'Mary Shelley’s landmark gothic novel exploring ambition, creation, and isolation as Victor Frankenstein brings a sentient being to life.',
      cover: makeBookCover('FRANKENSTEIN', 'Mary Shelley', '#1e293b', '#7c2d12'),
      chapters: [
        {
          title: 'Letter I — St. Petersburgh',
          html: `<h2>Letter I</h2>
            <p><em>To Mrs. Saville, England.</em></p>
            <p>St. Petersburgh, Dec. 11th, 17—.</p>
            <p>You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.</p>
            <p>I am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight. Do you understand this feeling? This breeze, which has travelled from the regions towards which I am advancing, gives me a foretaste of those icy climes.</p>
            <p>Inspirited by this wind of promise, my daydreams become more fervent and vivid. I try in vain to be persuaded that the pole is the seat of frost and desolation; it ever presents itself to my imagination as the region of beauty and delight.</p>`
        },
        {
          title: 'Chapter IV — The Spark of Being',
          html: `<h2>Chapter IV</h2>
            <p>From this day natural philosophy, and particularly chemistry, in the most comprehensive sense of the term, became nearly my sole occupation. I read with ardour those works, so full of genius and discrimination, which modern inquirers have written on these subjects.</p>
            <p>I attended the lectures and cultivated the acquaintance of the men of science of the university, and I found even in M. Krempe a great deal of sound sense and real information, combined, it is true, with a repulsive physiognomy and manners, but not on that account the less valuable.</p>
            <p>In M. Waldman I found a true friend. His gentleness was never tinged by dogmatism, and his instructions were given with an air of frankness and good nature that banished every idea of pedantry. It was, perhaps, the amiable character of this man that inclined me more to that branch of natural philosophy which he professed, than an intrinsic love for the science itself.</p>`
        },
        {
          title: 'Chapter V — It Was on a Dreary Night of November',
          html: `<h2>Chapter V</h2>
            <p>It was on a dreary night of November that I beheld the accomplishment of my toils. With an anxiety that almost amounted to agony, I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet.</p>
            <p>It was already one in the morning; the rain pattered dismally against the panes, and my candle was nearly burnt out, when, by the glimmer of the half-extinguished light, I saw the dull yellow eye of the creature open; it breathed hard, and a convulsive motion agitated its limbs.</p>
            <p>How can I describe my emotions at this catastrophe, or how delineate the wretch whom with such infinite pains and care I had endeavoured to form? His limbs were in proportion, and I had selected his features as beautiful. Beautiful! Great God! His yellow skin scarcely covered the work of muscles and arteries beneath; his hair was of a lustrous black, and flowing; his teeth of a pearly whiteness; but these luxuriances only formed a more horrid contrast with his watery eyes, that seemed almost of the same colour as the dun-white sockets in which they were set, his shrivelled complexion and straight black lips.</p>`
        }
      ]
    },
    {
      id: 'sample-poe-poetry',
      title: 'The Raven & Other Poems',
      author: 'Edgar Allan Poe',
      mediaType: 'poetry',
      source: 'Kodex Poetry',
      year: '1845',
      format: 'POETRY',
      tags: ['Poetry', 'Gothic', 'Classic'],
      description:
        'A curated poetry anthology featuring Edgar Allan Poe’s atmospheric masterworks, formatted with verse spacing and voice narration support.',
      cover: makeBookCover('THE RAVEN', 'Edgar Allan Poe', '#18181b', '#4c1d95'),
      chapters: [
        {
          title: 'The Raven',
          html: `<h2>The Raven</h2>
            <div class="poem-stanza">Once upon a midnight dreary, while I pondered, weak and weary,
Over many a quaint and curious volume of forgotten lore—
While I nodded, nearly napping, suddenly there came a tapping,
As of some one gently rapping, rapping at my chamber door.
"'Tis some visitor," I muttered, "tapping at my chamber door—
            Only this and nothing more."</div>
            <div class="poem-stanza">Ah, distinctly I remember it was in the bleak December;
And each separate dying ember wrought its ghost upon the floor.
Eagerly I wished the morrow;—vainly I had sought to borrow
From my books surcease of sorrow—sorrow for the lost Lenore—
For the rare and radiant maiden whom the angels name Lenore—
            Nameless here for evermore.</div>
            <div class="poem-stanza">Open here I flung the shutter, when, with many a flirt and flutter,
In there stepped a stately Raven of the saintly days of yore;
Not the least obeisance made he; not a minute stopped or stayed he;
But, with mien of lord or lady, perched above my chamber door—
Perched upon a bust of Pallas just above my chamber door—
            Perched, and sat, and nothing more.</div>`
        },
        {
          title: 'Eldorado',
          html: `<h2>Eldorado</h2>
            <div class="poem-stanza">Gaily bedight,
A gallant knight,
In sunshine and in shadow,
Had journeyed long,
Singing a song,
In search of Eldorado.</div>
            <div class="poem-stanza">But he grew old—
This knight so bold—
And o'er his heart a shadow
Fell as he found
No spot of ground
That looked like Eldorado.</div>`
        }
      ]
    },
    {
      id: 'sample-neon-blade',
      title: 'Neon Blade: Zero Hour',
      author: 'Studio Kodex',
      mediaType: 'manga',
      source: 'Kodex Original',
      year: '2026',
      format: 'MANGA',
      score: '9.2',
      tags: ['Action', 'Cyberpunk', 'Shounen', 'RTL / Webtoon'],
      description:
        'An interactive multi-page manga demo designed to showcase Right-to-Left reading, Double-Page Spreads, Single-Page flipping, and Webtoon Long-Strip scrolling.',
      cover: makeMangaPage(1, 'NEON BLADE', 'SECTOR 09 ROOFTOP', 'The signal is live!', 'Draw your blade!'),
      visualChapters: [
        {
          id: 'nb-ch1',
          title: 'Chapter 1 — Iron Eclipse',
          pages: [
            makeMangaPage(1, 'NEON BLADE', 'SECTOR 09 ROOFTOP', 'The rain never stops here.', 'Target locked above!'),
            makeMangaPage(2, 'NEON BLADE', 'OLD RAIL BRIDGE', 'Two seconds to impact.', 'Switch to Spread mode!'),
            makeMangaPage(3, 'NEON BLADE', 'CORE REACTOR', 'Can you hear the resonance?', 'Hold the line!'),
            makeMangaPage(4, 'NEON BLADE', 'DAWN HORIZON', 'The seal is broken...', 'To Chapter 2 →')
          ]
        },
        {
          id: 'nb-ch2',
          title: 'Chapter 2 — Crimson Circuit',
          pages: [
            makeMangaPage(1, 'NEON BLADE CH.2', 'UNDERGROUND', 'We made it past the gate.', 'Watch the shadows!', '#38bdf8'),
            makeMangaPage(2, 'NEON BLADE CH.2', 'CITADEL HALL', 'No turning back now.', 'Overdrive engaged!', '#38bdf8')
          ]
        }
      ]
    },
    {
      id: 'sample-solaris-patrol',
      title: 'Solaris Patrol #1',
      author: 'Golden Age Showcase',
      mediaType: 'comics',
      source: 'Kodex Comics',
      year: '1954',
      format: 'CBZ / COMIC',
      score: '8.8',
      tags: ['Sci-Fi', 'Retro Comic', 'LTR', 'Full Color'],
      description:
        'A retro-styled full-color comic book issue demonstrating Left-to-Right comic spreads, Fit-Height/Width scaling, and brightness controls.',
      cover: makeComicPage(1, 'SOLARIS PATROL #1', 'BEYOND THE ASTEROID BELT!', 'BRACE FOR WARP!'),
      visualChapters: [
        {
          id: 'sp-1',
          title: 'Issue #1 — The Rings of Titan',
          pages: [
            makeComicPage(1, 'SOLARIS PATROL #1', 'OUTPOST TITAN CALLING!', 'IGNITE THE THRUSTERS!', '#0284c7', '#1e1b4b'),
            makeComicPage(2, 'SOLARIS PATROL #1', 'METEOR STORM INBOUND!', 'SHIELDS AT MAXIMUM!', '#dc2626', '#450a0a'),
            makeComicPage(3, 'SOLARIS PATROL #1', 'THE CITADEL OF LIGHT!', 'WE FOUND THE BEACON!', '#059669', '#064e3b'),
            makeComicPage(4, 'SOLARIS PATROL #1', 'MISSION ACCOMPLISHED!', 'SEE YOU NEXT ISSUE!', '#7c3aed', '#1e1b4b')
          ]
        }
      ]
    }
  ];

  Kodex.SampleData = {
    SAMPLE_CATALOG,
    makeBookCover
  };
})(window);
