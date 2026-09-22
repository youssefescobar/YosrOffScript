/* ===================================================
   PORTFOLIO DATA
   Swap cover / poster / src with your own assets later.
   brand is optional — omit or set null to hide.
   =================================================== */

export const CATEGORIES = [
  {
    id: 'branding',
    label: 'Branding',
    cover: 'https://picsum.photos/seed/branding-cover/1200/900',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    cover: 'https://picsum.photos/seed/editorial-cover/1200/900',
  },
  {
    id: 'digital',
    label: 'Digital',
    cover: 'https://picsum.photos/seed/digital-cover/1200/900',
  },
  {
    id: 'motion',
    label: 'Motion',
    cover: 'https://picsum.photos/seed/motion-cover/1200/900',
  },
];

const SAMPLE = {
  bunny: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  elephants: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  blazes: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  escapes: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  fun: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  joyrides: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  meltdowns: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  sintel: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  subaru: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  tears: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
};

export const VIDEOS = [
  // Branding
  {
    id: 1,
    title: 'Luminous Echoes',
    category: 'branding',
    brand: 'Aurora',
    description: 'A brand film exploring light, texture, and identity across a new visual system.',
    poster: 'https://picsum.photos/seed/v1/1280/720',
    src: SAMPLE.bunny,
  },
  {
    id: 2,
    title: 'Paper Trail',
    category: 'branding',
    brand: 'Folio',
    description: 'Quiet stationery motion for a rebrand — restraint, paper grain, and typography.',
    poster: 'https://picsum.photos/seed/v2/1280/720',
    src: SAMPLE.blazes,
  },
  {
    id: 3,
    title: 'Night Signal',
    category: 'branding',
    brand: null,
    description: 'Identity motion study without a named client — pure mark and motion.',
    poster: 'https://picsum.photos/seed/v3/1280/720',
    src: SAMPLE.escapes,
  },
  {
    id: 4,
    title: 'Quiet Tension',
    category: 'branding',
    brand: 'Meridian',
    description: 'Campaign opener built around negative space and slow reveals.',
    poster: 'https://picsum.photos/seed/v4/1280/720',
    src: SAMPLE.fun,
  },

  // Editorial
  {
    id: 5,
    title: 'Neon Bloom',
    category: 'editorial',
    brand: 'Vesper',
    description: 'Editorial sequence for a fashion issue — color, gesture, and tempo.',
    poster: 'https://picsum.photos/seed/v5/1280/720',
    src: SAMPLE.elephants,
  },
  {
    id: 6,
    title: 'Static Hymn',
    category: 'editorial',
    brand: 'Atelier',
    description: 'Portrait-driven short with rhythm edits and grain.',
    poster: 'https://picsum.photos/seed/v6/1280/720',
    src: SAMPLE.joyrides,
  },
  {
    id: 7,
    title: 'Chromatic',
    category: 'editorial',
    description: 'Color-story reel cut for print and digital companion coverage.',
    poster: 'https://picsum.photos/seed/v7/1280/720',
    src: SAMPLE.meltdowns,
  },
  {
    id: 8,
    title: 'Mineral',
    category: 'editorial',
    brand: 'Stone & Co',
    description: 'Still-life motion for a materials feature — tactile, slow, precise.',
    poster: 'https://picsum.photos/seed/v8/1280/720',
    src: SAMPLE.sintel,
  },

  // Digital
  {
    id: 9,
    title: 'Drift',
    category: 'digital',
    brand: 'Orbit',
    description: 'Product launch loop designed for social and landing hero use.',
    poster: 'https://picsum.photos/seed/v9/1280/720',
    src: SAMPLE.subaru,
  },
  {
    id: 10,
    title: 'Glass Architecture',
    category: 'digital',
    brand: 'Nexus',
    description: 'UI motion language — glass, depth, and micro-interactions.',
    poster: 'https://picsum.photos/seed/v10/1280/720',
    src: SAMPLE.tears,
  },
  {
    id: 11,
    title: 'Undercurrent',
    category: 'digital',
    brand: null,
    description: 'Experimental digital piece exploring fluid transitions.',
    poster: 'https://picsum.photos/seed/v11/1280/720',
    src: SAMPLE.bunny,
  },
  {
    id: 12,
    title: 'Parallax',
    category: 'digital',
    brand: 'Layer',
    description: 'Scroll-native motion concept packaged as a standalone reel.',
    poster: 'https://picsum.photos/seed/v12/1280/720',
    src: SAMPLE.blazes,
  },

  // Motion
  {
    id: 13,
    title: 'Soft Machine',
    category: 'motion',
    brand: 'Kinetic',
    description: 'Abstract title sequence with soft forms and hard cuts.',
    poster: 'https://picsum.photos/seed/v13/1280/720',
    src: SAMPLE.escapes,
  },
  {
    id: 14,
    title: 'Meridian',
    category: 'motion',
    brand: 'Horizon',
    description: 'Travel-toned motion piece — horizon lines and paced reveals.',
    poster: 'https://picsum.photos/seed/v14/1280/720',
    src: SAMPLE.fun,
  },
  {
    id: 15,
    title: 'Phantom Thread',
    category: 'motion',
    description: 'Texture-forward motion study without a brand lockup.',
    poster: 'https://picsum.photos/seed/v15/1280/720',
    src: SAMPLE.joyrides,
  },
  {
    id: 16,
    title: 'Afterglow',
    category: 'motion',
    brand: 'Lumen',
    description: 'Closing sequence built on bloom, trail, and afterimage.',
    poster: 'https://picsum.photos/seed/v16/1280/720',
    src: SAMPLE.sintel,
  },
];

export function getVideosByCategory(categoryId) {
  return VIDEOS.filter((v) => v.category === categoryId);
}

export function getCategory(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) || null;
}

export function getVideo(videoId) {
  return VIDEOS.find((v) => v.id === Number(videoId)) || null;
}
