import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  FileText, ArrowLeft, Save, Plus, X, Users, Calendar,
  CheckCircle2, AlertCircle, Loader2, Upload, Trash2
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
import { hasPermission, canEditBill, PERMISSIONS } from '../components/member/PermissionGuard';
import { format } from 'date-fns';

export default function SubmitBill() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  const billType = urlParams.get('type') || 'bill';

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    bill_number: '',
    short_title: '',
    long_title: '',
    originating_chamber: 'House',
    summary: '',
    sponsors: [],
    sponsor_emails: [],
    status: 'Introduced',
    session: '2025',
    resolution_type: 'simple',
  });
  const [error, setError] = useState('');
  const [generatingBillNumber, setGeneratingBillNumber] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [history, setHistory] = useState([]);
  const [newHistoryEntry, setNewHistoryEntry] = useState({ date: '', action: '', chamber: '' });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Auto-add current user as sponsor for new bills
        if (!editId && currentUser) {
          const displayName = currentUser.display_name || currentUser.full_name;
          const prefix = currentUser.title_prefix || 
            (currentUser.legislature_role === 'senator' || currentUser.legislature_role === 'senate_leader' ? 'Sen.' : 'Rep.');
          setFormData(prev => ({
            ...prev,
            sponsors: [`${prefix} ${displayName}`],
            sponsor_emails: [currentUser.email],
            originating_chamber: 
              currentUser.legislature_role === 'senator' || currentUser.legislature_role === 'senate_leader' 
                ? 'Senate' : 'House'
          }));
        }
      } catch (e) {
        base44.auth.redirectToLogin(window.location.href);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [editId]);

  // Load existing bill for editing
  const { data: existingBill } = useQuery({
    queryKey: ['bill', editId],
    queryFn: async () => {
      const bills = await base44.entities.Bill.filter({ id: editId });
      return bills[0];
    },
    enabled: !!editId,
  });

  // Load legislators for co-sponsor selection
  const { data: legislators = [] } = useQuery({
    queryKey: ['legislators'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.filter(u => PERMISSIONS.LEGISLATOR.includes(u.legislature_role));
    },
  });

  // Load all bills to determine next bill number
  const { data: allBills = [] } = useQuery({
    queryKey: ['all-bills-for-number'],
    queryFn: () => base44.entities.Bill.list('-created_date'),
    enabled: !editId,
  });

  // Auto-generate bill number when chamber or resolution type changes (for new bills only)
  useEffect(() => {
    if (editId || !allBills.length || !user) return;
    
    let prefix;
    if (billType === 'resolution') {
      const chamberPrefix = formData.originating_chamber === 'Senate' ? 'S' : 'H';
      if (formData.resolution_type === 'concurrent') {
        prefix = chamberPrefix + 'CR';
      } else if (formData.resolution_type === 'joint') {
        prefix = chamberPrefix + 'JR';
      } else {
        prefix = chamberPrefix + 'R';
      }
    } else {
      prefix = formData.originating_chamber === 'Senate' ? 'SB' : 'HB';
    }
    
    // Find highest number for this prefix
    const relevantBills = allBills.filter(b => b.bill_number?.startsWith(prefix + ' '));
    let maxNumber = 0;
    relevantBills.forEach(b => {
      const num = parseInt(b.bill_number.replace(prefix + ' ', ''));
      if (!isNaN(num) && num > maxNumber) maxNumber = num;
    });
    
    const nextNumber = maxNumber + 1;
    setFormData(prev => ({ ...prev, bill_number: `${prefix} ${nextNumber}` }));
  }, [formData.originating_chamber, formData.resolution_type, allBills, editId, billType, user]);

  useEffect(() => {
    if (existingBill) {
      setFormData({
        bill_number: existingBill.bill_number || '',
        short_title: existingBill.short_title || '',
        long_title: existingBill.long_title || '',
        originating_chamber: existingBill.originating_chamber || 'House',
        summary: existingBill.summary || '',
        sponsors: existingBill.sponsors || [],
        sponsor_emails: existingBill.sponsor_emails || [],
        status: existingBill.status || 'Introduced',
        session: existingBill.session || '2025',
      });
      setDocuments(existingBill.documents || []);
      setHistory(existingBill.history || []);
    }
  }, [existingBill]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const autoHistoryEntry = {
        date: today,
        action: `${billType === 'resolution' ? 'Resolution' : 'Bill'} introduced by ${data.sponsors[0]}`,
        chamber: data.originating_chamber
      };
      
      // Combine auto entry with any manual entries
      const fullHistory = [autoHistoryEntry, ...history];
      
      return base44.entities.Bill.create({
        ...data,
        documents,
        introduction_date: today,
        last_action_date: today,
        history: fullHistory,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      navigate(createPageUrl(`BillDetail?id=${result.id}`));
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Auto-add status change entry if status changed
      let updatedHistory = [...history];
      if (data.status !== existingBill?.status) {
        updatedHistory.push({
          date: today,
          action: `Status changed to: ${data.status}`,
          chamber: data.originating_chamber
        });
      }
      
      return base44.entities.Bill.update(editId, {
        ...data,
        documents,
        last_action_date: today,
        history: updatedHistory,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bill', editId] });
      navigate(createPageUrl(`BillDetail?id=${editId}`));
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.short_title) {
      setError('Short title is required.');
      return;
    }

    if (editId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const addSponsor = (legislator) => {
    if (!formData.sponsor_emails.includes(legislator.email)) {
      const prefix = legislator.title_prefix || 
        (legislator.legislature_role === 'senator' || legislator.legislature_role === 'senate_leader' ? 'Sen.' : 'Rep.');
      const displayName = legislator.display_name || legislator.full_name;
      setFormData(prev => ({
        ...prev,
        sponsors: [...prev.sponsors, `${prefix} ${displayName}`],
        sponsor_emails: [...prev.sponsor_emails, legislator.email],
      }));
    }
  };

  const removeSponsor = (index) => {
    // Must have at least one sponsor
    if (formData.sponsors.length <= 1) return;
    
    setFormData(prev => ({
      ...prev,
      sponsors: prev.sponsors.filter((_, i) => i !== index),
      sponsor_emails: prev.sponsor_emails.filter((_, i) => i !== index),
    }));
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingDoc(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setDocuments(prev => [...prev, {
        name: file.name,
        type: docType,
        url: file_url
      }]);
    } catch (err) {
      setError('Failed to upload file');
    } finally {
      setUploadingDoc(false);
    }
  };

  const removeDocument = (index) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  // Check if this is a resolution (either new or editing existing)
  const isResolution = billType === 'resolution' || 
    (existingBill?.bill_number && /^[SH](R|CR|JR)\s/.test(existingBill.bill_number));

  const documentTypes = isResolution ? [
    'Introduced Resolution',
    'Substitute Resolution', 
    'Committee Report',
    'Amendment',
    'Enrolled Resolution',
    'Adopted Resolution',
    'Other'
  ] : [
    'Introduced Bill',
    'Substitute Bill', 
    'Committee Report',
    'Amendment',
    'Enrolled Bill',
    'Public Act',
    'Fiscal Analysis',
    'Other'
  ];

  const addHistoryEntry = () => {
    if (!newHistoryEntry.date || !newHistoryEntry.action) return;
    setHistory(prev => [...prev, { ...newHistoryEntry }].sort((a, b) => new Date(a.date) - new Date(b.date)));
    setNewHistoryEntry({ date: format(new Date(), 'yyyy-MM-dd'), action: '', chamber: formData.originating_chamber });
  };

  const removeHistoryEntry = (index) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  };

  const updateHistoryEntry = (index, field, value) => {
    setHistory(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#003366]" />
      </div>
    );
  }

  if (!user || !hasPermission(user, 'SUBMIT_LEGISLATION')) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-slate-500 mb-4">You don't have permission to submit legislation.</p>
            <Link to={createPageUrl('MemberDashboard')}>
              <Button>Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check edit permissions
  if (editId && existingBill && !canEditBill(user, existingBill)) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="max-w-md mx-auto mt-20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Cannot Edit</h2>
            <p className="text-slate-500 mb-4">
              Only sponsors, the Clerk, or chamber leaders can edit this bill.
            </p>
            <Link to={createPageUrl(`BillDetail?id=${editId}`)}>
              <Button>View Bill</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-[#003366] to-[#004080] text-white py-8">
        <div className="max-w-3xl mx-auto px-4">
          <Link to={createPageUrl('MemberDashboard')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">
            {editId ? 'Edit Bill' : `Submit New ${billType === 'resolution' ? 'Resolution' : 'Bill'}`}
          </h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Bill Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bill_number">{isResolution ? 'Resolution' : 'Bill'} Number</Label>
                  <Input
                    id="bill_number"
                    value={formData.bill_number}
                    onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                    className="mt-1 bg-slate-50"
                    readOnly={!editId}
                  />
                  {!editId && (
                    <p className="text-xs text-slate-500 mt-1">Auto-generated based on chamber{isResolution ? ' and type' : ''}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="chamber">Originating Chamber</Label>
                  <Select 
                    value={formData.originating_chamber} 
                    onValueChange={(v) => setFormData({ ...formData, originating_chamber: v })}
                    disabled={editId}
                  >
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

              {/* Resolution Type (only for new resolutions) */}
              {billType === 'resolution' && !editId && (
                <div>
                  <Label htmlFor="resolution_type">Resolution Type</Label>
                  <Select 
                    value={formData.resolution_type} 
                    onValueChange={(v) => setFormData({ ...formData, resolution_type: v })}
                  >
                    <SelectTrigger className="mt-1 w-full md:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple Resolution (SR/HR)</SelectItem>
                      <SelectItem value="concurrent">Concurrent Resolution (SCR/HCR)</SelectItem>
                      <SelectItem value="joint">Joint Resolution (SJR/HJR)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.resolution_type === 'simple' && 'Simple resolutions are used for internal chamber matters.'}
                    {formData.resolution_type === 'concurrent' && 'Concurrent resolutions require approval of both chambers.'}
                    {formData.resolution_type === 'joint' && 'Joint resolutions have the force of law and require gubernatorial action.'}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="short_title">Short Title *</Label>
                <Input
                  id="short_title"
                  placeholder="e.g., Freedom of Information Act"
                  value={formData.short_title}
                  onChange={(e) => setFormData({ ...formData, short_title: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="long_title">Full Title</Label>
                <Textarea
                  id="long_title"
                  placeholder="e.g., An Act to provide for public access to certain public records..."
                  value={formData.long_title}
                  onChange={(e) => setFormData({ ...formData, long_title: e.target.value })}
                  className="mt-1"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  placeholder="Brief summary of the bill's purpose and key provisions"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Sponsors */}
              <div>
                <Label>Sponsors</Label>
                <div className="flex flex-wrap gap-2 mt-2 mb-3">
                  {formData.sponsors.map((sponsor, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1 py-1.5 px-3">
                      {sponsor}
                      <button type="button" onClick={() => removeSponsor(i)} className="ml-1 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                
                {legislators.length > 0 && (
                  <Select onValueChange={(email) => {
                    const leg = legislators.find(l => l.email === email);
                    if (leg) addSponsor(leg);
                  }}>
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue placeholder="Add sponsor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {legislators
                        .filter(l => !formData.sponsor_emails.includes(l.email))
                        .map(l => (
                          <SelectItem key={l.email} value={l.email}>
                            {l.display_name || l.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-slate-500 mt-1">You can add any legislator as a sponsor</p>
              </div>

              {/* Status (only for editing or admins) */}
              {(editId || hasPermission(user, 'ADMIN_EDIT')) && (
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger className="mt-1 w-full md:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Introduced">Introduced</SelectItem>
                      <SelectItem value="In Committee">In Committee</SelectItem>
                      <SelectItem value="Passed Chamber">Passed Chamber</SelectItem>
                      <SelectItem value="In Other Chamber">In Other Chamber</SelectItem>
                      <SelectItem value="Passed Legislature">Passed Legislature</SelectItem>
                      <SelectItem value="Signed into Law">{isResolution ? 'Adopted' : 'Signed into Law'}</SelectItem>
                      <SelectItem value="Vetoed">Vetoed</SelectItem>
                      <SelectItem value="Died">Died</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Documents */}
              <div>
                <Label>Documents (PDFs)</Label>
                <div className="mt-2 space-y-2">
                  {documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#003366]" />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-slate-500">{doc.type}</p>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeDocument(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 flex flex-wrap gap-2">
                  {documentTypes.map((docType) => (
                    <label key={docType} className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, docType)}
                        disabled={uploadingDoc}
                      />
                      <Badge 
                        variant="outline" 
                        className="cursor-pointer hover:bg-slate-100 flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        {docType}
                      </Badge>
                    </label>
                  ))}
                </div>
                {uploadingDoc && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>

              {/* History */}
              <div>
                <Label>Bill History</Label>
                <p className="text-xs text-slate-500 mb-2">Status changes are recorded automatically. Add additional history entries below.</p>
                
                {history.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {history.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <Input
                            type="date"
                            value={entry.date}
                            onChange={(e) => updateHistoryEntry(i, 'date', e.target.value)}
                            className="text-sm"
                          />
                          <Input
                            value={entry.action}
                            onChange={(e) => updateHistoryEntry(i, 'action', e.target.value)}
                            placeholder="Action"
                            className="col-span-2 text-sm"
                          />
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeHistoryEntry(i)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <div className="w-40">
                    <Input
                      type="date"
                      value={newHistoryEntry.date}
                      onChange={(e) => setNewHistoryEntry({ ...newHistoryEntry, date: e.target.value })}
                      placeholder="Date"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={newHistoryEntry.action}
                      onChange={(e) => setNewHistoryEntry({ ...newHistoryEntry, action: e.target.value })}
                      placeholder="e.g., Referred to Committee on Judiciary"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addHistoryEntry} disabled={!newHistoryEntry.date || !newHistoryEntry.action}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Link to={createPageUrl('MemberDashboard')}>
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
                <Button type="submit" disabled={isSubmitting} className="bg-[#003366] hover:bg-[#004080]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editId ? 'Save Changes' : 'Submit Bill'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}