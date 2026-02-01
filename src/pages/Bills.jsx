import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Search, Filter, FileText, ArrowRight, Calendar,
  User, Building2, X, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function Bills() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialChamber = urlParams.get('chamber') || 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chamberFilter, setChamberFilter] = useState(initialChamber);
  const [sessionFilter, setSessionFilter] = useState('all');

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list('-last_action_date'),
  });

  const statusColors = {
    'Introduced': 'bg-blue-100 text-blue-700 border-blue-200',
    'In Committee': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Passed Chamber': 'bg-purple-100 text-purple-700 border-purple-200',
    'In Other Chamber': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Passed Legislature': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Signed into Law': 'bg-green-100 text-green-700 border-green-200',
    'Vetoed': 'bg-red-100 text-red-700 border-red-200',
    'Died': 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesSearch = searchQuery === '' || 
        bill.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.short_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.sponsors?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
      const matchesChamber = chamberFilter === 'all' || bill.originating_chamber === chamberFilter;
      const matchesSession = sessionFilter === 'all' || bill.session === sessionFilter;

      return matchesSearch && matchesStatus && matchesChamber && matchesSession;
    });
  }, [bills, searchQuery, statusFilter, chamberFilter, sessionFilter]);

  const sessions = [...new Set(bills.map(b => b.session).filter(Boolean))];
  const activeFilters = [statusFilter, chamberFilter, sessionFilter].filter(f => f !== 'all').length;

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setChamberFilter('all');
    setSessionFilter('all');
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-[#C4A600]" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Bills & Legislation</h1>
              <p className="text-white/70 mt-1">Search and track all legislation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border-b sticky top-16 md:top-20 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by bill number, title, or sponsor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>

            {/* Filter Selects */}
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-11">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Introduced">Introduced</SelectItem>
                  <SelectItem value="In Committee">In Committee</SelectItem>
                  <SelectItem value="Passed Chamber">Passed Chamber</SelectItem>
                  <SelectItem value="In Other Chamber">In Other Chamber</SelectItem>
                  <SelectItem value="Passed Legislature">Passed Legislature</SelectItem>
                  <SelectItem value="Signed into Law">Signed into Law</SelectItem>
                  <SelectItem value="Vetoed">Vetoed</SelectItem>
                  <SelectItem value="Died">Died</SelectItem>
                </SelectContent>
              </Select>

              <Select value={chamberFilter} onValueChange={setChamberFilter}>
                <SelectTrigger className="w-[140px] h-11">
                  <SelectValue placeholder="Chamber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chambers</SelectItem>
                  <SelectItem value="Senate">Senate</SelectItem>
                  <SelectItem value="House">House</SelectItem>
                </SelectContent>
              </Select>

              {sessions.length > 0 && (
                <Select value={sessionFilter} onValueChange={setSessionFilter}>
                  <SelectTrigger className="w-[150px] h-11">
                    <SelectValue placeholder="Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessions.map(session => (
                      <SelectItem key={session} value={session}>{session}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {activeFilters > 0 && (
                <Button variant="ghost" onClick={clearFilters} className="h-11">
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-3 text-sm text-slate-600">
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span>{filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''} found</span>
            )}
          </div>
        </div>
      </section>

      {/* Bills List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-20 h-6" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBills.length > 0 ? (
          <div className="space-y-4">
            {filteredBills.map((bill) => (
              <Link key={bill.id} to={createPageUrl(`BillDetail?id=${bill.id}`)}>
                <Card className="hover:shadow-lg transition-all duration-200 group cursor-pointer overflow-hidden">
                  <div className={`h-1 ${bill.originating_chamber === 'Senate' ? 'bg-blue-500' : 'bg-indigo-500'}`} />
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      {/* Bill Number */}
                      <div className="flex-shrink-0">
                        <span className="font-mono text-lg font-bold text-[#003366]">
                          {bill.bill_number}
                        </span>
                        {bill.public_act_number && (
                          <Badge className="ml-2 bg-green-100 text-green-700">
                            PA {bill.public_act_number}
                          </Badge>
                        )}
                      </div>

                      {/* Bill Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 group-hover:text-[#003366] transition-colors">
                          {bill.short_title}
                        </h3>
                        {bill.long_title && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{bill.long_title}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {bill.originating_chamber}
                          </div>
                          {bill.sponsors?.length > 0 && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {bill.sponsors[0]}{bill.sponsors.length > 1 && ` +${bill.sponsors.length - 1}`}
                            </div>
                          )}
                          {bill.introduction_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(bill.introduction_date), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status & Arrow */}
                      <div className="flex items-center gap-3">
                        <Badge className={`${statusColors[bill.status]} border`}>
                          {bill.status}
                        </Badge>
                        <ArrowRight className="w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No bills found</h3>
              <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}