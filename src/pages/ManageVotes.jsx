import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Vote, ArrowLeft, Save, Plus, AlertCircle, Loader2, Check, Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasPermission, PERMISSIONS } from '../components/member/PermissionGuard';
import { format } from 'date-fns';

export default function ManageVotes() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    bill_number: '',
    chamber: 'House',
    vote_date: format(new Date(), 'yyyy-MM-dd'),
    vote_type: 'Passage',
    description: '',
    roll_call: [],
  });

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

  const { data: legislators = [] } = useQuery({
    queryKey: ['legislators'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.filter(u => PERMISSIONS.LEGISLATOR.includes(u.legislature_role));
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills-for-vote'],
    queryFn: () => base44.entities.Bill.list('-created_date', 50),
  });

  // Initialize roll call when chamber changes
  useEffect(() => {
    const chamberLegislators = legislators.filter(l => {
      if (formData.chamber === 'Senate') {
        return l.legislature_role === 'senator' || l.legislature_role === 'senate_leader';
      }
      return l.legislature_role === 'representative' || l.legislature_role === 'house_leader';
    });

    setFormData(prev => ({
      ...prev,
      roll_call: chamberLegislators.map(l => ({
        member: l.display_name || l.full_name,
        member_email: l.email,
        vote: 'Yea',
        party: l.party || '',
      })),
    }));
  }, [formData.chamber, legislators]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const yeas = data.roll_call.filter(r => r.vote === 'Yea').length;
      const nays = data.roll_call.filter(r => r.vote === 'Nay').length;
      const absent = data.roll_call.filter(r => r.vote === 'Absent').length;
      const excused = data.roll_call.filter(r => r.vote === 'Excused').length;
      
      const total = data.chamber === 'Senate' ? 4 : 8;
      const required = Math.ceil(total / 2) + (total % 2 === 0 ? 1 : 0);
      const result = yeas >= required ? 'Passed' : 'Failed';

      return base44.entities.Vote.create({
        ...data,
        yeas,
        nays,
        absent,
        excused,
        result,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votes'] });
      setFormData({
        bill_number: '',
        chamber: 'House',
        vote_date: format(new Date(), 'yyyy-MM-dd'),
        vote_type: 'Passage',
        description: '',
        roll_call: [],
      });
    },
  });

  const updateRollCall = (index, vote) => {
    const newRollCall = [...formData.roll_call];
    newRollCall[index] = { ...newRollCall[index], vote };
    setFormData({ ...formData, roll_call: newRollCall });
  };

  const setAllVotes = (vote) => {
    setFormData({
      ...formData,
      roll_call: formData.roll_call.map(r => ({ ...r, vote })),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#003366]" />
      </div>
    );
  }

  if (!user || !hasPermission(user, 'ADMIN_EDIT')) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-slate-500 mb-4">Only the Clerk or chamber leaders can record votes.</p>
            <Link to={createPageUrl('MemberDashboard')}>
              <Button>Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const yeas = formData.roll_call.filter(r => r.vote === 'Yea').length;
  const nays = formData.roll_call.filter(r => r.vote === 'Nay').length;
  const absent = formData.roll_call.filter(r => r.vote === 'Absent').length;
  const excused = formData.roll_call.filter(r => r.vote === 'Excused').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Link to={createPageUrl('MemberDashboard')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Vote className="w-8 h-8 text-[#C4A600]" />
            <h1 className="text-2xl md:text-3xl font-bold">Record Roll Call Vote</h1>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Vote Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Bill Number</Label>
                <Select value={formData.bill_number} onValueChange={(v) => setFormData({ ...formData, bill_number: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select bill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bills.map(b => (
                      <SelectItem key={b.id} value={b.bill_number}>
                        {b.bill_number} - {b.short_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chamber</Label>
                <Select value={formData.chamber} onValueChange={(v) => setFormData({ ...formData, chamber: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Senate">Senate</SelectItem>
                    <SelectItem value="House">House</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Vote Date</Label>
                <Input
                  type="date"
                  value={formData.vote_date}
                  onChange={(e) => setFormData({ ...formData, vote_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Vote Type</Label>
                <Select value={formData.vote_type} onValueChange={(v) => setFormData({ ...formData, vote_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Passage">Passage</SelectItem>
                    <SelectItem value="Committee">Committee</SelectItem>
                    <SelectItem value="Amendment">Amendment</SelectItem>
                    <SelectItem value="Veto Override">Veto Override</SelectItem>
                    <SelectItem value="Procedural">Procedural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                placeholder="e.g., Final passage of HB 2101"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Roll Call */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Roll Call</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAllVotes('Yea')}>All Yea</Button>
                  <Button size="sm" variant="outline" onClick={() => setAllVotes('Nay')}>All Nay</Button>
                </div>
              </div>

              {/* Vote Tally */}
              <div className="grid grid-cols-4 gap-3 p-4 bg-slate-100 rounded-lg mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{yeas}</div>
                  <div className="text-xs text-slate-500">Yeas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{nays}</div>
                  <div className="text-xs text-slate-500">Nays</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-400">{absent}</div>
                  <div className="text-xs text-slate-500">Absent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{excused}</div>
                  <div className="text-xs text-slate-500">Excused</div>
                </div>
              </div>

              <div className="space-y-2">
                {formData.roll_call.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                        entry.party === 'D' ? 'bg-blue-500' : entry.party === 'R' ? 'bg-red-500' : 'bg-slate-400'
                      }`}>
                        {entry.party || '?'}
                      </div>
                      <span className="font-medium">{entry.member}</span>
                    </div>
                    <Select value={entry.vote} onValueChange={(v) => updateRollCall(i, v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yea">Yea</SelectItem>
                        <SelectItem value="Nay">Nay</SelectItem>
                        <SelectItem value="Absent">Absent</SelectItem>
                        <SelectItem value="Excused">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                {formData.roll_call.length === 0 && (
                  <p className="text-center text-slate-500 py-6">
                    No legislators found for this chamber. Add legislators in Member Management first.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link to={createPageUrl('MemberDashboard')}>
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button 
                onClick={() => createMutation.mutate(formData)} 
                disabled={createMutation.isPending || !formData.bill_number}
                className="bg-[#003366]"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Record Vote
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}