import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Building2, Users, FileText, CheckCircle2, Gavel, 
  ArrowRight, ChevronDown, ChevronUp, Scale, Vote,
  PenLine, MessageSquare, BookOpen, Landmark
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const processSteps = [
  {
    id: 1,
    title: 'Bill Introduction',
    chamber: 'Either Chamber',
    icon: PenLine,
    description: 'A legislator introduces a bill in their chamber (Senate or House). The bill is assigned a number and referred to the appropriate committee.',
    details: [
      'Senator or Representative drafts legislation',
      'Bill is formally introduced on the floor',
      'Assigned a bill number (SB or HB)',
      'Referred to standing committee'
    ]
  },
  {
    id: 2,
    title: 'Committee Review',
    chamber: 'Committee',
    icon: MessageSquare,
    description: 'The committee studies the bill, holds hearings, and may propose amendments. They then vote on whether to report the bill to the full chamber.',
    details: [
      'Committee schedules public hearing',
      'Testimony from stakeholders',
      'Committee discusses and amends',
      'Committee votes to report or table'
    ]
  },
  {
    id: 3,
    title: 'Chamber Debate',
    chamber: 'Originating Chamber',
    icon: Users,
    description: 'The full chamber debates the bill, considers amendments, and votes on passage. A majority vote is required to pass.',
    details: [
      'Bill placed on calendar',
      'Floor debate and amendments',
      'Roll call vote taken',
      'Majority required for passage'
    ]
  },
  {
    id: 4,
    title: 'Second Chamber',
    chamber: 'Other Chamber',
    icon: Building2,
    description: 'If passed, the bill moves to the other chamber where it goes through the same committee and floor process.',
    details: [
      'Referred to committee in second chamber',
      'Same committee and floor process',
      'May be amended',
      'Must pass in identical form'
    ]
  },
  {
    id: 5,
    title: 'Conference Committee',
    chamber: 'Both Chambers',
    icon: Scale,
    description: 'If the chambers pass different versions, a conference committee of members from both chambers works out the differences.',
    details: [
      'Only convenes if versions differ',
      'Members from both chambers negotiate',
      'Compromise version drafted',
      'Both chambers must approve final version'
    ]
  },
  {
    id: 6,
    title: "Governor's Action",
    chamber: 'Executive',
    icon: Gavel,
    description: "The Governor receives the bill and may sign it into law, veto it, or allow it to become law without signature.",
    details: [
      'Governor has 5 days to act',
      'Sign: Bill becomes law',
      'Veto: Returns to Legislature',
      'No action within 5 days: Becomes law automatically'
    ]
  }
];

