import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Calendar, ArrowLeft, Save, Plus, AlertCircle, Loader2, Edit, Trash2, Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasPermission } from '../components/member/PermissionGuard';
import { format } from 'date-fns';

export default function ManageSessionCalendar() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: true,
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

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.SessionCalendar.list('-start_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SessionCalendar.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setEditDialog(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SessionCalendar.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setEditDialog(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SessionCalendar.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const openNewSession = () => {
    setFormData({
      name: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      is_active: true,
    });
    setEditDialog('new');
  };

  const openEditSession = (session) => {
    setFormData({
      id: session.id,
      name: session.name,
      start_date: session.start_date,
      end_date: session.end_date,
      is_active: session.is_active,
    });
    setEditDialog('edit');
  };

  const handleSave = () => {
    if (editDialog === 'new') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: formData.id, data: formData });
    }
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
            <p className="text-slate-500 mb-4">Only the Clerk or chamber leaders can manage the session calendar.</p>
            <Link to={createPageUrl('MemberDashboard')}>
              <Button>Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Link to={createPageUrl('MemberDashboard')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#C4A600]" />
            <h1 className="text-2xl md:text-3xl font-bold">Session Calendar</h1>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Legislative Sessions</CardTitle>
            <Button onClick={openNewSession} className="bg-[#003366]">
              <Plus className="w-4 h-4 mr-2" />
              Add Session
            </Button>
          </CardHeader>
          <CardContent>
            {sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const now = new Date();
                  const isCurrentlyActive = session.is_active && 
                    now >= new Date(session.start_date) && 
                    now <= new Date(session.end_date);
                  
                  return (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${isCurrentlyActive ? 'bg-green-500 animate-pulse' : session.is_active ? 'bg-yellow-500' : 'bg-slate-300'}`} />
                        <div>
                          <p className="font-medium text-slate-900">{session.name}</p>
                          <p className="text-sm text-slate-500">
                            {format(new Date(session.start_date), 'MMM d, yyyy')} - {format(new Date(session.end_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrentlyActive && (
                          <Badge className="bg-green-100 text-green-700">Active Now</Badge>
                        )}
                        {!session.is_active && (
                          <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEditSession(session)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteMutation.mutate(session.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">
                No sessions defined. Add one to show session status on the homepage.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editDialog === 'new' ? 'Add New Session' : 'Edit Session'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Session Name</Label>
              <Input
                placeholder="e.g., 2025 Regular Session"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <Label>Active Session</Label>
                <p className="text-xs text-slate-500">Enable to show as current session</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={!formData.name || !formData.start_date || !formData.end_date || createMutation.isPending || updateMutation.isPending}
              className="bg-[#003366]"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}