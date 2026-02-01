import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  BookOpen, ArrowLeft, Save, Upload, AlertCircle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { hasPermission } from '../components/member/PermissionGuard';
import { format } from 'date-fns';

export default function ManageJournals() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    chamber: 'House',
    session_date: format(new Date(), 'yyyy-MM-dd'),
    journal_number: '',
    title: '',
    content: '',
    pdf_url: '',
    session: '2025',
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

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.JournalEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      setFormData({
        chamber: 'House',
        session_date: format(new Date(), 'yyyy-MM-dd'),
        journal_number: '',
        title: '',
        content: '',
        pdf_url: '',
        session: '2025',
      });
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, pdf_url: file_url });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
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
            <p className="text-slate-500 mb-4">Only the Clerk or chamber leaders can manage journals.</p>
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
        <div className="max-w-3xl mx-auto px-4">
          <Link to={createPageUrl('MemberDashboard')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#C4A600]" />
            <h1 className="text-2xl md:text-3xl font-bold">Add Journal Entry</h1>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Journal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
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
              <div>
                <Label>Session Date</Label>
                <Input
                  type="date"
                  value={formData.session_date}
                  onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Journal Number</Label>
                <Input
                  type="number"
                  placeholder="e.g., 46"
                  value={formData.journal_number}
                  onChange={(e) => setFormData({ ...formData, journal_number: parseInt(e.target.value) || '' })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Session</Label>
                <Input
                  placeholder="e.g., 2025"
                  value={formData.session}
                  onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <Input
                placeholder="e.g., Regular Session - Day 46"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Content / Summary</Label>
              <Textarea
                placeholder="Summary of proceedings..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="mt-1"
                rows={5}
              />
            </div>

            <div>
              <Label>PDF Document</Label>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
                {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              {formData.pdf_url && (
                <p className="text-sm text-green-600 mt-2">✓ PDF uploaded successfully</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link to={createPageUrl('MemberDashboard')}>
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button 
                onClick={() => createMutation.mutate(formData)} 
                disabled={createMutation.isPending || !formData.title || !formData.journal_number}
                className="bg-[#003366]"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Add Journal Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}