
'use client';

import { useState } from 'react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader } from 'lucide-react';
import PageHeader from '@/components/app/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userRef);

  const isLoading = isUserLoading || isProfileLoading;

  const avatarUrl = userProfile?.avatarUrl;
  const fullName = userProfile?.fullName || 'Student';
  const username = userProfile?.username || 'user';
  const collegeName = userProfile?.collegeName || 'Not set';
  const userInitial = fullName?.charAt(0).toUpperCase() || 'S';

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-s" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Your Profile"
        description="This is your public profile information."
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="text-center">Student Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-primary shadow-lg">
              <AvatarImage src={avatarUrl} alt={username} />
              <AvatarFallback className="text-4xl">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold">{fullName}</h2>
            <p className="text-lg text-muted-foreground">@{username}</p>
          </div>
          <div className="w-full pt-4 border-t">
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="font-medium text-muted-foreground">College</dt>
                <dd className="font-semibold">{collegeName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium text-muted-foreground">Email</dt>
                <dd className="font-semibold">{user?.email}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
