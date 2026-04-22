
'use client';
import dynamic from 'next/dynamic';
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, memo } from 'react';
import { Loader } from 'lucide-react';
import { ThemeToggler } from "@/components/app/theme-toggler";
import { NotificationProvider } from "@/context/notification-context";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BackButton from '@/components/app/back-button';

// Lazy load sidebar for better performance
const AppSidebar = dynamic(() => import("@/app/(main)/app-sidebar"), {
  loading: () => <div className="w-64 h-full bg-sidebar animate-pulse" />,
  ssr: false
});

// A client-side component to guard routes based on authentication state.
const AuthGuard = memo(function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    // Don't do anything while auth or profile data is loading.
    if (isUserLoading || isProfileLoading) {
      return;
    }

    // If auth has loaded and there is no user, redirect to login.
    if (!user) {
      router.replace('/login'); // Use replace instead of push for better performance
      return;
    }

    // If there is a user, and their profile is loaded, check for onboarding.
    if (userProfile && userProfile.hasCompletedOnboarding === false) {
      router.replace('/onboarding');
      return;
    }

  }, [user, userProfile, isUserLoading, isProfileLoading, router]);

  // While loading auth state or the user's profile, show a full-screen loader.
  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If there's a user and they've completed onboarding, show the children.
  if (user && userProfile?.hasCompletedOnboarding) {
    return <>{children}</>;
  }

  // Fallback loader while redirecting or for edge cases.
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader className="h-8 w-8 animate-spin" />
    </div>
  );
});


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc(userDocRef);

  const avatarUrl = userProfile?.avatarUrl;
  const fullName = userProfile?.fullName || 'Student';
  const userInitial = fullName?.charAt(0).toUpperCase() || 'S';

  const isDashboard = pathname === '/dashboard';

  return (
    <AuthGuard>
      <NotificationProvider>
        <SidebarProvider defaultOpen={true}>
          <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Sidebar */}
            <Sidebar collapsible="none" className="flex-shrink-0 h-full overflow-y-auto scrollbar-hide border-r border-sidebar-border">
              <AppSidebar />
            </Sidebar>

            {/* Main content */}
            <SidebarInset className="flex flex-col flex-1 h-full overflow-hidden">
              <header className={cn(
                "flex-shrink-0 sticky top-0 z-10 flex h-14 items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8 transition-all duration-200",
                isDashboard
                  ? "bg-transparent border-none"
                  : "bg-background/80 backdrop-blur-md border-b border-border/60"
              )}>
                <div className="flex items-center gap-2">
                  {!isDashboard && <BackButton />}
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggler />
                  <Link href="/profile" className="group">
                    <Avatar className="h-8 w-8 ring-2 ring-transparent group-hover:ring-primary/40 transition-all duration-200">
                      <AvatarImage src={avatarUrl} alt={fullName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div
                  key={pathname}
                  className={cn("page-enter", pathname === '/chat' && "h-full")}
                >
                  <div className={cn(
                    "p-4 sm:p-6 lg:p-8",
                    (pathname === '/chat' || pathname === '/dashboard') && "p-0 h-full"
                  )}>
                    {children}
                  </div>
                </div>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </NotificationProvider>
    </AuthGuard>
  );
}