export default function About() {
  const [expandedStep, setExpandedStep] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge className="bg-white/20 text-white mb-4">About</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">The Michigan Legislature</h1>
            <p className="text-lg text-white/80 leading-relaxed">
              The Michigan Legislature is the legislative branch of the state government, 
              responsible for creating and amending state laws, appropriating funds, and 
              providing oversight of the executive branch.
            </p>
          </div>
        </div>
      </section>

      {/* Bicameral Structure */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Bicameral Structure</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            The Michigan Legislature consists of two chambers: the Senate and the House of Representatives. 
            Both chambers must agree on legislation before it can be sent to the Governor.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Senate Card */}
          <Link to={createPageUrl('Senate')} className="group">
            <Card className="h-full hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="h-3 bg-gradient-to-r from-[#003366] to-[#004080]" />
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-[#003366] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Landmark className="w-8 h-8 text-[#C4A600]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Senate</h3>
                    <p className="text-slate-500">Upper Chamber</p>
                  </div>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-600">Members</span>
                    <span className="font-semibold text-slate-900">4 Senators</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-600">Term Length</span>
                    <span className="font-semibold text-slate-900">1 Year</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-600">Leader</span>
                    <span className="font-semibold text-slate-900">Senate Majority Leader</span>
                  </div>
                </div>

                <p className="text-slate-600 mb-6">
                  The Senate has exclusive authority to confirm gubernatorial appointments 
                  and serves as the jury in impeachment trials.
                </p>

                <Button className="w-full bg-[#003366] hover:bg-[#004080] group-hover:bg-[#004080]">
                  View Senate Details <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* House Card */}
          <Link to={createPageUrl('House')} className="group">
            <Card className="h-full hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="h-3 bg-gradient-to-r from-[#004080] to-[#003366]" />
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-[#003366] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-8 h-8 text-[#C4A600]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">House of Representatives</h3>
                    <p className="text-slate-500">Lower Chamber</p>
                  </div>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-600">Members</span>
                    <span className="font-semibold text-slate-900">8 Representatives</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-600">Term Length</span>
                    <span className="font-semibold text-slate-900">1 Year</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-600">Leader</span>
                    <span className="font-semibold text-slate-900">Speaker of the House</span>
                  </div>
                </div>

                <p className="text-slate-600 mb-6">
                  The House has sole authority to introduce appropriations bills and 
                  impeach state officials.
                </p>

                <Button className="w-full bg-[#003366] hover:bg-[#004080] group-hover:bg-[#004080]">
                  View House Details <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Powers Section */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Legislative Powers</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: FileText,
                title: 'Lawmaking',
                description: 'Enact, amend, and repeal state laws governing all aspects of life in Michigan.'
              },
              {
                icon: Scale,
                title: 'Appropriations',
                description: 'Control state spending through the annual budget process and appropriations bills.'
              },
              {
                icon: Vote,
                title: 'Oversight',
                description: 'Monitor executive agencies, confirm appointments, and investigate state matters.'
              }
            ].map((power) => (
              <Card key={power.title} className="bg-white">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-[#003366]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <power.icon className="w-7 h-7 text-[#003366]" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{power.title}</h3>
                  <p className="text-slate-600 text-sm">{power.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Legislative Process */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <Badge className="bg-[#C4A600]/20 text-[#003366] mb-4">Interactive Guide</Badge>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">How a Bill Becomes Law</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Click on each step to learn more about the legislative process in Michigan.
          </p>
        </div>

        {/* Process Timeline */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-[#003366] via-[#004080] to-green-500 transform -translate-x-1/2 rounded-full" />
          
          <div className="space-y-6">
            {processSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative ${index % 2 === 0 ? 'lg:pr-[52%]' : 'lg:pl-[52%]'}`}
              >
                {/* Step Number Bubble */}
                <div className="hidden lg:flex absolute left-1/2 top-8 transform -translate-x-1/2 w-12 h-12 bg-[#003366] rounded-full items-center justify-center text-white font-bold shadow-lg z-10">
                  {step.id}
                </div>

                <Card 
                  className={`cursor-pointer transition-all duration-300 ${
                    expandedStep === step.id 
                      ? 'ring-2 ring-[#003366] shadow-xl' 
                      : 'hover:shadow-lg'
                  }`}
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        step.id === 6 ? 'bg-green-100' : 'bg-[#003366]/10'
                      }`}>
                        <step.icon className={`w-6 h-6 ${step.id === 6 ? 'text-green-600' : 'text-[#003366]'}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="lg:hidden text-sm font-medium text-[#003366]">Step {step.id}</span>
                          <Badge variant="outline" className="text-xs">{step.chamber}</Badge>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
                        <p className="text-slate-600 text-sm">{step.description}</p>
                        
                        <AnimatePresence>
                          {expandedStep === step.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Key Actions:</h4>
                                <ul className="space-y-2">
                                  {step.details.map((detail, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                      {detail}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex-shrink-0">
                        {expandedStep === step.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Final Law */}
        <div className="mt-12 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="inline-flex items-center gap-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl px-8 py-6"
          >
            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-green-800">Law Enacted!</h3>
              <p className="text-green-600">The bill is now part of Michigan Statutory Laws</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}