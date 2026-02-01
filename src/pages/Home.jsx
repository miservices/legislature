import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  ArrowRight, Building2, Users, Scale, FileText, 
  Vote, Clock, CheckCircle2, AlertCircle, Gavel
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function Home() {
  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ['bills-recent'],
    queryFn: () => base44.entities.Bill.list('-last_action_date', 6),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['active-session'],
    queryFn: () => base44.entities.SessionCalendar.filter({ is_active: true }),
  });

  const activeSession = sessions[0];
  const isInSession = activeSession && new Date() >= new Date(activeSession.start_date) && new Date() <= new Date(activeSession.end_date);

  const recentBills = bills.filter(b => b.status === 'Introduced').slice(0, 3);
  const passedBills = bills.filter(b => b.status === 'Signed into Law').slice(0, 3);

  const statusColors = {
    'Introduced': 'bg-blue-100 text-blue-700',
    'In Committee': 'bg-yellow-100 text-yellow-700',
    'Passed Chamber': 'bg-purple-100 text-purple-700',
    'Signed into Law': 'bg-green-100 text-green-700',
    'Vetoed': 'bg-red-100 text-red-700',
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#003366] via-[#004080] to-[#002244] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-3xl">
            <div className={`inline-flex items-center gap-2 ${isInSession ? 'bg-white/10' : 'bg-red-500/20'} backdrop-blur-sm rounded-full px-4 py-2 text-sm mb-6`}>
              <span className={`w-2 h-2 ${isInSession ? 'bg-green-400 animate-pulse' : 'bg-red-400'} rounded-full`} />
              <span className="text-white/90">
                {isInSession ? 'Legislature Currently In Session' : 'Legislature Not In Session'}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Michigan State
              <span className="block text-[#C4A600]">Legislature</span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/80 mb-8 leading-relaxed">
              The official legislative body of the State of Michigan, dedicated to representing the people and crafting laws that serve our communities.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link to={createPageUrl('Bills')}>
                <Button size="lg" className="bg-[#C4A600] hover:bg-[#D4B800] text-[#003366] font-semibold shadow-lg">
                  View Legislation
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('About')}>
                <Button size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>

      </section>

      {/* Quick Links */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, title: 'Senate', desc: '4 Members', page: 'Senate', color: 'from-blue-500 to-blue-600' },
            { icon: Users, title: 'House', desc: '8 Members', page: 'House', color: 'from-indigo-500 to-indigo-600' },
            { icon: Scale, title: 'Laws', desc: 'Statutory Laws', page: 'StatutoryLaws', color: 'from-emerald-500 to-emerald-600' },
            { icon: Vote, title: 'Votes', desc: 'Roll Calls', page: 'VotesJournals', color: 'from-amber-500 to-amber-600' },
          ].map((item) => (
            <Link key={item.title} to={createPageUrl(item.page)}>
              <Card className="bg-white hover:shadow-xl transition-all duration-300 group cursor-pointer overflow-hidden">
                <CardContent className="p-4 md:p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Bills */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Recently Introduced */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Recently Introduced</h2>
                <p className="text-slate-500 text-sm mt-1">Newest bills in the legislature</p>
              </div>
              <Link to={createPageUrl('Bills')}>
                <Button variant="ghost" className="text-[#003366]">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-4">
              {billsLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-24 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </CardContent>
                  </Card>
                ))
              ) : recentBills.length > 0 ? (
                recentBills.map((bill) => (
                  <Link key={bill.id} to={createPageUrl(`BillDetail?id=${bill.id}`)}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-[#003366]">{bill.bill_number}</span>
                              <Badge className={statusColors[bill.status] || 'bg-slate-100 text-slate-700'}>
                                {bill.status}
                              </Badge>
                            </div>
                            <h3 className="font-medium text-slate-900 truncate">{bill.short_title}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                              {bill.introduction_date && format(new Date(bill.introduction_date), 'MMM d, yyyy')}
                              {bill.sponsors?.length > 0 && ` • ${bill.sponsors[0]}`}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No recently introduced bills</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Recently Passed */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Recently Passed</h2>
                <p className="text-slate-500 text-sm mt-1">Bills signed into law</p>
              </div>
              <Link to={createPageUrl('Bills')}>
                <Button variant="ghost" className="text-[#003366]">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="space-y-4">
              {billsLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-24 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </CardContent>
                  </Card>
                ))
              ) : passedBills.length > 0 ? (
                passedBills.map((bill) => (
                  <Link key={bill.id} to={createPageUrl(`BillDetail?id=${bill.id}`)}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-[#003366]">{bill.bill_number}</span>
                              {bill.public_act_number && (
                                <Badge className="bg-green-100 text-green-700">
                                  PA {bill.public_act_number}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-medium text-slate-900 truncate">{bill.short_title}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                              {bill.last_action_date && format(new Date(bill.last_action_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No recently passed legislation</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Session Info */}
      <section className="bg-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
            <div className="flex items-start gap-6">
              <div className="w-16 h-16 bg-[#003366] rounded-2xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-8 h-8 text-[#C4A600]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Current Session Status</h2>
                {isInSession ? (
                  <>
                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 rounded-full px-4 py-1 text-sm font-medium mb-4">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      In Session
                    </div>
                    <p className="text-slate-600 max-w-2xl">
                      The {activeSession?.name || 'Regular Session'} of the Michigan Legislature is currently in session. 
                      Both the Senate and House of Representatives are actively meeting to consider legislation 
                      and conduct the business of the State.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 rounded-full px-4 py-1 text-sm font-medium mb-4">
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                      Not In Session
                    </div>
                    <p className="text-slate-600 max-w-2xl">
                      The Michigan Legislature is currently not in session. 
                      {activeSession ? ` The ${activeSession.name} runs from ${format(new Date(activeSession.start_date), 'MMMM d, yyyy')} to ${format(new Date(activeSession.end_date), 'MMMM d, yyyy')}.` : ' Check back for updates on the next session.'}
                    </p>
                  </>
                )}
                <div className="mt-6 flex flex-wrap gap-4">
                  <Link to={createPageUrl('Senate')}>
                    <Button variant="outline" className="border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white">
                      Senate Schedule
                    </Button>
                  </Link>
                  <Link to={createPageUrl('House')}>
                    <Button variant="outline" className="border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white">
                      House Schedule
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}