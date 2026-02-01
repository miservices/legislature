import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Scale, ArrowLeft, Save, Plus, AlertCircle, Loader2, Trash2, Edit
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { hasPermission } from '../components/member/PermissionGuard';
import { format } from 'date-fns';

export default function ManageMSL() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sections');
  const [editDialog, setEditDialog] = useState(null);
  const [formData, setFormData] = useState({});

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

  const { data: titles = [] } = useQuery({
    queryKey: ['titles'],
    queryFn: () => base44.entities.StatutoryTitle.list('number'),
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters'],
    queryFn: () => base44.entities.StatutoryChapter.list('full_chapter_code'),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: () => base44.entities.StatutorySection.list('section_code'),
  });

  const createSectionMutation = useMutation({
    mutationFn: (data) => base44.entities.StatutorySection.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setEditDialog(null);
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StatutorySection.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setEditDialog(null);
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: (data) => base44.entities.StatutoryChapter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      setEditDialog(null);
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StatutoryChapter.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      setEditDialog(null);
    },
  });

  const openNewSection = () => {
    setFormData({
      title_number: 3,
      chapter_number: 7,
      section_code: '',
      title: '',
      content: '',
      effective_date: format(new Date(), 'yyyy-MM-dd'),
    });
    setEditDialog('new-section');
  };

  const openEditSection = (section) => {
    setFormData({ ...section });
    setEditDialog('edit-section');
  };

  const openNewChapter = () => {
    setFormData({
      title_number: 1,
      chapter_number: '',
      full_chapter_code: '',
      name: '',
    });
    setEditDialog('new-chapter');
  };

  const openEditChapter = (chapter) => {
    setFormData({ ...chapter });
    setEditDialog('edit-chapter');
  };

  const handleSaveChapter = () => {
    if (editDialog === 'new-chapter') {
      createChapterMutation.mutate(formData);
    } else {
      updateChapterMutation.mutate({ id: formData.id, data: formData });
    }
  };

  const handleSaveSection = () => {
    if (editDialog === 'new-section') {
      createSectionMutation.mutate(formData);
    } else {
      updateSectionMutation.mutate({ id: formData.id, data: formData });
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
            <p className="text-slate-500 mb-4">Only the Clerk or chamber leaders can edit MSL.</p>
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
        <div className="max-w-5xl mx-auto px-4">
          <Link to={createPageUrl('MemberDashboard')} className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-[#C4A600]" />
            <h1 className="text-2xl md:text-3xl font-bold">Manage Michigan Statutory Laws</h1>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="chapters">Chapters</TabsTrigger>
          </TabsList>

          <TabsContent value="sections">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Law Sections</CardTitle>
                <Button onClick={openNewSection} className="bg-[#003366]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sections.map((section) => (
                    <div key={section.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <Badge variant="outline" className="font-mono mr-2">{section.section_code}</Badge>
                        <span className="font-medium">{section.title}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openEditSection(section)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {sections.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No sections yet. Add your first section.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chapters">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Chapters</CardTitle>
                <Button onClick={openNewChapter} className="bg-[#003366]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chapter
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {chapters.map((chapter) => (
                    <div key={chapter.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <Badge variant="outline" className="font-mono mr-2">{chapter.full_chapter_code}</Badge>
                        <span className="font-medium">{chapter.name}</span>
                        <span className="text-slate-500 text-sm ml-2">(Title {chapter.title_number})</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openEditChapter(chapter)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {chapters.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No chapters yet. Add your first chapter.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Section Dialog */}
      <Dialog open={editDialog === 'new-section' || editDialog === 'edit-section'} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog === 'new-section' ? 'Add New Section' : 'Edit Section'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Title Number</Label>
                <Input
                  type="number"
                  value={formData.title_number || ''}
                  onChange={(e) => setFormData({ ...formData, title_number: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Chapter Number</Label>
                <Input
                  type="number"
                  value={formData.chapter_number || ''}
                  onChange={(e) => setFormData({ ...formData, chapter_number: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Section Code</Label>
                <Input
                  placeholder="e.g., 307.10"
                  value={formData.section_code || ''}
                  onChange={(e) => setFormData({ ...formData, section_code: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Section Title</Label>
              <Input
                placeholder="e.g., Defined prohibited conduct; assault"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Content</Label>
              <Textarea
                placeholder="Full text of the law section..."
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="mt-1 font-mono text-sm"
                rows={12}
              />
            </div>

            <div>
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={formData.effective_date || ''}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                className="mt-1 w-48"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button 
              onClick={handleSaveSection} 
              disabled={createSectionMutation.isPending || updateSectionMutation.isPending}
              className="bg-[#003366]"
            >
              {(createSectionMutation.isPending || updateSectionMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chapter Dialog */}
      <Dialog open={editDialog === 'new-chapter' || editDialog === 'edit-chapter'} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editDialog === 'new-chapter' ? 'Add New Chapter' : 'Edit Chapter'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Title Number</Label>
                <Input
                  type="number"
                  value={formData.title_number || ''}
                  onChange={(e) => setFormData({ ...formData, title_number: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Chapter Number</Label>
                <Input
                  type="number"
                  value={formData.chapter_number || ''}
                  onChange={(e) => setFormData({ ...formData, chapter_number: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Full Chapter Code</Label>
              <Input
                placeholder="e.g., 307"
                value={formData.full_chapter_code || ''}
                onChange={(e) => setFormData({ ...formData, full_chapter_code: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Chapter Name</Label>
              <Input
                placeholder="e.g., Offenses against the person; assault and battery"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button 
              onClick={handleSaveChapter} 
              disabled={createChapterMutation.isPending || updateChapterMutation.isPending}
              className="bg-[#003366]"
            >
              {(createChapterMutation.isPending || updateChapterMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}