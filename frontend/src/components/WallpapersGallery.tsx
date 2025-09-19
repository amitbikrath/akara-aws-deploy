'use client'

import { useState } from 'react'

// This would normally fetch from the catalog API
const sampleWallpapers = [
  {
    id: 'hanuman-divine-strength',
    title: 'Hanuman - Divine Strength',
    caption: 'Lord Hanuman displaying his infinite strength and devotion',
    deity: 'hanuman',
    style: 'traditional',
    orientation: 'portrait',
    collection: 'Divine Warriors',
    thumbnail: 'https://via.placeholder.com/400x600/FFD700/000000?text=Hanuman',
    tags: ['hanuman', 'strength', 'devotion', 'traditional', 'golden'],
    rating: { average: 4.8, count: 124 },
    downloadCount: 456
  },
  {
    id: 'ganesha-wisdom-light',
    title: 'Ganesha - Wisdom Light',
    caption: 'Lord Ganesha surrounded by divine light and wisdom',
    deity: 'ganesha',
    style: 'modern',
    orientation: 'landscape',
    collection: 'Divine Wisdom',
    thumbnail: 'https://via.placeholder.com/600x400/FF8C42/000000?text=Ganesha',
    tags: ['ganesha', 'wisdom', 'light', 'modern', 'lotus'],
    rating: { average: 4.9, count: 89 },
    downloadCount: 234,
    isPremium: true
  },
  {
    id: 'krishna-divine-love',
    title: 'Krishna - Divine Love',
    caption: 'Lord Krishna playing the flute in a serene meadow',
    deity: 'krishna',
    style: 'traditional',
    orientation: 'square',
    collection: 'Divine Love',
    thumbnail: 'https://via.placeholder.com/400x400/4169E1/000000?text=Krishna',
    tags: ['krishna', 'flute', 'love', 'nature', 'peaceful'],
    rating: { average: 4.7, count: 156 },
    downloadCount: 378
  }
]

export default function WallpapersGallery() {
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedOrientation, setSelectedOrientation] = useState('all')

  const filteredWallpapers = sampleWallpapers.filter(wallpaper => {
    if (selectedFilter !== 'all' && wallpaper.deity !== selectedFilter) return false
    if (selectedOrientation !== 'all' && wallpaper.orientation !== selectedOrientation) return false
    return true
  })

  const deities = ['all', 'hanuman', 'ganesha', 'krishna']
  const orientations = ['all', 'portrait', 'landscape', 'square']

  return (
    <div>
      {/* Filters */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="flex flex-wrap gap-2">
            <span className="text-white/80 font-medium">Deity:</span>
            {deities.map(deity => (
              <button
                key={deity}
                onClick={() => setSelectedFilter(deity)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedFilter === deity
                    ? 'bg-primary-500 text-white'
                    : 'glass text-white hover:bg-white/20'
                }`}
              >
                {deity.charAt(0).toUpperCase() + deity.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <span className="text-white/80 font-medium">Orientation:</span>
            {orientations.map(orientation => (
              <button
                key={orientation}
                onClick={() => setSelectedOrientation(orientation)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedOrientation === orientation
                    ? 'bg-primary-500 text-white'
                    : 'glass text-white hover:bg-white/20'
                }`}
              >
                {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredWallpapers.map(wallpaper => (
          <div
            key={wallpaper.id}
            className="card-glass group cursor-pointer overflow-hidden"
          >
            {/* Image */}
            <div className="relative aspect-[4/5] mb-4 overflow-hidden rounded-xl">
              <img
                src={wallpaper.thumbnail}
                alt={wallpaper.caption}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {wallpaper.isPremium && (
                <div className="absolute top-2 right-2 bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                  Premium
                </div>
              )}
            </div>

            {/* Content */}
            <div className="space-y-3">
              <div>
                <h3 className="text-white font-semibold text-lg line-clamp-1">
                  {wallpaper.title}
                </h3>
                <p className="text-white/70 text-sm line-clamp-2">
                  {wallpaper.caption}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {wallpaper.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="text-xs bg-white/10 text-white/80 px-2 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-white/70">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>{wallpaper.rating.average}</span>
                  <span>({wallpaper.rating.count})</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{wallpaper.downloadCount}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredWallpapers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-white/60 text-lg">
            No wallpapers found matching your filters.
          </div>
          <button
            onClick={() => {
              setSelectedFilter('all')
              setSelectedOrientation('all')
            }}
            className="btn-glass mt-4"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  )
}
