import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Scale, BookOpen, ChevronRight, ArrowLeft, Search, FileText, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const defaultTitles = {
  1: { name: 'Miscellaneous' },
  2: { name: 'Statutory Rights and Liberties' },
  3: { name: 'Penal Code' },
  4: { name: 'Civil Law' },
  5: { name: 'Vehicle and Traffic Law' },
  6: { name: 'State Government' },
  7: { name: 'Local Government' },
  8: { name: 'Revenue, Business, and Commercial Law' },
  9: { name: 'Public Health and Safety' },
};

export default function ChapterDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const titleNumber = parseInt(urlParams.get('title')) || 1;
  const chapterNumber = parseInt(urlParams.get('chapter')) || 1;
  const [expandedSection, setExpandedSection] = React.useState(null);

  const { data: chapter } = useQuery({
    queryKey: ['chapter', titleNumber, chapterNumber],
    queryFn: async () => {
      const chapters = await base44.entities.StatutoryChapter.filter({ 
        title_number: titleNumber, 
        chapter_number: chapterNumber 
      });
      return chapters[0];
    },
  });

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['sections', titleNumber, chapterNumber],
    queryFn: () => base44.entities.StatutorySection.filter({ 
      title_number: titleNumber, 
      chapter_number: chapterNumber 
    }, 'section_code'),
  });

  const titleInfo = defaultTitles[titleNumber] || { name: 'Unknown Title' };
  const fullChapterCode = `${titleNumber}${String(chapterNumber).padStart(2, '0')}`;

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
      <section className={`bg-gradient-to-br ${currentColor} text-white py-10 md:py-14`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to={createPageUrl(`TitleDetail?title=${titleNumber}`)} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Title {titleNumber}
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold font-mono">{fullChapterCode}</span>
            </div>
            <div>
              <Badge className="bg-white/20 text-white mb-2">Chapter {chapterNumber}</Badge>
              <h1 className="text-2xl md:text-3xl font-bold">
                {chapter?.name || `Chapter ${chapterNumber}`}
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* Breadcrumb */}
      <section className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Link to={createPageUrl('StatutoryLaws')} className="text-slate-500 hover:text-[#003366]">
              MSL
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <Link to={createPageUrl(`TitleDetail?title=${titleNumber}`)} className="text-slate-500 hover:text-[#003366]">
              Title {titleNumber}: {titleInfo.name}
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="text-slate-900 font-medium">Chapter {fullChapterCode}</span>
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="space-y-6">
            {Array(3).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-48 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sections.length > 0 ? (
          <div className="space-y-6">
            {sections.map((section, index) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={`transition-all duration-200 ${
                    expandedSection === section.id ? 'ring-2 ring-[#003366] shadow-lg' : 'hover:shadow-md'
                  }`}
                >
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                      className="w-full text-left p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={`bg-gradient-to-r ${currentColor} text-white font-mono`}>
                              {section.section_code}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-slate-900">{section.title}</h3>
                        </div>
                        <ChevronRight 
                          className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${
                            expandedSection === section.id ? 'rotate-90' : ''
                          }`} 
                        />
                      </div>
                    </button>

                    {expandedSection === section.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t"
                      >
                        <div className="p-6 bg-slate-50">
                          <div className="prose prose-slate prose-sm max-w-none">
                            {section.content.split('\n\n').map((paragraph, i) => (
                              <p key={i} className="mb-4 text-slate-700 leading-relaxed">
                                {paragraph}
                              </p>
                            ))}
                          </div>

                          {(section.effective_date || section.last_amended) && (
                            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap gap-4 text-sm text-slate-500">
                              {section.effective_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Effective: {section.effective_date}
                                </div>
                              )}
                              {section.last_amended && (
                                <div className="flex items-center gap-1">
                                  <FileText className="w-4 h-4" />
                                  Last Amended: {section.last_amended}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Scale className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Sections Yet</h3>
              <p className="text-slate-500">
                Sections for this chapter have not been added yet.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}