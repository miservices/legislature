import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Landmark, Users, Gavel, Calendar, FileText, 
  ArrowRight, CheckCircle2, Clock, Vote
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Senate() {
  const leadershipPositions = [
    { title: 'Senate Majority Leader', role: 'Presides over Senate business' },
    { title: 'Senate Minority Leader', role: 'Leads the minority party' },
    { title: 'President Pro Tempore', role: 'Presides in absence of Lt. Governor' },
    { title: 'Majority Floor Leader', role: 'Manages floor proceedings' },
  ];

  const committees = [
    'Appropriations',
    'Judiciary',
    'Health Policy',
    'Education',
    'Transportation',
    'Natural Resources',
    'Finance',
    'Government Operations',
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Link to={createPageUrl('About')} className="hover:text-white">About</Link>
            <span>/</span>
            <span>Senate</span>
          </div>
          
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Landmark className="w-10 h-10 text-[#C4A600]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold">Michigan Senate</h1>
              <p className="text-white/80 mt-2">The Upper Chamber of the Legislature</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold text-[#C4A600]">4</div>
              <div className="text-sm text-white/70">Senators</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold text-[#C4A600]">1</div>
              <div className="text-sm text-white/70">Year Terms</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold text-[#C4A600]">3</div>
              <div className="text-sm text-white/70">Votes to Pass</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold text-[#C4A600]">8</div>
              <div className="text-sm text-white/70">Committees</div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-[#003366]" />
                  About the Senate
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-slate max-w-none">
                <p>
                  The Michigan Senate is the upper chamber of the Michigan Legislature. 
                  It consists of 4 members elected from single-member districts across 
                  the state, each serving one-year terms. Members take office on January 1st 
                  and serve until December 31st of the same year, as prescribed by the Michigan Constitution.
                </p>
                <p>
                  The Senate has several unique constitutional powers, including:
                </p>
                <ul>
                  <li><strong>Confirmation Power:</strong> The Senate confirms or rejects gubernatorial appointments to state offices and boards.</li>
                  <li><strong>Impeachment Trials:</strong> The Senate serves as the jury in impeachment trials, with the power to remove officials from office.</li>
                  <li><strong>Treaty Consideration:</strong> Reviews and ratifies interstate compacts and agreements.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Leadership */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-[#003366]" />
                  Senate Leadership
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {leadershipPositions.map((position) => (
                    <div key={position.title} className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="font-semibold text-slate-900">{position.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{position.role}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Committees */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#003366]" />
                  Standing Committees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {committees.map((committee) => (
                    <div 
                      key={committee}
                      className="p-3 bg-[#003366]/5 rounded-lg text-center hover:bg-[#003366]/10 transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-medium text-[#003366]">{committee}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How a Senate Bill Works */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#003366]" />
                  Senate Bill Process
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: 1, title: 'Introduction', desc: 'Senator introduces bill (SB number assigned)' },
                    { step: 2, title: 'First Reading', desc: 'Bill title read aloud, referred to committee' },
                    { step: 3, title: 'Committee Action', desc: 'Hearings, amendments, committee vote' },
                    { step: 4, title: 'Second Reading', desc: 'Floor amendments considered' },
                    { step: 5, title: 'Third Reading', desc: 'Final debate and roll call vote' },
                    { step: 6, title: 'House Consideration', desc: 'If passed, sent to House for action' },
                  ].map((item, index) => (
                    <div key={item.step} className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-[#003366] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {item.step}
                      </div>
                      <div className="flex-1 pb-4 border-b border-slate-100 last:border-0">
                        <h4 className="font-semibold text-slate-900">{item.title}</h4>
                        <p className="text-sm text-slate-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-[#003366] text-white">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
                <div className="space-y-3">
                  <Link to={createPageUrl('Bills') + '?chamber=Senate'}>
                    <Button variant="secondary" className="w-full justify-start bg-white/10 hover:bg-white/20 text-white">
                      <FileText className="w-4 h-4 mr-2" />
                      Senate Bills
                    </Button>
                  </Link>
                  <Link to={createPageUrl('VotesJournals') + '?chamber=Senate'}>
                    <Button variant="secondary" className="w-full justify-start bg-white/10 hover:bg-white/20 text-white">
                      <Vote className="w-4 h-4 mr-2" />
                      Senate Journal
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Session Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-700">In Session</span>
                </div>
                <p className="text-sm text-slate-600">
                  The Senate is currently in regular session for the 2024-2025 legislative term.
                </p>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requirements to Serve</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    'At least 21 years of age',
                    'U.S. citizen',
                    'Registered voter in the district',
                    'Resident of Michigan for 2+ years',
                  ].map((req) => (
                    <li key={req} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}