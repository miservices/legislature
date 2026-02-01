import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  FileText, ArrowLeft, Calendar, User, Building2,
  Download, Clock, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, ExternalLink, Vote, Edit
} from 'lucide-react';
import { canEditBill } from '../components/member/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

export default function BillDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const billId = urlParams.get('id');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        // Not logged in, that's fine
      }
    };
    loadUser();
  }, []);

  const { data: bill, isLoading } = useQuery({
    queryKey: ['bill', billId],
    queryFn: async () => {
      const bills = await base44.entities.Bill.filter({ id: billId });
      return bills[0];
    },
    enabled: !!billId,
  });

  const { data: votes = [] } = useQuery({
    queryKey: ['votes', bill?.bill_number],
    queryFn: () => base44.entities.Vote.filter({ bill_number: bill.bill_number }),
    enabled: !!bill?.bill_number,
  });

  const statusColors = {
    'Introduced': 'bg-blue-100 text-blue-700',
    'In Committee': 'bg-yellow-100 text-yellow-700',
    'Passed Chamber': 'bg-purple-100 text-purple-700',
    'In Other Chamber': 'bg-indigo-100 text-indigo-700',
    'Passed Legislature': 'bg-emerald-100 text-emerald-700',
    'Signed into Law': 'bg-green-100 text-green-700',
    'Vetoed': 'bg-red-100 text-red-700',
    'Died': 'bg-slate-100 text-slate-600',
  };

  const statusIcons = {
    'Introduced': Clock,
    'In Committee': Clock,
    'Passed Chamber': CheckCircle2,
    'In Other Chamber': Clock,
    'Passed Legislature': CheckCircle2,
    'Signed into Law': CheckCircle2,
    'Vetoed': XCircle,
    'Died': XCircle,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-[#003366] text-white py-8">
          <div className="max-w-5xl mx-auto px-4">
            <Skeleton className="h-8 w-32 bg-white/20 mb-4" />
            <Skeleton className="h-10 w-64 bg-white/20 mb-2" />
            <Skeleton className="h-6 w-96 bg-white/20" />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
              <Card><CardContent className="p-6"><Skeleton className="h-60 w-full" /></CardContent></Card>
            </div>
            <div><Card><CardContent className="p-6"><Skeleton className="h-80 w-full" /></CardContent></Card></div>
          </div>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Bill Not Found</h2>
            <p className="text-slate-500 mb-4">The requested bill could not be found.</p>
            <Link to={createPageUrl('Bills')}>
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Bills
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusIcons[bill.status] || Clock;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to={createPageUrl('Bills')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Bills
          </Link>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-2xl md:text-3xl font-bold">{bill.bill_number}</span>
                {bill.public_act_number && (
                  <Badge className="bg-green-500 text-white text-sm">
                    Public Act {bill.public_act_number}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-semibold">{bill.short_title}</h1>
            </div>

            <div className="flex items-center gap-3">
              {user && canEditBill(user, bill) && (
                <Link to={createPageUrl(`SubmitBill?edit=${bill.id}`)}>
                  <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Bill
                  </Button>
                </Link>
              )}
              <Badge className={`${statusColors[bill.status]} text-sm px-4 py-2 flex items-center gap-2 w-fit`}>
                <StatusIcon className="w-4 h-4" />
                {bill.status}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bill Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#003366]" />
                  Bill Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-slate-500">Bill Number</dt>
                    <dd className="font-semibold text-slate-900">{bill.bill_number}</dd>
                  </div>
                  {bill.public_act_number && (
                    <div>
                      <dt className="text-sm text-slate-500">Public Act</dt>
                      <dd className="font-semibold text-slate-900">PA {bill.public_act_number}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-slate-500">Originating Chamber</dt>
                    <dd className="font-semibold text-slate-900">{bill.originating_chamber}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Session</dt>
                    <dd className="font-semibold text-slate-900">{bill.session || '2024-2025'}</dd>
                  </div>
                  {bill.introduction_date && (
                    <div>
                      <dt className="text-sm text-slate-500">Introduced</dt>
                      <dd className="font-semibold text-slate-900">
                        {format(new Date(bill.introduction_date), 'MMMM d, yyyy')}
                      </dd>
                    </div>
                  )}
                  {bill.last_action_date && (
                    <div>
                      <dt className="text-sm text-slate-500">Last Action</dt>
                      <dd className="font-semibold text-slate-900">
                        {format(new Date(bill.last_action_date), 'MMMM d, yyyy')}
                      </dd>
                    </div>
                  )}
                </dl>

                {bill.sponsors?.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <h4 className="text-sm text-slate-500 mb-2">Sponsors</h4>
                      <div className="flex flex-wrap gap-2">
                        {bill.sponsors.map((sponsor, i) => (
                          <Badge key={i} variant="outline" className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {sponsor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {bill.long_title && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <h4 className="text-sm text-slate-500 mb-2">Full Title</h4>
                      <p className="text-slate-700">{bill.long_title}</p>
                    </div>
                  </>
                )}

                {bill.summary && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <h4 className="text-sm text-slate-500 mb-2">Summary</h4>
                      <p className="text-slate-700">{bill.summary}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Bill History */}
            {bill.history?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#003366]" />
                    Bill History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                    <div className="space-y-4">
                      {bill.history.map((entry, i) => (
                        <div key={i} className="relative flex gap-4 pl-10">
                          <div className="absolute left-2.5 w-3 h-3 bg-[#003366] rounded-full border-2 border-white" />
                          <div className="flex-1 pb-4 border-b border-slate-100 last:border-0">
                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                              <Calendar className="w-4 h-4" />
                              {entry.date}
                              {entry.chamber && (
                                <Badge variant="outline" className="text-xs ml-2">
                                  {entry.chamber}
                                </Badge>
                              )}
                            </div>
                            <p className="text-slate-900">{entry.action}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Votes */}
            {votes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Vote className="w-5 h-5 text-[#003366]" />
                    Roll Call Votes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {votes.map((vote) => (
                      <div key={vote.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{vote.chamber}</Badge>
                              <Badge variant="outline">{vote.vote_type}</Badge>
                            </div>
                            <p className="text-sm text-slate-600">{vote.description}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {vote.vote_date && format(new Date(vote.vote_date), 'MMMM d, yyyy')}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={vote.result === 'Passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {vote.result}
                            </Badge>
                            <p className="text-sm mt-2">
                              <span className="text-green-600 font-semibold">{vote.yeas}</span>
                              <span className="text-slate-400 mx-1">-</span>
                              <span className="text-red-600 font-semibold">{vote.nays}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {bill.documents?.length > 0 ? (
                  <div className="space-y-2">
                    {bill.documents.map((doc, i) => (
                      <a
                        key={i}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Download className="w-4 h-4 text-[#003366]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                          <p className="text-xs text-slate-500">{doc.type}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No documents available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Status Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Introduced', 'In Committee', 'Passed Chamber', 'In Other Chamber', 'Passed Legislature', 'Signed into Law'].map((status, i) => {
                    const statusOrder = ['Introduced', 'In Committee', 'Passed Chamber', 'In Other Chamber', 'Passed Legislature', 'Signed into Law'];
                    const currentIndex = statusOrder.indexOf(bill.status);
                    const isComplete = i <= currentIndex && bill.status !== 'Vetoed' && bill.status !== 'Died';
                    const isCurrent = status === bill.status;

                    return (
                      <div key={status} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isComplete 
                            ? 'bg-green-500 text-white' 
                            : isCurrent 
                              ? 'bg-[#003366] text-white'
                              : 'bg-slate-200 text-slate-400'
                        }`}>
                          {isComplete ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold">{i + 1}</span>
                          )}
                        </div>
                        <span className={`text-sm ${isCurrent ? 'font-semibold text-[#003366]' : 'text-slate-600'}`}>
                          {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card className="bg-[#003366] text-white">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Related</h3>
                <div className="space-y-2">
                  <Link to={createPageUrl('VotesJournals')}>
                    <Button variant="secondary" className="w-full justify-start bg-white/10 hover:bg-white/20 text-white">
                      <Vote className="w-4 h-4 mr-2" />
                      View All Votes
                    </Button>
                  </Link>
                  <Link to={createPageUrl('Bills')}>
                    <Button variant="secondary" className="w-full justify-start bg-white/10 hover:bg-white/20 text-white">
                      <FileText className="w-4 h-4 mr-2" />
                      Browse All Bills
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}