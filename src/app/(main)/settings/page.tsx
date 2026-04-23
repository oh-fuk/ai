
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/app/page-header';
import { Loader, Plus, Trash, Sun, Moon, Zap, AlertTriangle, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection, deleteDocumentNonBlocking, setDocumentNonBlocking, useAuth } from '@/firebase';
import { doc, collection, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const profileFormSchema = z.object({
  username: z.string().min(2, { message: "Username must be at least 2 characters." }),
  collegeName: z.string().min(2, { message: "College name must be at least 2 characters." }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const subjectFormSchema = z.object({
  name: z.string().min(2, 'Subject name is required.'),
});

type SubjectFormValues = z.infer<typeof subjectFormSchema>;

interface Subject {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<ProfileFormValues & { email?: string }>(userRef);

  const subjectsQuery = useMemoFirebase(() => (user ? collection(firestore, 'users', user.uid, 'subjects') : null), [user, firestore]);
  const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

  const [isSaving, setIsSaving] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);


  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: '',
      collegeName: '',
    },
  });

  const subjectForm = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: {
      name: '',
    }
  });

  useEffect(() => {
    if (userProfile) {
      profileForm.reset({
        username: userProfile.username || '',
        collegeName: userProfile.collegeName || '',
      });
    }
  }, [userProfile, profileForm]);

  const handleSaveChanges = async (data: ProfileFormValues) => {
    if (!user || !userRef) return;
    setIsSaving(true);

    try {
      const finalData = { ...userProfile, ...data };
      await setDoc(userRef, finalData, { merge: true });
      profileForm.reset(finalData, { keepDirty: false });

      toast({
        title: "Settings Saved",
        description: "Your profile information has been updated.",
      });

    } catch (e: any) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: e.message || "Could not save your settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSubject = async (data: SubjectFormValues) => {
    if (!user) return;
    setIsAddingSubject(true);

    try {
      const subjectId = data.name.toLowerCase().replace(/\s+/g, '-');
      const subjectRef = doc(firestore, 'users', user.uid, 'subjects', subjectId);

      await setDoc(subjectRef, {
        name: data.name,
        userId: user.uid,
        id: subjectId,
      });

      toast({ title: "Subject Added!", description: `"${data.name}" has been added to your subjects.` });
      subjectForm.reset();
      setIsSubjectDialogOpen(false);

    } catch (error: any) {
      console.error("Failed to add subject:", error);
      toast({ variant: 'destructive', title: "Failed to Add Subject", description: error.message || "An unknown error occurred." });
    } finally {
      setIsAddingSubject(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!user || !firestore) return;
    const subjectRef = doc(firestore, 'users', user.uid, 'subjects', subjectId);
    deleteDocumentNonBlocking(subjectRef);
    toast({ title: "Subject Deleted", description: `"${subjectName}" has been removed.` });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut(auth);
    router.push('/login');
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    setIsLoggingOut(false);
  };


  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Settings"
          description="Manage your profile and application settings."
        />
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your personal information. This is how you'll appear in the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" />
              <p>Loading profile...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Manage your profile and application settings."
      />
      <Card>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(handleSaveChanges)}>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your public username and college details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={profileForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="john.doe" {...field} readOnly disabled />
                    </FormControl>
                    <FormDescription>
                      Your username cannot be changed after registration.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="collegeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>College Name</FormLabel>
                    <FormControl>
                      <Input placeholder="University of Knowledge" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Email</FormLabel>
                <Input readOnly disabled value={userProfile?.email || 'No email associated'} />
                <FormDescription>Your login email cannot be changed.</FormDescription>
              </FormItem>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSaving || !profileForm.formState.isDirty}>
                {isSaving ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the application.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}><Sun className="mr-2 h-4 w-4" /> Light</Button>
            <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}><Moon className="mr-2 h-4 w-4" /> Dark</Button>
            <Button variant={theme === 'neon' ? 'default' : 'outline'} onClick={() => setTheme('neon')}><Zap className="mr-2 h-4 w-4" /> Neon</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Subjects</CardTitle>
            <CardDescription>Add or remove your subjects.</CardDescription>
          </div>
          <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a New Subject</DialogTitle>
                <DialogDescription>
                  Provide a name for the new subject.
                </DialogDescription>
              </DialogHeader>
              <Form {...subjectForm}>
                <form onSubmit={subjectForm.handleSubmit(handleAddSubject)} className="space-y-4">
                  <FormField
                    control={subjectForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Quantum Physics" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isAddingSubject}>
                      {isAddingSubject ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Adding...</> : 'Add Subject'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {subjectsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" />
              <p>Loading subjects...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subjects?.map((subject, index) => (
                <div key={subject.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="font-medium">{subject.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteSubject(subject.id, subject.name)}>
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {subjects?.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-4">You haven't added any subjects yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Log Out</h3>
              <p className="text-sm text-muted-foreground">End your current session on this device.</p>
            </div>
            <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
              Log Out
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
