import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Vote, BookOpen, Calendar, Building2, Search, 
  ChevronRight, Filter, CheckCircle2, XCircle, Users,
  Download, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from 'date-fns';

export default function VotesJournals() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialChamber = urlParams.get('chamber') || 'all';

  const [activeTab, setActiveTab] = useState('votes');
  const [chamberFilter, setChamberFilter] = useState(initialChamber);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVote, setSelectedVote] = useState(null);

  const { data: votes = [], isLoading: votesLoading } = useQuery({
    queryKey: ['votes'],
    queryFn: () => base44.entities.Vote.list('-vote_date'),
  });

  const { data: journals = [], isLoading: journalsLoading } = useQuery({
    queryKey: ['journals'],
    queryFn: () => base44.entities.JournalEntry.list('-session_date'),
  });

  const filteredVotes = votes.filter(vote => {
    const matchesChamber = chamberFilter === 'all' || vote.chamber === chamberFilter;
    const matchesSearch = searchQuery === '' || 
      vote.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vote.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChamber && matchesSearch;
  });

  const filteredJournals = journals.filter(journal => {
    const matchesChamber = chamberFilter === 'all' || journal.chamber === chamberFilter;
    const matchesSearch = searchQuery === '' || 
      journal.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChamber && matchesSearch;
  });

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Vote className="w-7 h-7 text-[#C4A600]" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Votes & Journals</h1>
              <p className="text-white/70 mt-1">Roll call records and legislative journals</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border-b sticky top-16 md:top-20 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="bg-slate-100">
                <TabsTrigger value="votes" className="flex items-center gap-2">
                  <Vote className="w-4 h-4" />
                  Roll Call Votes
                </TabsTrigger>
                <TabsTrigger value="senate-journal" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Senate Journal
                </TabsTrigger>
                <TabsTrigger value="house-journal" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  House Journal
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              
              {activeTab === 'votes' && (
                <Select value={chamberFilter} onValueChange={setChamberFilter}>
                  <SelectTrigger className="w-[130px] h-10">
                    <SelectValue placeholder="Chamber" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chambers</SelectItem>
                    <SelectItem value="Senate">Senate</SelectItem>
                    <SelectItem value="House">House</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Votes Tab */}
        {activeTab === 'votes' && (
          <>
            {votesLoading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredVotes.length > 0 ? (
              <div className="space-y-4">
                {filteredVotes.map((vote) => (
                  <Card 
                    key={vote.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedVote(vote)}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Link 
                              to={createPageUrl(`Bills?search=${vote.bill_number}`)}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono font-semibold text-[#003366] hover:underline"
                            >
                              {vote.bill_number}
                            </Link>
                            <Badge variant="outline">{vote.chamber}</Badge>
                            <Badge variant="outline">{vote.vote_type}</Badge>
                          </div>
                          <p className="text-slate-700">{vote.description || 'Vote on passage'}</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {vote.vote_date && format(new Date(vote.vote_date), 'MMMM d, yyyy')}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{vote.yeas}</div>
                          <div className="text-xs text-slate-500 uppercase">Yeas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{vote.nays}</div>
                          <div className="text-xs text-slate-500 uppercase">Nays</div>
                        </div>
                        {(vote.absent > 0 || vote.absent === 0) && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-slate-400">{vote.absent || 0}</div>
                            <div className="text-xs text-slate-500 uppercase">Absent</div>
                          </div>
                        )}
                        {(vote.excused > 0 || vote.excused === 0) && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-amber-500">{vote.excused || 0}</div>
                            <div className="text-xs text-slate-500 uppercase">Excused</div>
                          </div>
                        )}
                        <Badge className={vote.result === 'Passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {vote.result === 'Passed' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {vote.result}
                        </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Vote className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Votes Found</h3>
                  <p className="text-slate-500">No roll call votes match your search criteria.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Senate Journal Tab */}
        {activeTab === 'senate-journal' && (
          <JournalList 
            journals={journals.filter(j => j.chamber === 'Senate')} 
            isLoading={journalsLoading}
            searchQuery={searchQuery}
            chamber="Senate"
          />
        )}

        {/* House Journal Tab */}
        {activeTab === 'house-journal' && (
          <JournalList 
            journals={journals.filter(j => j.chamber === 'House')} 
            isLoading={journalsLoading}
            searchQuery={searchQuery}
            chamber="House"
          />
        )}
      </section>

      {/* Vote Detail Dialog */}
      <Dialog open={!!selectedVote} onOpenChange={() => setSelectedVote(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedVote && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono">{selectedVote.bill_number}</span>
                  <Badge className={selectedVote.result === 'Passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {selectedVote.result}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{selectedVote.yeas}</div>
                    <div className="text-sm text-slate-500">Yeas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{selectedVote.nays}</div>
                    <div className="text-sm text-slate-500">Nays</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-slate-400">{selectedVote.absent || 0}</div>
                    <div className="text-sm text-slate-500">Absent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{selectedVote.excused || 0}</div>
                    <div className="text-sm text-slate-500">Excused</div>
                  </div>
                </div>

                <div>
                  <p className="text-slate-600">{selectedVote.description}</p>
                  <p className="text-sm text-slate-500 mt-2">
                    {selectedVote.chamber} • {selectedVote.vote_type} • {selectedVote.vote_date && format(new Date(selectedVote.vote_date), 'MMMM d, yyyy')}
                  </p>
                </div>

                {selectedVote.roll_call?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Roll Call - Individual Votes</h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {selectedVote.roll_call.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                              entry.party === 'D' ? 'bg-blue-500' : 
                              entry.party === 'R' ? 'bg-red-500' : 'bg-slate-400'
                            }`}>
                              {entry.party || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{entry.member}</p>
                              {entry.district && (
                                <p className="text-xs text-slate-500">District {entry.district}</p>
                              )}
                            </div>
                          </div>
                          <Badge 
                            className={
                              entry.vote === 'Yea' ? 'bg-green-100 text-green-700 border-green-200' :
                              entry.vote === 'Nay' ? 'bg-red-100 text-red-700 border-red-200' :
                              entry.vote === 'Excused' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }
                          >
                            {entry.vote}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!selectedVote.roll_call || selectedVote.roll_call.length === 0) && (
                  <div className="text-center py-6 text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p>Individual roll call votes not yet recorded</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JournalList({ journals, isLoading, searchQuery, chamber }) {
  const filteredJournals = journals.filter(journal => 
    searchQuery === '' || 
    journal.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array(5).fill(0).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (filteredJournals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Journal Entries</h3>
          <p className="text-slate-500">No {chamber} journal entries have been recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {filteredJournals.map((journal) => (
        <Card key={journal.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono">
                    {chamber === 'Senate' ? 'S.J.' : 'H.J.'} {journal.journal_number}
                  </Badge>
                  {journal.session && (
                    <Badge variant="outline" className="text-xs">
                      {journal.session}
                    </Badge>
                  )}
                </div>
                <h3 className="font-medium text-slate-900">{journal.title}</h3>
                {journal.content && (
                  <p className="text-sm text-slate-600 mt-2 line-clamp-2">{journal.content}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <Calendar className="w-4 h-4" />
                  {journal.session_date && format(new Date(journal.session_date), 'MMM d, yyyy')}
                </div>
                {journal.pdf_url ? (
                  <a 
                    href={journal.pdf_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#003366] text-white text-xs font-medium rounded-md hover:bg-[#004080] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-3.5 h-3.5" />
                    View PDF
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic">PDF not available</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}