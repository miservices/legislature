import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  Menu, X, ChevronDown, Building2, FileText, Scale, 
  Vote, Home, Info, BookOpen, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Home', page: 'Home', icon: Home },
    { 
      name: 'About', 
      page: 'About', 
      icon: Info,
      subItems: [
        { name: 'Senate', page: 'Senate' },
        { name: 'House of Representatives', page: 'House' }
      ]
    },
    { name: 'Bills', page: 'Bills', icon: FileText },
    { name: 'Resolutions', page: 'Resolutions', icon: FileText },
    { name: 'Statutory Laws', page: 'StatutoryLaws', icon: Scale },
    { name: 'Votes & Journals', page: 'VotesJournals', icon: Vote },
    { name: 'Member Portal', page: 'MemberDashboard', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --mi-blue: #003366;
          --mi-blue-light: #004080;
          --mi-gold: #C4A600;
          --mi-gold-light: #D4B800;
        }
      `}</style>
      
      {/* Top Banner */}
      <div className="bg-[#003366] text-white py-1.5 text-center text-xs tracking-wide">
        <span className="opacity-80">Official Website of the</span>
        <span className="font-medium ml-1">Michigan State Legislature</span>
        <span className="opacity-60 ml-2">• Roblox Roleplay</span>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to={createPageUrl('Home')} className="flex items-center gap-3 group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#003366] rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                <Building2 className="w-6 h-6 md:w-7 md:h-7 text-[#C4A600]" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-xl font-bold text-[#003366] leading-tight">Michigan Legislature</h1>
                <p className="text-[10px] md:text-xs text-slate-500 tracking-wider uppercase">State of Michigan</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                item.subItems ? (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className={`text-sm font-medium px-4 py-2 h-auto ${
                          currentPageName === item.page || item.subItems.some(s => s.page === currentPageName)
                            ? 'text-[#003366] bg-slate-100' 
                            : 'text-slate-600 hover:text-[#003366] hover:bg-slate-50'
                        }`}
                      >
                        {item.name}
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem asChild className="cursor-pointer focus:bg-slate-100 focus:text-[#003366]">
                        <Link to={createPageUrl(item.page)} className="w-full">
                          Overview
                        </Link>
                      </DropdownMenuItem>
                      {item.subItems.map((sub) => (
                        <DropdownMenuItem key={sub.name} asChild className="cursor-pointer focus:bg-slate-100 focus:text-[#003366]">
                          <Link to={createPageUrl(sub.page)} className="w-full">
                            {sub.name}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link key={item.name} to={createPageUrl(item.page)}>
                    <Button 
                      variant="ghost" 
                      className={`text-sm font-medium px-4 py-2 h-auto ${
                        currentPageName === item.page 
                          ? 'text-[#003366] bg-slate-100' 
                          : 'text-slate-600 hover:text-[#003366] hover:bg-slate-50'
                      }`}
                    >
                      {item.name}
                    </Button>
                  </Link>
                )
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <Button 
              variant="ghost" 
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <div key={item.name}>
                  <Link 
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      currentPageName === item.page 
                        ? 'bg-[#003366] text-white' 
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.name}
                  </Link>
                  {item.subItems && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.subItems.map((sub) => (
                        <Link 
                          key={sub.name}
                          to={createPageUrl(sub.page)}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                            currentPageName === sub.page 
                              ? 'bg-slate-200 text-[#003366]' 
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#003366] text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[#C4A600]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Michigan Legislature</h3>
                  <p className="text-xs text-white/60">Roblox Roleplay</p>
                </div>
              </div>
              <p className="text-sm text-white/70 max-w-md">
                The official legislative body of the State of Michigan, comprising the Senate and House of Representatives.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-[#C4A600]">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to={createPageUrl('Bills')} className="hover:text-[#C4A600] transition-colors">Bills & Legislation</Link></li>
                <li><Link to={createPageUrl('StatutoryLaws')} className="hover:text-[#C4A600] transition-colors">Statutory Laws</Link></li>
                <li><Link to={createPageUrl('VotesJournals')} className="hover:text-[#C4A600] transition-colors">Votes & Journals</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-[#C4A600]">Chambers</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to={createPageUrl('Senate')} className="hover:text-[#C4A600] transition-colors">Senate</Link></li>
                <li><Link to={createPageUrl('House')} className="hover:text-[#C4A600] transition-colors">House of Representatives</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm text-white/50">
            <p>© {new Date().getFullYear()} Michigan State Legislature • Roblox Roleplay</p>
          </div>
        </div>
      </footer>
    </div>
  );
}