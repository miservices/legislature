import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Scale, BookOpen, ChevronRight, ArrowLeft, Search, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

const defaultTitles = {
  1: { name: 'Miscellaneous', description: 'General provisions and miscellaneous laws' },
  2: { name: 'Statutory Rights and Liberties', description: 'Constitutional rights and civil liberties' },
  3: { name: 'Penal Code', description: 'Criminal offenses and penalties' },
  4: { name: 'Civil Law', description: 'Civil procedures and private law' },
  5: { name: 'Vehicle and Traffic Law', description: 'Motor vehicle regulations and traffic laws' },
  6: { name: 'State Government', description: 'Organization and operation of state government' },
  7: { name: 'Local Government', description: 'Counties, cities, townships, and villages' },
  8: { name: 'Revenue, Business, and Commercial Law', description: 'Taxation, commerce, and business regulation' },
  9: { name: 'Public Health and Safety', description: 'Health regulations and public safety' },
};

export default function TitleDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const titleNumber = parseInt(urlParams.get('title')) || 1;
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['chapters', titleNumber],
    queryFn: () => base44.entities.StatutoryChapter.filter({ title_number: titleNumber }, 'chapter_number'),
  });

  const titleInfo = defaultTitles[titleNumber] || { name: 'Unknown Title', description: '' };

  const titleColors = [
    'from-slate-500 to-slate-600',
    'from-blue-500 to-blue-600',
    'from-red-500 to-red-600',
    'from-purple-500 to-purple-600',
    'from-amber-500 to-amber-600',
    'from-emerald-500 to-emerald-600',
    'from-cyan-500 to-cyan-600',
    'from-orange-500 to-orange-600',
    'from-green-500 to-green-600',
  ];

  const currentColor = titleColors[titleNumber - 1] || titleColors[0];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className={`bg-gradient-to-br ${currentColor} text-white py-12 md:py-16`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to={createPageUrl('StatutoryLaws')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to All Titles
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-3xl font-bold">{titleNumber}</span>
            </div>
            <div>
              <Badge className="bg-white/20 text-white mb-2">Title {titleNumber}</Badge>
              <h1 className="text-3xl md:text-4xl font-bold">{titleInfo.name}</h1>
              {titleInfo.description && (
                <p className="text-white/80 mt-2">{titleInfo.description}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Breadcrumb */}
      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Link to={createPageUrl('StatutoryLaws')} className="text-slate-500 hover:text-[#003366]">
              MSL
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="text-slate-900 font-medium">Title {titleNumber}: {titleInfo.name}</span>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search chapters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
      </section>

      {/* Chapters */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Chapters</h2>

        {isLoading ? (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : chapters.length > 0 ? (
          <div className="space-y-3">
            {chapters
              .filter(chapter => 
                searchQuery === '' || 
                chapter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                chapter.full_chapter_code.includes(searchQuery)
              )
              .map((chapter, index) => (
                <motion.div
                  key={chapter.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Link to={createPageUrl(`ChapterDetail?title=${titleNumber}&chapter=${chapter.chapter_number}`)}>
                    <Card className="hover:shadow-md transition-all duration-200 group cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-10 rounded-lg bg-gradient-to-br ${currentColor} bg-opacity-10 flex items-center justify-center`}>
                              <span className="font-mono font-bold text-white text-sm">
                                {chapter.full_chapter_code}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium text-slate-900 group-hover:text-[#003366] transition-colors">
                                Chapter {chapter.chapter_number}
                              </h3>
                              <p className="text-sm text-slate-600">{chapter.name}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#003366] transition-colors" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Chapters Yet</h3>
              <p className="text-slate-500">
                Chapters for this title have not been added yet.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}