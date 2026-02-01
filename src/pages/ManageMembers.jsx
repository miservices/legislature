import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Users, ArrowLeft, Save, Search, Shield, AlertCircle, Loader2, Check
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPermission, getRoleDisplay, PERMISSIONS } from '../components/member/PermissionGuard';
import { Plus, Trash2 } from 'lucide-react';

export default function ManageMembers() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeTab, setActiveTab] = useState('members');
  const [newParty, setNewParty] = useState({ code: '', name: '', color: 'slate-500' });

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

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list('full_name'),
    enabled: !!user && hasPermission(user, 'MANAGE_ROLES'),
  });

  const { data: parties = [] } = useQuery({
    queryKey: ['parties'],
    queryFn: () => base44.entities.PoliticalParty.list('name'),
  });

  const createPartyMutation = useMutation({
    mutationFn: (data) => base44.entities.PoliticalParty.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      setNewParty({ code: '', name: '', color: 'slate-500' });
    },
  });

  const deletePartyMutation = useMutation({
    mutationFn: (id) => base44.entities.PoliticalParty.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['parties'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setEditingUser(null);
    },
  });

  const filteredUsers = allUsers.filter(u => 
    searchQuery === '' ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPartyColor = (partyCode) => {
    const party = parties.find(p => p.code === partyCode);
    return party?.color || 'slate-400';
  };

  const getPartyName = (partyCode) => {
    const party = parties.find(p => p.code === partyCode);
    return party?.name || partyCode || 'No Party';
  };

  const openEditDialog = (userToEdit) => {
    setEditingUser(userToEdit);
    setEditForm({
      legislature_role: userToEdit.legislature_role || 'citizen',
      party: userToEdit.party || '',
      display_name: userToEdit.display_name || userToEdit.full_name || '',
      title_prefix: userToEdit.title_prefix || '',
    });
  };

  const handleSave = () => {
    updateMutation.mutate({ id: editingUser.id, data: editForm });
  };

  if (loading || usersLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#003366]" />
      </div>
    );
  }

  if (!user || !hasPermission(user, 'MANAGE_ROLES')) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-slate-500 mb-4">Only the Clerk or chamber leaders can manage members.</p>
            <Link to={createPageUrl('MemberDashboard')}>
              <Button>Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleColors = {
    citizen: 'bg-slate-100 text-slate-600',
    senator: 'bg-blue-100 text-blue-700',
    representative: 'bg-indigo-100 text-indigo-700',
    clerk: 'bg-amber-100 text-amber-700',
    senate_leader: 'bg-purple-100 text-purple-700',
    house_leader: 'bg-green-100 text-green-700',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Link to={createPageUrl('MemberDashboard')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#C4A600]" />
            <h1 className="text-2xl md:text-3xl font-bold">Manage Members</h1>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="parties">Political Parties</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Members ({filteredUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredUsers.map((u) => (
                    <div 
                      key={u.id} 
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-${getPartyColor(u.party)}`}
                          style={{ backgroundColor: u.party ? undefined : '#94a3b8' }}
                        >
                          {(u.display_name || u.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {u.title_prefix && <span className="text-slate-500">{u.title_prefix} </span>}
                            {u.display_name || u.full_name}
                          </p>
                          <p className="text-sm text-slate-500">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={roleColors[u.legislature_role] || roleColors.citizen}>
                          {getRoleDisplay(u.legislature_role)}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(u)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parties">
            <Card>
              <CardHeader>
                <CardTitle>Manage Political Parties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Party */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium mb-3">Add New Party</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Code</Label>
                      <Input
                        placeholder="e.g., D, R, L"
                        value={newParty.code}
                        onChange={(e) => setNewParty({ ...newParty, code: e.target.value.toUpperCase() })}
                        className="mt-1"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label>Full Name</Label>
                      <Input
                        placeholder="e.g., Democratic Party"
                        value={newParty.name}
                        onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Select value={newParty.color} onValueChange={(v) => setNewParty({ ...newParty, color: v })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blue-500">Blue</SelectItem>
                          <SelectItem value="red-500">Red</SelectItem>
                          <SelectItem value="green-500">Green</SelectItem>
                          <SelectItem value="yellow-500">Yellow</SelectItem>
                          <SelectItem value="purple-500">Purple</SelectItem>
                          <SelectItem value="orange-500">Orange</SelectItem>
                          <SelectItem value="slate-500">Gray</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button 
                    onClick={() => createPartyMutation.mutate(newParty)}
                    disabled={!newParty.code || !newParty.name || createPartyMutation.isPending}
                    className="mt-3 bg-[#003366]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Party
                  </Button>
                </div>

                {/* Existing Parties */}
                <div>
                  <h4 className="font-medium mb-3">Existing Parties</h4>
                  {parties.length > 0 ? (
                    <div className="space-y-2">
                      {parties.map((party) => (
                        <div key={party.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full bg-${party.color}`} 
                              style={{ backgroundColor: party.color?.includes('-') ? undefined : party.color }}
                            />
                            <div>
                              <span className="font-medium">{party.name}</span>
                              <span className="text-slate-500 ml-2">({party.code})</span>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deletePartyMutation.mutate(party.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-6">
                      No political parties defined yet. Add one above.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member: {editingUser?.full_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Display Name</Label>
              <Input
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Title Prefix</Label>
              <Input
                placeholder="e.g., Sen., Rep., Hon."
                value={editForm.title_prefix}
                onChange={(e) => setEditForm({ ...editForm, title_prefix: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Role</Label>
              <Select value={editForm.legislature_role} onValueChange={(v) => setEditForm({ ...editForm, legislature_role: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">Citizen</SelectItem>
                  <SelectItem value="senator">Senator</SelectItem>
                  <SelectItem value="representative">Representative</SelectItem>
                  <SelectItem value="clerk">Clerk</SelectItem>
                  <SelectItem value="senate_leader">Senate Leader</SelectItem>
                  <SelectItem value="house_leader">House Leader</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Party</Label>
              <Select value={editForm.party || ''} onValueChange={(v) => setEditForm({ ...editForm, party: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select party..." />
                </SelectTrigger>
                <SelectContent>
                  {parties.map((party) => (
                    <SelectItem key={party.code} value={party.code}>{party.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {parties.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">No parties defined. Add them in the Parties tab.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-[#003366]">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}