import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Scale, BookOpen, ChevronRight, Search, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

const defaultTitles = [
  { number: 1, name: 'Miscellaneous', description: 'General provisions and miscellaneous laws' },
  { number: 2, name: 'Statutory Rights and Liberties', description: 'Constitutional rights and civil liberties' },
  { number: 3, name: 'Penal Code', description: 'Criminal offenses and penalties' },
  { number: 4, name: 'Civil Law', description: 'Civil procedures and private law' },
  { number: 5, name: 'Vehicle and Traffic Law', description: 'Motor vehicle regulations and traffic laws' },
  { number: 6, name: 'State Government', description: 'Organization and operation of state government' },
  { number: 7, name: 'Local Government', description: 'Counties, cities, townships, and villages' },
  { number: 8, name: 'Revenue, Business, and Commercial Law', description: 'Taxation, commerce, and business regulation' },
  { number: 9, name: 'Public Health and Safety', description: 'Health regulations and public safety' },
];

export default function StatutoryLaws() {
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: titles = [], isLoading: titlesLoading } = useQuery({
    queryKey: ['statutory-titles'],
    queryFn: () => base44.entities.StatutoryTitle.list('number'),
  });

  const displayTitles = titles.length > 0 ? titles : defaultTitles;

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

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Scale className="w-7 h-7 text-[#C4A600]" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Michigan Statutory Laws</h1>
              <p className="text-white/70 mt-1">MSL - Compiled Laws of Michigan</p>
            </div>
          </div>
        </div>
      </section>

      {/* Info Banner */}
      <section className="bg-blue-50 border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">About the Michigan Statutory Laws</h3>
              <p className="text-sm text-blue-800">
                The Michigan Statutory Laws (MSL) is the compilation of all laws currently in the State of Michigan. 
                It is a collection of Public Acts (enacted by the Legislature and signed by the Governor, or enacted 
                via the initiative process), arranged by subject, with amendments incorporated. Temporary laws, such 
                as annual appropriations acts, are not included. The online version of the Michigan Statutory Laws 
                is updated periodically to reflect new legislation and amendments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>
      </section>

      {/* Titles Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Selected Titles</h2>
        
        {titlesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(9).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayTitles
              .filter(title => 
                searchQuery === '' || 
                title.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                title.description?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((title, index) => (
                <motion.div
                  key={title.number}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={createPageUrl(`TitleDetail?title=${title.number}`)}>
                    <Card className="h-full hover:shadow-lg transition-all duration-300 group cursor-pointer overflow-hidden">
                      <div className={`h-1.5 bg-gradient-to-r ${titleColors[title.number - 1] || titleColors[0]}`} />
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${titleColors[title.number - 1] || titleColors[0]} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                            <span className="text-white font-bold text-lg">{title.number}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 group-hover:text-[#003366] transition-colors">
                              Title {title.number}
                            </h3>
                            <p className="text-[#003366] font-medium text-sm mt-0.5">
                              {title.name}
                            </p>
                            {title.description && (
                              <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                                {title.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
          </div>
        )}

        {/* Example Citation */}
        <Card className="mt-12 bg-slate-50 border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#003366]" />
              How to Read MSL Citations
            </h3>
            <p className="text-slate-600 mb-4">
              Citations follow the format: <code className="bg-white px-2 py-1 rounded border text-sm font-mono">MSL [Title][Chapter].[Section]</code>
            </p>
            <div className="bg-white rounded-lg p-4 border">
              <p className="font-mono text-sm mb-2">
                <span className="text-[#003366] font-semibold">MSL 307.10</span>
              </p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• <strong>3</strong> = Title 3 (Penal Code)</li>
                <li>• <strong>07</strong> = Chapter 7 (Offenses against the person)</li>
                <li>• <strong>.10</strong> = Section 10 (Assault)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}