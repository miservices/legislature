import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Users, Gavel, Calendar, FileText, 
  ArrowRight, CheckCircle2, Clock, Vote, Building
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function House() {
  const leadershipPositions = [
    { title: 'Speaker of the House', role: 'Presides over House sessions' },
    { title: 'Speaker Pro Tempore', role: 'Presides in absence of Speaker' },
    { title: 'Majority Floor Leader', role: 'Manages majority party business' },
    { title: 'Minority Leader', role: 'Leads the minority party' },
  ];

  const committees = [
    'Appropriations',
    'Judiciary',
    'Ways and Means',
    'Education',
    'Health Policy',
    'Local Government',
    'Elections',
    'Commerce',
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#004080] to-[#003366] text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-white/70 text-sm mb-4">
            <Link to={createPageUrl('About')} className="hover:text-white">About</Link>
            <span>/</span>
            <span>House of Representatives</span>
          </div>
          
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Users className="w-10 h-10 text-[#C4A600]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold">House of Representatives</h1>
              <p className="text-white/80 mt-2">The Lower Chamber of the Legislature</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold text-[#C4A600]">8</div>
              <div className="text-sm text-white/70">Representatives</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold text-[#C4A600]">1</div>
              <div className="text-sm text-white/70">Year Terms</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-3xl font-bold text-[#C4A600]">5</div>
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
                  <Building className="w-5 h-5 text-[#003366]" />
                  About the House
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-slate max-w-none">
                <p>
                  The Michigan House of Representatives is the lower chamber of the Michigan 
                  Legislature. It consists of 8 members elected from single-member districts, 
                  each serving one-year terms. Members take office on January 1st and serve 
                  until December 31st of the same year, as prescribed by the Michigan Constitution.
                </p>
                <p>
                  The House has several unique constitutional powers, including:
                </p>
                <ul>
                  <li><strong>Power of the Purse:</strong> All appropriations (spending) bills must originate in the House.</li>
                  <li><strong>Impeachment Power:</strong> The House has sole authority to impeach state officials by majority vote.</li>
                  <li><strong>Closest to the People:</strong> With shorter terms, Representatives maintain closer ties to constituents.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Leadership */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-[#003366]" />
                  House Leadership
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

            {/* How a House Bill Works */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#003366]" />
                  House Bill Process
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: 1, title: 'Introduction', desc: 'Representative introduces bill (HB number assigned)' },
                    { step: 2, title: 'First Reading', desc: 'Bill title read aloud, referred to committee' },
                    { step: 3, title: 'Committee Action', desc: 'Hearings, amendments, committee vote' },
                    { step: 4, title: 'Second Reading', desc: 'Floor amendments considered' },
                    { step: 5, title: 'Third Reading', desc: 'Final debate and roll call vote' },
                    { step: 6, title: 'Senate Consideration', desc: 'If passed, sent to Senate for action' },
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
                  <Link to={createPageUrl('Bills') + '?chamber=House'}>
                    <Button variant="secondary" className="w-full justify-start bg-white/10 hover:bg-white/20 text-white">
                      <FileText className="w-4 h-4 mr-2" />
                      House Bills
                    </Button>
                  </Link>
                  <Link to={createPageUrl('VotesJournals') + '?chamber=House'}>
                    <Button variant="secondary" className="w-full justify-start bg-white/10 hover:bg-white/20 text-white">
                      <Vote className="w-4 h-4 mr-2" />
                      House Journal
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
                  The House is currently in regular session for the 2024-2025 legislative term.
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

            {/* The Speaker */}
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-3">The Speaker</h3>
                <p className="text-sm text-slate-600">
                  The Speaker of the House is the presiding officer and most powerful member 
                  of the House. The Speaker controls the flow of legislation, assigns bills 
                  to committees, and recognizes members to speak.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}