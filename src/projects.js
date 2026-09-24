/* ===================================================
   PORTFOLIO DATA
   Swap cover / poster / src with your own assets later.
   brand is optional — omit or set null to hide.
   =================================================== */

export const CATEGORIES = [
  {
    id: 'fashion',
    label: 'Fashion',
    cover: 'https://picsum.photos/seed/fashion-cover/1200/900',
  },
  {
    id: 'bts',
    label: 'BTS',
    cover: 'https://picsum.photos/seed/bts-cover/1200/900',
  },
  {
    id: 'events',
    label: 'Events',
    cover: 'https://picsum.photos/seed/events-cover/1200/900',
  },
  {
    id: 'fnb',
    label: 'F&B',
    cover: 'https://picsum.photos/seed/fnb-cover/1200/900',
  },
  {
    id: 'film',
    label: 'Film',
    cover: 'https://picsum.photos/seed/film-cover/1200/900',
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
  // Fashion
  {
    id: 1,
    title: 'Luminous Echoes',
    category: 'fashion',
    brand: 'Aurora',
    description: 'A fashion film exploring light, texture, and identity across a new visual system.',
    poster: 'https://picsum.photos/seed/v1/900/1200',
    src: SAMPLE.bunny,
  },
  {
    id: 2,
    title: 'Neon Bloom',
    category: 'fashion',
    brand: 'Vesper',
    description: 'Editorial sequence for a fashion issue — color, gesture, and tempo.',
    poster: 'https://picsum.photos/seed/v5/900/1200',
    src: SAMPLE.elephants,
  },
  {
    id: 3,
    title: 'Quiet Tension',
    category: 'fashion',
    brand: 'Meridian',
    description: 'Campaign opener built around negative space and slow reveals.',
    poster: 'https://picsum.photos/seed/v4/900/1200',
    src: SAMPLE.fun,
  },

  // BTS
  {
    id: 4,
    title: 'Paper Trail',
    category: 'bts',
    brand: 'Folio',
    description: 'Behind-the-scenes process — restraint, paper grain, and craft.',
    poster: 'https://picsum.photos/seed/v2/900/1200',
    src: SAMPLE.blazes,
  },
  {
    id: 5,
    title: 'Static Hymn',
    category: 'bts',
    brand: 'Atelier',
    description: 'Set-side portrait reel with rhythm edits and grain.',
    poster: 'https://picsum.photos/seed/v6/900/1200',
    src: SAMPLE.joyrides,
  },
  {
    id: 6,
    title: 'Phantom Thread',
    category: 'bts',
    description: 'Texture-forward BTS study without a brand lockup.',
    poster: 'https://picsum.photos/seed/v15/900/1200',
    src: SAMPLE.joyrides,
  },

  // Events
  {
    id: 7,
    title: 'Night Signal',
    category: 'events',
    brand: null,
    description: 'Event atmosphere study — mark, motion, and crowd energy.',
    poster: 'https://picsum.photos/seed/v3/900/1200',
    src: SAMPLE.escapes,
  },
  {
    id: 8,
    title: 'Drift',
    category: 'events',
    brand: 'Orbit',
    description: 'Launch-night loop designed for social and venue screens.',
    poster: 'https://picsum.photos/seed/v9/900/1200',
    src: SAMPLE.subaru,
  },
  {
    id: 9,
    title: 'Afterglow',
    category: 'events',
    brand: 'Lumen',
    description: 'Closing sequence built on bloom, trail, and afterimage.',
    poster: 'https://picsum.photos/seed/v16/900/1200',
    src: SAMPLE.sintel,
  },

  // F&B
  {
    id: 10,
    title: 'Mineral',
    category: 'fnb',
    brand: 'Stone & Co',
    description: 'Still-life motion for a materials feature — tactile, slow, precise.',
    poster: 'https://picsum.photos/seed/v8/900/1200',
    src: SAMPLE.sintel,
  },
  {
    id: 11,
    title: 'Chromatic',
    category: 'fnb',
    description: 'Color-story reel cut for menu and campaign companion coverage.',
    poster: 'https://picsum.photos/seed/v7/900/1200',
    src: SAMPLE.meltdowns,
  },
  {
    id: 12,
    title: 'Soft Machine',
    category: 'fnb',
    brand: 'Kinetic',
    description: 'Abstract F&B title sequence with soft forms and hard cuts.',
    poster: 'https://picsum.photos/seed/v13/900/1200',
    src: SAMPLE.escapes,
  },

  // Film
  {
    id: 13,
    title: 'Glass Architecture',
    category: 'film',
    brand: 'Nexus',
    description: 'Cinematic motion language — glass, depth, and micro-beats.',
    poster: 'https://picsum.photos/seed/v10/900/1200',
    src: SAMPLE.tears,
  },
  {
    id: 14,
    title: 'Undercurrent',
    category: 'film',
    brand: null,
    description: 'Experimental short exploring fluid transitions.',
    poster: 'https://picsum.photos/seed/v11/900/1200',
    src: SAMPLE.bunny,
  },
  {
    id: 15,
    title: 'Parallax',
    category: 'film',
    brand: 'Layer',
    description: 'Narrative motion concept packaged as a standalone reel.',
    poster: 'https://picsum.photos/seed/v12/900/1200',
    src: SAMPLE.blazes,
  },
  {
    id: 16,
    title: 'Meridian',
    category: 'film',
    brand: 'Horizon',
    description: 'Travel-toned film piece — horizon lines and paced reveals.',
    poster: 'https://picsum.photos/seed/v14/900/1200',
    src: SAMPLE.fun,
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
