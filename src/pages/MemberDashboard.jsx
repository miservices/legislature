import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  FileText, Plus, Users, Settings, Scale, BookOpen, Vote,
  ChevronRight, Clock, CheckCircle2, AlertCircle, LogOut,
  PenLine, Gavel, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { hasPermission, getRoleDisplay, PERMISSIONS } from '../components/member/PermissionGuard';
import { format } from 'date-fns';

export default function MemberDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        base44.auth.redirectToLogin(window.location.href);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const { data: myBills = [] } = useQuery({
    queryKey: ['my-bills', user?.email],
    queryFn: () => base44.entities.Bill.filter({ sponsor_emails: user.email }, '-created_date', 10),
    enabled: !!user?.email && hasPermission(user, 'SUBMIT_LEGISLATION'),
  });

  const { data: recentBills = [] } = useQuery({
    queryKey: ['recent-bills'],
    queryFn: () => base44.entities.Bill.list('-created_date', 5),
    enabled: !!user,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = hasPermission(user, 'ADMIN_EDIT');
  const canSubmit = hasPermission(user, 'SUBMIT_LEGISLATION');
  const canManageRoles = hasPermission(user, 'MANAGE_ROLES');

  const quickActions = [];
  
  if (canSubmit) {
    quickActions.push(
      { icon: Plus, label: 'New Bill', page: 'SubmitBill', color: 'bg-blue-500' },
      { icon: PenLine, label: 'New Resolution', page: 'SubmitBill?type=resolution', color: 'bg-purple-500' },
    );
  }
  
  if (isAdmin) {
    quickActions.push(
      { icon: Vote, label: 'Record Vote', page: 'ManageVotes', color: 'bg-green-500' },
      { icon: BookOpen, label: 'Add Journal', page: 'ManageJournals', color: 'bg-amber-500' },
      { icon: Scale, label: 'Edit MSL', page: 'ManageMSL', color: 'bg-red-500' },
      { icon: Calendar, label: 'Session Calendar', page: 'ManageSessionCalendar', color: 'bg-cyan-500' },
    );
  }
  
  if (canManageRoles) {
    quickActions.push(
      { icon: Users, label: 'Manage Members', page: 'ManageMembers', color: 'bg-slate-600' },
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm mb-1">Welcome back,</p>
              <h1 className="text-2xl md:text-3xl font-bold">
                {user.display_name || user.full_name || 'Member'}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-[#C4A600] text-[#003366]">
                  {getRoleDisplay(user.legislature_role)}
                </Badge>
                {user.party && (
                  <Badge variant="outline" className="border-white/30 text-white">
                    {user.party}
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => base44.auth.logout()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {quickActions.map((action) => (
                <Link key={action.label} to={createPageUrl(action.page)}>
                  <Card className="hover:shadow-md transition-all cursor-pointer group h-full">
                    <CardContent className="p-4 text-center">
                      <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                        <action.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{action.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Citizen Notice */}
        {user.legislature_role === 'citizen' && (
          <Card className="mb-8 border-amber-200 bg-amber-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900">Limited Access</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    Your account currently has citizen-level access. To submit legislation or access 
                    administrative features, please contact the Clerk or a chamber leader to have 
                    your role updated.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* My Bills */}
          {canSubmit && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">My Sponsored Bills</CardTitle>
                <Link to={createPageUrl('SubmitBill')}>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    New Bill
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {myBills.length > 0 ? (
                  <div className="space-y-3">
                    {myBills.map((bill) => (
                      <Link key={bill.id} to={createPageUrl(`BillDetail?id=${bill.id}`)}>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div>
                            <span className="font-mono font-semibold text-[#003366]">{bill.bill_number}</span>
                            <p className="text-sm text-slate-600 truncate max-w-xs">{bill.short_title}</p>
                          </div>
                          <Badge variant="outline">{bill.status}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-6">
                    You haven't sponsored any bills yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Bills</CardTitle>
            </CardHeader>
            <CardContent>
              {recentBills.length > 0 ? (
                <div className="space-y-3">
                  {recentBills.map((bill) => (
                    <Link key={bill.id} to={createPageUrl(`BillDetail?id=${bill.id}`)}>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <div>
                          <span className="font-mono font-semibold text-[#003366]">{bill.bill_number}</span>
                          <p className="text-sm text-slate-600 truncate max-w-xs">{bill.short_title}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-6">No recent bills.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}