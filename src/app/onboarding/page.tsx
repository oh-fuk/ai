
'use client';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader, Plus, Trash } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { AthenaLogo } from '@/components/app/logo';

const subjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required.'),
});

const onboardingSchema = z.object({
  fullName: z.string().min(2, 'Full name is required.'),
  fatherName: z.string().min(2, 'Father\'s name is required.'),
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  about: z.string().min(10, 'Please tell us a bit about yourself.').optional(),
  collegeName: z.string().min(2, 'College name is required.'),
  country: z.string().min(2, 'Country is required.'),
  city: z.string().min(2, 'City is required.'),
  class: z.string().min(1, 'Class is required.'),
  subjects: z.array(subjectSchema).min(1, 'Please add at least one subject.'),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const steps = [
  { id: 'personal', title: 'Personal Details', fields: ['fullName', 'fatherName', 'username', 'about'] },
  { id: 'academic', title: 'Academic Information', fields: ['collegeName', 'country', 'city', 'class'] },
  { id: 'subjects', title: 'Your Subjects', fields: ['subjects'] },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: '',
      fatherName: '',
      username: '',
      about: '',
      collegeName: '',
      country: '',
      city: '',
      class: '',
      subjects: [{ name: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'subjects',
  });

  const nextStep = async () => {
    const fieldsToValidate = steps[currentStep].fields;
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const onSubmit = async (data: OnboardingFormValues) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to complete onboarding.',
      });
      return;
    }
    setIsSaving(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await setDoc(userRef, {
        email: user.email,
        ...data,
        hasCompletedOnboarding: true,
      }, { merge: true });
      
      const subjectPromises = data.subjects.map(subject => {
        const subjectRef = doc(firestore, 'users', user.uid, 'subjects', subject.name.toLowerCase().replace(/\s+/g, '-'));
        return setDoc(subjectRef, { name: subject.name, userId: user.uid, id: subject.name.toLowerCase().replace(/\s+/g, '-') });
      });
      await Promise.all(subjectPromises);

      // Redirect to login page with a query parameter
      router.push('/login?onboarding=complete');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
            <AthenaLogo className="mx-auto h-16 w-16 text-primary" />
            <h1 className="mt-4 text-3xl font-bold">Welcome to AthenaAI</h1>
            <p className="text-muted-foreground">Let's set up your student profile.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>Step {currentStep + 1} of {steps.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -300, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {currentStep === 0 && (
                      <div className="space-y-4">
                        <FormField control={form.control} name="fullName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input placeholder="Your Full Name" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="fatherName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Father's Name</FormLabel>
                            <FormControl><Input placeholder="Abdul Waheed" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="username" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl><Input placeholder="saadcheema123" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="about" render={({ field }) => (
                            <FormItem>
                                <FormLabel>About Yourself</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Tell us a little about your academic goals and interests..." {...field} rows={3} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                      </div>
                    )}
                    {currentStep === 1 && (
                       <div className="space-y-4">
                        <FormField control={form.control} name="collegeName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>College Name</FormLabel>
                            <FormControl><Input placeholder="IMCB G-10/4" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="country" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country</FormLabel>
                              <FormControl><Input placeholder="e.g., Pakistan" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="city" render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl><Input placeholder="e.g., Islamabad" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="class" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Class / Year</FormLabel>
                              <FormControl><Input placeholder="10th Grade" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                        )} />
                      </div>
                    )}
                    {currentStep === 2 && (
                       <div className="space-y-4">
                          <Label>Your Subjects</Label>
                          {fields.map((field, index) => (
                            <FormField
                              key={field.id}
                              control={form.control}
                              name={`subjects.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex items-center gap-2">
                                     <FormControl>
                                      <Input placeholder={`Subject ${index + 1}`} {...field} />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>
                                   <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '' })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Subject
                          </Button>
                          <FormMessage>{form.formState.errors.subjects?.message}</FormMessage>
                      </div>
                    )}
                </motion.div>
                </AnimatePresence>

                <div className="mt-8 flex justify-between">
                  {currentStep > 0 ? (
                    <Button type="button" variant="ghost" onClick={prevStep}>
                      Back
                    </Button>
                  ) : <div />}
                  {currentStep < steps.length - 1 && (
                    <Button type="button" onClick={nextStep}>
                      Next
                    </Button>
                  )}
                  {currentStep === steps.length - 1 && (
                    <Button type="submit" disabled={isSaving}>
                      {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      Finish Setup
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
